import { extractByUrl, json } from './_tikhub.js';
import { recordUsage, requireQuota } from './_auth.js';
import { getDefaultMaxVideoMinutes, getMembershipPlan } from './_plans.js';

const FREE_MAX_TRANSCRIBE_SECONDS = 5 * 60;

export async function onRequestGet() {
  return json({ ok: true, message: "transcribe-link alive, use POST" });
}

export async function onRequestPost(context) {
  try {
    return await handleTranscribeLink(context);
  } catch (error) {
    return json({
      ok: false,
      message: `逐字稿接口内部错误：${error?.message || String(error)}`,
      upstreamUrl: error?.upstreamUrl || null,
      status: error?.status || null
    }, 500);
  }
}

async function handleTranscribeLink(context) {
  const { request, env } = context;
  const tikhubKey = env.TIKHUB_API_KEY;
  const tikhubBaseUrl = env.TIKHUB_BASE_URL || 'https://api.tikhub.io';
  const volcengineAuth = getVolcengineAuth(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: '请求格式不正确。' }, 400);
  }

  const url = String(body.url || '').trim();
  const directVideoUrl = String(body.videoUrl || '').trim();
  if (!url && !directVideoUrl) return json({ ok: false, message: '缺少作品链接或视频链接。' }, 400);
  if (directVideoUrl && !/^https?:\/\//i.test(directVideoUrl)) return json({ ok: false, message: '视频链接格式不正确。' }, 400);
  if (!directVideoUrl && !tikhubKey) return json({ ok: false, message: '提取服务暂未配置完成。' }, 500);

  const quota = await requireQuota(context, 'extract');
  if (!quota.ok) return json({ ok: false, message: quota.message, needLogin: quota.status === 401 }, quota.status);

  const sourceData = directVideoUrl
    ? { title: String(body.title || '').trim(), video_url: directVideoUrl }
    : await extractByUrl({ apiKey: tikhubKey, baseUrl: tikhubBaseUrl, url });

  const publishedText = String(body.publishedText || '').trim() || getPublishedText(sourceData);
  const durationSeconds = Number(body.durationSeconds || 0) || getDurationSeconds(sourceData);
  const maxTranscribeSeconds = await getMaxTranscribeSeconds(context, quota);

  if (durationSeconds > maxTranscribeSeconds) {
    const maxMinutes = Math.round(maxTranscribeSeconds / 60);
    const message = `视频超过${maxMinutes}分钟，已为你提取标题、发布文案和素材链接，但不生成视频本身文案。`;
    const data = { ...sourceData, publishedText, transcript: '', transcriptSkipped: true, transcriptSkipReason: message, durationSeconds };
    await recordUsage(context, quota, { action: 'extract', sourceUrl: url || directVideoUrl, resultTitle: publishedText || sourceData?.title || null });
    const headers = quota.setCookie ? { 'Set-Cookie': quota.setCookie } : {};
    return json({ ok: true, message, data }, 200, headers);
  }

  const subtitleUrl = directVideoUrl ? '' : getSubtitleLinks(sourceData)[0];
  if (subtitleUrl) {
    const subtitleText = await fetchSubtitleText(subtitleUrl);
    if (subtitleText) {
      const data = { ...sourceData, text: subtitleText, transcript: subtitleText, publishedText, transcriptSource: 'subtitle' };
      await recordUsage(context, quota, { action: 'extract', sourceUrl: url || directVideoUrl, resultTitle: publishedText || sourceData?.title || null });
      const headers = quota.setCookie ? { 'Set-Cookie': quota.setCookie } : {};
      return json({ ok: true, data }, 200, headers);
    }
  }

  const videoUrl = getVideoLinks(sourceData)[0];
  if (!videoUrl) return json({ ok: false, message: '已解析作品信息，但没有拿到可转写的视频源。', data: sourceData }, 502);
  if (!volcengineAuth.ok) return json({ ok: false, message: volcengineAuth.message, data: sourceData }, 500);

  const taskId = await submitVolcengineTask({ auth: volcengineAuth, videoUrl });

  const data = { ...sourceData, publishedText, taskId, transcriptStatus: 'pending' };
  await recordUsage(context, quota, { action: 'extract', sourceUrl: url || directVideoUrl, resultTitle: publishedText || sourceData?.title || null });
  const headers = quota.setCookie ? { 'Set-Cookie': quota.setCookie } : {};
  return json({ ok: true, data }, 200, headers);
}

async function getMaxTranscribeSeconds(context, quota) {
  const plan = quota?.user?.plan;
  if (!context.env.DB || !plan || plan === 'free') return FREE_MAX_TRANSCRIBE_SECONDS;
  if (plan === 'admin') return getDefaultMaxVideoMinutes('admin') * 60;
  try {
    const config = await getMembershipPlan(context.env.DB, plan);
    if (config?.maxVideoMinutes) return config.maxVideoMinutes * 60;
  } catch {}
  return getDefaultMaxVideoMinutes(plan) * 60;
}

function getVolcengineAuth(env) {
  const appId = String(env.VOLCENGINE_APP_ID || '').trim();
  const token = String(env.VOLCENGINE_ACCESS_TOKEN || '').trim();
  if (appId && token) return { ok: true, mode: 'legacy', appId, accessToken: token };

  const apiKey = String(env.VOLCENGINE_API_KEY || '').trim();
  if (apiKey) return { ok: true, mode: 'apiKey', apiKey };

  const useLegacy = String(env.VOLCENGINE_USE_LEGACY || '').trim() === 'true';
  if (useLegacy) {
    return { ok: false, message: '转写服务暂未配置。旧版控制台请同时设置 VOLCENGINE_APP_ID 和 VOLCENGINE_ACCESS_TOKEN。' };
  }

  return { ok: false, message: '转写服务暂未配置。旧版控制台请设置 VOLCENGINE_APP_ID 和 VOLCENGINE_ACCESS_TOKEN；新版控制台请设置 VOLCENGINE_API_KEY。' };
}

function volcengineHeaders({ auth, taskId, sequence }) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Resource-Id': 'volc.seedasr.auc',
    'X-Api-Request-Id': taskId
  };
  if (sequence) headers['X-Api-Sequence'] = sequence;
  if (auth.mode === 'legacy') {
    headers['X-Api-App-Key'] = auth.appId;
    headers['X-Api-Access-Key'] = auth.accessToken;
  } else {
    headers['X-Api-Key'] = auth.apiKey;
  }
  return headers;
}

async function submitVolcengineTask({ auth, videoUrl }) {
  const taskId = crypto.randomUUID();
  const submitUrl = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit';

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: volcengineHeaders({ auth, taskId, sequence: '-1' }),
    body: JSON.stringify({
      user: { uid: taskId },
      audio: { format: 'mp4', url: videoUrl },
      request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true }
    })
  });

  if (!submitResponse.ok) {
    const status = submitResponse.headers.get('X-Api-Status-Code') || submitResponse.status;
    const message = submitResponse.headers.get('X-Api-Message') || '提交任务失败';
    throw new Error(`火山ASR提交失败：${message}（状态码：${status}）`);
  }

  return taskId;
}

function getVideoLinks(data) {
  const detail = data?.aweme_detail || data?.itemInfo?.itemStruct || data?.note || data || {};
  const video = detail.video || data?.video || {};
  const links = [];
  if (video.play_addr?.url_list?.length) links.push(...video.play_addr.url_list);
  if (video.download_addr?.url_list?.length) links.push(...video.download_addr.url_list);
  if (detail.video_url) links.push(detail.video_url);
  if (data?.video_url) links.push(data.video_url);
  if (data?.videos?.items?.length) {
    const sorted = [...data.videos.items].sort((a, b) => Number(b.hasAudio) - Number(a.hasAudio));
    links.push(...sorted.map((item) => item.url));
  }
  return [...new Set(links)].filter(Boolean);
}

function getDurationSeconds(data) {
  const detail = data?.aweme_detail || data?.itemInfo?.itemStruct || data?.note || data || {};
  const video = detail.video || data?.video || {};
  const candidates = [
    data?.lengthSeconds, data?.durationSeconds, data?.duration, data?.duration_sec,
    data?.durationMs, data?.duration_ms, detail?.lengthSeconds, detail?.durationSeconds,
    detail?.duration, detail?.duration_sec, detail?.durationMs, detail?.duration_ms,
    video?.duration, video?.duration_ms, video?.durationMs, video?.lengthSeconds,
    data?.videos?.items?.[0]?.lengthMs
  ];
  for (const value of candidates) {
    const seconds = normalizeDurationSeconds(value);
    if (seconds > 0) return seconds;
  }
  return 0;
}

function normalizeDurationSeconds(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^\d+(?::\d+){1,2}$/.test(text)) {
      return text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
    }
    const numeric = Number(text.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(numeric)) return 0;
    return numeric > 10000 ? numeric / 1000 : numeric;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 10000 ? numeric / 1000 : numeric;
}

function getSubtitleLinks(data) {
  const items = data?.subtitles?.items || data?.subtitle?.items || data?.captions?.items || [];
  return items.map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean);
}

async function fetchSubtitleText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' }
  });
  if (!response.ok) return '';
  const raw = await response.text();
  return parseSubtitleText(raw);
}

function parseSubtitleText(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  try {
    const payload = JSON.parse(text);
    const events = payload.events || payload.body?.events || [];
    const lines = events
      .flatMap((event) => event.segs || event.segments || [])
      .map((seg) => seg.utf8 || seg.text || '')
      .join('')
      .split(/\n+/)
      .map(cleanSubtitleLine)
      .filter(Boolean);
    if (lines.length) return dedupeLines(lines).join('\n');
  } catch {}
  const xmlLines = [...text.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)]
    .map((match) => cleanSubtitleLine(decodeEntities(match[1])))
    .filter(Boolean);
  if (xmlLines.length) return dedupeLines(xmlLines).join('\n');
  return cleanSubtitleLine(decodeEntities(text));
}

function cleanSubtitleLine(value) {
  return decodeEntities(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function dedupeLines(lines) {
  const output = [];
  for (const line of lines) {
    if (line && line !== output[output.length - 1]) output.push(line);
  }
  return output;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function getPublishedText(data) {
  return data?.description || data?.desc || data?.caption || data?.aweme_detail?.desc || data?.itemInfo?.itemStruct?.desc || data?.note?.desc || '';
}

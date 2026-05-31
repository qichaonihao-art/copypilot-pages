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
      status: error?.status || null,
      contentType: error?.contentType || null,
      responsePreview: error?.responsePreview || null
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

  const mode = String(body.mode || '').trim() || 'precise';

  if (mode === 'fast') {
    return await handleFastTranscribe(context, { sourceData, publishedText, sourceUrl: url, directVideoUrl, quota });
  }

  const media = await pickBestTranscribeMedia(sourceData);
  if (!media?.url) return json({ ok: false, message: '已解析作品信息，但所有音视频链接均无法访问（可能被平台限制）。建议下载视频后使用「本地视频转文字」功能。', data: sourceData }, 502);

  if (!volcengineAuth.ok) return json({ ok: false, message: volcengineAuth.message, data: sourceData }, 500);

  const taskId = await submitVolcengineTask({ auth: volcengineAuth, mediaUrl: media.url, mediaFormat: media.format });

  const data = { ...sourceData, publishedText, taskId, transcriptStatus: 'pending', transcriptMediaFormat: media.format };
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

async function submitVolcengineTask({ auth, mediaUrl, mediaFormat }) {
  const taskId = crypto.randomUUID();
  const submitUrl = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit';

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: volcengineHeaders({ auth, taskId, sequence: '-1' }),
    body: JSON.stringify({
      user: { uid: taskId },
      audio: { format: mediaFormat, url: mediaUrl },
      request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true }
    })
  });

  const apiStatus = submitResponse.headers.get('X-Api-Status-Code') || '';
  const apiMessage = submitResponse.headers.get('X-Api-Message') || '';
  if (!submitResponse.ok || (apiStatus && apiStatus !== '20000000')) {
    const responseText = await submitResponse.text();
    const error = new Error(`火山ASR提交失败：${apiMessage || submitResponse.statusText || '提交任务失败'}（状态码：${apiStatus || submitResponse.status}）`);
    error.upstreamUrl = submitUrl;
    error.status = apiStatus || submitResponse.status;
    error.contentType = submitResponse.headers.get('Content-Type') || submitResponse.headers.get('content-type') || '';
    error.responsePreview = responseText.slice(0, 300);
    throw error;
  }

  return taskId;
}

async function pickBestTranscribeMedia(data) {
  // 优先尝试音频（体积小，火山引擎下载更快）
  const audioLinks = getAudioLinks(data);
  for (const url of audioLinks.slice(0, 4)) {
    const accessible = await checkMediaUrlAccessible(url);
    if (accessible) return { url, format: getMediaFormat(url, 'mp3') };
  }

  // 音频都不可用，fallback 到视频
  const videoLinks = getVideoLinks(data);
  for (const url of videoLinks.slice(0, 5)) {
    const accessible = await checkMediaUrlAccessible(url);
    if (accessible) return { url, format: getMediaFormat(url, 'mp4') };
  }

  return null;
}

async function checkMediaUrlAccessible(url) {
  try {
    const headRes = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    });
    if (headRes.ok) return true;
    // 405 = Method Not Allowed，某些CDN不支持HEAD，用Range GET兜底
    if (headRes.status === 405) {
      const rangeRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'Range': 'bytes=0-0',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*'
        }
      });
      return rangeRes.ok || rangeRes.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

function getAudioLinks(data) {
  const detail = data?.aweme_detail || data?.itemInfo?.itemStruct || data?.note || data || {};
  const links = [
    data?.audio_url,
    data?.audioUrl,
    data?.audio?.url,
    data?.audio?.src,
    detail?.audio_url,
    detail?.audioUrl,
    detail?.audio?.url,
    detail?.audio?.src
  ];
  links.push(...findAudioUrlsDeep(data));
  return [...new Set(links.map(normalizeMediaUrl).filter(isSupportedAudioUrl))];
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

function findAudioUrlsDeep(value, path = '', depth = 0) {
  if (!value || depth > 6) return [];
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && /audio/i.test(path)) return [value];
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findAudioUrlsDeep(item, `${path}.${index}`, depth + 1));
  }
  if (typeof value !== 'object') return [];

  const links = [];
  for (const [key, child] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (/music|cover|avatar|image|thumb|poster/i.test(nextPath)) continue;
    links.push(...findAudioUrlsDeep(child, nextPath, depth + 1));
  }
  return links;
}

function normalizeMediaUrl(url) {
  return String(url || '').replace(/\\u002F/g, '/').trim();
}

function isSupportedAudioUrl(url) {
  const format = getMediaFormat(url, '');
  return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'mp4'].includes(format);
}

function getMediaFormat(url, fallback) {
  const clean = normalizeMediaUrl(url).split('?')[0].toLowerCase();
  const match = clean.match(/\.([a-z0-9]+)$/);
  const ext = match?.[1] || '';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'mp4'].includes(ext)) return ext;
  return fallback;
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

async function handleFastTranscribe(context, { sourceData, publishedText, sourceUrl, directVideoUrl, quota }) {
  const { env } = context;
  const apiKey = env.SILICONFLOW_API_KEY;
  const model = env.SILICONFLOW_TRANSCRIBE_MODEL || 'FunAudioLLM/SenseVoiceSmall';
  if (!apiKey) {
    return json({ ok: false, message: '快速转写服务暂未配置（缺少 SILICONFLOW_API_KEY）。' }, 500);
  }

  // 直接取第一个视频URL（不预检，和原作者保持一致）
  const videoUrl = directVideoUrl || getVideoLinks(sourceData)[0];
  if (!videoUrl) {
    return json({ ok: false, message: '已解析作品信息，但没有拿到可转写的视频源。' }, 502);
  }

  try {
    // 直接下载视频
    const mediaResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        Referer: 'https://www.douyin.com/'
      }
    });

    if (!mediaResponse.ok) {
      return json({
        ok: false,
        message: '视频源下载失败，暂时无法转写视频本身文案。',
        status: mediaResponse.status,
        data: sourceData
      }, 502);
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const contentLength = mediaResponse.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_FILE_SIZE) {
      return json({
        ok: false,
        message: `视频文件约 ${Math.round(Number(contentLength) / 1024 / 1024)}MB，超过快速提取上限（20MB），请使用「精确提取」模式或选择更短的视频。`
      }, 413);
    }

    const mediaBlob = await mediaResponse.blob();

    if (mediaBlob.size > MAX_FILE_SIZE) {
      return json({
        ok: false,
        message: `视频文件 ${Math.round(mediaBlob.size / 1024 / 1024)}MB 超过快速提取上限（20MB），请使用「精确提取」模式或选择更短的视频。`
      }, 413);
    }

    const transcriptPayload = await transcribeBlob({
      apiKey,
      model,
      blob: mediaBlob,
      filename: 'source-video.mp4'
    });

    const data = {
      ...sourceData,
      text: transcriptPayload.text || '',
      transcript: transcriptPayload.text || '',
      publishedText,
      transcriptSource: 'siliconflow-fast'
    };
    await recordUsage(context, quota, {
      action: 'extract',
      sourceUrl: sourceUrl || directVideoUrl,
      resultTitle: publishedText || sourceData?.title || null
    });
    const headers = quota.setCookie ? { 'Set-Cookie': quota.setCookie } : {};

    return json({ ok: true, data }, 200, headers);
  } catch (error) {
    return json({ ok: false, message: error.message || '快速提取失败，建议切换「精确提取」模式。' }, 502);
  }
}

async function transcribeBlob({ apiKey, model, blob, filename }) {
  const form = new FormData();
  form.set('model', model);
  form.set('file', new File([blob], filename, { type: blob.type || 'video/mp4' }));

  const response = await fetch('https://api.siliconflow.cn/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error?.message || '视频转写失败。');
  }

  return {
    text: payload.text || payload.data?.text || '',
    raw: payload
  };
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

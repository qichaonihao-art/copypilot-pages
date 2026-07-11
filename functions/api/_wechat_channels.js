import { json } from './_tikhub.js';

export const COOKIE_KEY = 'WECHAT_SPH_COOKIE';
export const COOKIE_UPDATED_AT_KEY = 'WECHAT_SPH_COOKIE_UPDATED_AT';
export const COOKIE_LAST_TEST_AT_KEY = 'WECHAT_SPH_COOKIE_LAST_TEST_AT';
export const COOKIE_LAST_TEST_RESULT_KEY = 'WECHAT_SPH_COOKIE_LAST_TEST_RESULT';

const YUANBAO_PARSE_URL = 'https://yuanbao.tencent.com/api/weixin/get_parse_result';
const WECHAT_FEED_INFO_URL = 'https://channels.weixin.qq.com/finder-preview/api/feed/get_feed_info';

export function getConfigKv(env) {
  return env.CONFIG_KV || null;
}

export function isWechatChannelUrl(value) {
  return /^https?:\/\/[^/\s]*weixin\.qq\.com\/sph\//i.test(String(value || '').trim());
}

export function maskCookie(cookie) {
  const text = String(cookie || '').trim();
  if (!text) return '';
  if (text.length <= 18) return `${text.slice(0, 4)}...${text.slice(-4)}`;
  return `${text.slice(0, 10)}...${text.slice(-8)}`;
}

export async function getStoredWechatCookie(env) {
  const kv = getConfigKv(env);
  if (!kv) return { ok: false, error: 'CONFIG_KV_MISSING', message: 'CONFIG_KV 未绑定，无法读取视频号解析 Cookie。' };
  const cookie = await kv.get(COOKIE_KEY);
  if (!cookie?.trim()) {
    return {
      ok: false,
      error: 'WECHAT_COOKIE_MISSING',
      message: '视频号解析 Cookie 未配置，请进入系统配置页面填写腾讯元宝 Cookie'
    };
  }
  return { ok: true, cookie };
}

export async function getWechatCookieStatus(env) {
  const kv = getConfigKv(env);
  if (!kv) {
    return {
      ok: true,
      configured: false,
      storageConfigured: false,
      message: 'CONFIG_KV 未绑定。'
    };
  }

  const [cookie, updatedAt, lastTestAt, lastTestResult] = await Promise.all([
    kv.get(COOKIE_KEY),
    kv.get(COOKIE_UPDATED_AT_KEY),
    kv.get(COOKIE_LAST_TEST_AT_KEY),
    kv.get(COOKIE_LAST_TEST_RESULT_KEY)
  ]);

  return {
    ok: true,
    configured: Boolean(cookie?.trim()),
    storageConfigured: true,
    updatedAt: updatedAt || null,
    preview: cookie ? maskCookie(cookie) : '',
    lastTestAt: lastTestAt || null,
    lastTestResult: lastTestResult || null
  };
}

export async function saveWechatCookie(env, cookie) {
  const kv = getConfigKv(env);
  if (!kv) throw makeWechatError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法保存视频号解析 Cookie。', 500);
  const value = String(cookie || '').trim();
  if (!value || value.length < 20 || !value.includes('=')) {
    throw makeWechatError('WECHAT_COOKIE_INVALID', 'Cookie 格式不完整，请重新从腾讯元宝复制完整 Cookie。', 400);
  }
  const updatedAt = new Date().toISOString();
  await Promise.all([
    kv.put(COOKIE_KEY, value),
    kv.put(COOKIE_UPDATED_AT_KEY, updatedAt),
    kv.put(COOKIE_LAST_TEST_RESULT_KEY, '未测试')
  ]);
  return { updatedAt, preview: maskCookie(value) };
}

export async function parseWechatChannelByStoredCookie(env, url) {
  const cookieResult = await getStoredWechatCookie(env);
  if (!cookieResult.ok) throw makeWechatError(cookieResult.error, cookieResult.message, cookieResult.error === 'CONFIG_KV_MISSING' ? 500 : 400);
  return parseWechatChannel({ url, cookie: cookieResult.cookie });
}

export async function parseWechatChannel({ url, cookie }) {
  const shareUrl = String(url || '').trim();
  if (!shareUrl) throw makeWechatError('URL_MISSING', '缺少视频号链接。', 400);
  if (!isWechatChannelUrl(shareUrl)) {
    throw makeWechatError('WECHAT_URL_INVALID', '不是有效的微信视频号分享链接，请粘贴 weixin.qq.com/sph/ 开头的链接。', 400);
  }
  if (!String(cookie || '').trim()) {
    throw makeWechatError('WECHAT_COOKIE_MISSING', '视频号解析 Cookie 未配置，请进入系统配置页面填写腾讯元宝 Cookie', 400);
  }

  const parseData = await parseShareUrl(shareUrl, cookie);
  const playableUrl = String(parseData.playable_url || parseData.playableUrl || '');
  let generalToken = '';
  let exportId = String(parseData.wx_export_id || parseData.wxExportId || '');

  try {
    const parsedPlayable = new URL(playableUrl);
    generalToken = parsedPlayable.searchParams.get('token') || '';
    exportId = parsedPlayable.searchParams.get('eid') || exportId;
  } catch {
    // The next validation emits a clear error.
  }

  if (!generalToken || !exportId) {
    throw makeWechatError('YUANBAO_PARSE_FAILED', '元宝接口未返回有效的视频号 token/eid，请检查 Cookie 是否过期。', 502);
  }

  const feedResult = await getFeedInfo(exportId, generalToken);
  const normalized = normalizeWechatResult(feedResult, parseData);
  if (!normalized.videoUrl && !normalized.originVideoUrl) {
    throw makeWechatError('WECHAT_VIDEO_MISSING', '已解析到视频号信息，但没有找到可播放的视频地址。', 502);
  }
  return normalized;
}

export async function recordWechatCookieTest(env, ok, message) {
  const kv = getConfigKv(env);
  if (!kv) return;
  await Promise.all([
    kv.put(COOKIE_LAST_TEST_AT_KEY, new Date().toISOString()),
    kv.put(COOKIE_LAST_TEST_RESULT_KEY, ok ? `成功：${message || 'Cookie 可用'}` : `失败：${message || 'Cookie 不可用'}`)
  ]);
}

export function errorResponse(error) {
  const status = error?.status || 500;
  return json({
    ok: false,
    error: error?.code || 'WECHAT_CHANNEL_ERROR',
    message: error?.message || '微信视频号解析失败。'
  }, status);
}

function makeWechatError(code, message, status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

async function parseShareUrl(shareUrl, cookie) {
  const response = await fetchWithTimeout(YUANBAO_PARSE_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'content-type': 'application/json',
      origin: 'https://yuanbao.tencent.com',
      referer: 'https://yuanbao.tencent.com/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      'x-language': 'zh-CN',
      'x-platform': 'mac',
      'x-requested-with': 'XMLHttpRequest',
      'x-source': 'web',
      cookie
    },
    body: JSON.stringify({ type: 'video_channel_url', url: shareUrl, scene: 1 })
  });

  const payload = await readJsonOrThrow(response, 'YUANBAO_PARSE_FAILED', '元宝接口没有返回 JSON。');
  if (response.status === 401 || response.status === 403) {
    throw makeWechatError('WECHAT_COOKIE_EXPIRED', '腾讯元宝 Cookie 可能已过期，请进入系统配置页面重新填写。', 401);
  }
  if (!response.ok) {
    throw makeWechatError('YUANBAO_PARSE_FAILED', `元宝接口请求失败，状态码：${response.status}。`, 502);
  }

  const data = payload?.data || {};
  if (!data.wx_export_id || !data.playable_url) {
    const msg = String(payload?.msg || payload?.message || '');
    if (/login|cookie|登录|授权|过期|无效/i.test(msg)) {
      throw makeWechatError('WECHAT_COOKIE_EXPIRED', '腾讯元宝 Cookie 可能已过期，请进入系统配置页面重新填写。', 401);
    }
    throw makeWechatError('YUANBAO_PARSE_FAILED', '元宝接口未解析出视频号播放信息。', 502);
  }
  return data;
}

async function getFeedInfo(exportId, generalToken) {
  const rid = generateRid();
  const apiUrl = `${WECHAT_FEED_INFO_URL}?_rid=${encodeURIComponent(rid)}&_pageUrl=https:%2F%2Fchannels.weixin.qq.com%2Ffinder-preview%2Fpages%2Ffeed`;
  const referer = `https://channels.weixin.qq.com/finder-preview/pages/feed?entry_card_type=48&comment_scene=39&appid=0&token=${encodeURIComponent(generalToken)}&entry_scene=0&eid=${encodeURIComponent(exportId)}`;
  const response = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Content-Type': 'application/json',
      Origin: 'https://channels.weixin.qq.com',
      Referer: referer,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({ baseReq: { generalToken }, exportId })
  });

  const payload = await readJsonOrThrow(response, 'WECHAT_PREVIEW_FAILED', '视频号 preview 接口没有返回 JSON。');
  if (!response.ok) {
    throw makeWechatError('WECHAT_PREVIEW_FAILED', `视频号 preview 接口请求失败，状态码：${response.status}。`, 502);
  }
  if (payload?.errCode && Number(payload.errCode) !== 0) {
    throw makeWechatError('WECHAT_PREVIEW_FAILED', payload?.errMsg || `视频号 preview 接口返回错误：${payload.errCode}`, 502);
  }
  return payload;
}

function normalizeWechatResult(feedResult, parseData = {}) {
  const data = feedResult?.data || {};
  const feed = data.feedInfo || data.feedinfo || {};
  const author = data.authorInfo || data.authorinfo || {};
  const videoUrl = feed.videoUrl || feed.videourl || feed.h264VideoInfo?.videoUrl || feed.h264videoinfo?.videourl || feed.h265VideoInfo?.videoUrl || feed.h265videoinfo?.videourl || parseData.playable_url || '';
  const originVideoUrl = cleanVideoUrl(feed.originVideoUrl || feed.originVideoUrl || videoUrl);
  const description = feed.description || parseData.desc || '';

  return {
    platform: 'wechat_channels',
    title: cleanTitle(description) || parseData.desc || '微信视频号视频',
    description,
    desc: description,
    author: author.nickname || parseData.author || '',
    authorAvatar: author.headImgUrl || author.headimgurl || parseData.author_icon || '',
    cover: feed.coverUrl || feed.coverurl || parseData.cover_url || '',
    videoUrl,
    originVideoUrl: originVideoUrl || videoUrl,
    raw: feedResult
  };
}

function cleanVideoUrl(videoUrl) {
  try {
    const parsed = new URL(videoUrl);
    const encfilekey = parsed.searchParams.get('encfilekey');
    const token = parsed.searchParams.get('token');
    if (!encfilekey || !token) return videoUrl || '';
    return `${parsed.origin}${parsed.pathname}?encfilekey=${encodeURIComponent(encfilekey)}&token=${encodeURIComponent(token)}`;
  } catch {
    return videoUrl || '';
  }
}

function cleanTitle(value) {
  return String(value || '')
    .split(/[#\n\r]/)[0]
    .replace(/^[\s"“”'‘’]+|[\s"“”'‘’]+$/g, '')
    .replace(/[，,。；;！!？?]$/, '')
    .slice(0, 80);
}

function generateRid() {
  const timestampHex = Math.floor(Date.now() / 1000).toString(16);
  const randomHex = Array.from({ length: 8 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  return `${timestampHex}-${randomHex}`;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw makeWechatError('WECHAT_UPSTREAM_TIMEOUT', '视频号解析上游接口请求超时。', 504);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonOrThrow(response, code, message) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw makeWechatError(code, `${message} 状态码：${response.status}；响应前 200 字：${text.slice(0, 200)}`, 502);
  }
}

const SHARED_VIDEO_PREFIX = 'SHARED_VIDEO:';
const SHARED_VIDEO_INDEX_KEY = 'SHARED_VIDEO_INDEX';
const MAX_SHARED_ITEMS = 80;
const MAX_RECORD_BYTES = 700 * 1024;
const FALLBACK_TITLE = '视频素材';

export function makeSharedError(code, message, status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function sharedErrorResponse(error, json) {
  return json({
    ok: false,
    error: error?.code || 'SHARED_VIDEO_ERROR',
    message: error?.message || '共享视频服务异常。'
  }, error?.status || 500);
}

export function getSharedKv(env) {
  return env.CONFIG_KV || null;
}

export function makeShareId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function sharedVideoKey(id) {
  return `${SHARED_VIDEO_PREFIX}${id}`;
}

export function toShareSummary(record) {
  return {
    id: record.id,
    title: buildSharedTitle(record),
    description: record.description || '',
    author: record.author || '',
    cover: record.cover || pickSharedCover(record.result),
    platform: record.platform || '',
    sourceUrl: record.sourceUrl || '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasTranscript: Boolean(record.result?.transcript || record.transcript)
  };
}

export function normalizeSharedSourceUrl(value) {
  const normalized = normalizeSharedUrl(value);
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return normalized.replace(/#.*$/, '').replace(/\/$/, '');
  }
}

function cleanSharedTitle(value) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"“”'‘’]+|[\s"“”'‘’]+$/g, '')
    .trim();
  if (!text || text === '未命名视频') return '';
  return text
    .split(/[\n\r]/)[0]
    .replace(/[，,。；;！!？?]$/, '')
    .slice(0, 80);
}

function descriptionTitle(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const withoutTags = text
    .replace(/#[^\s#，,。；;！!？?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const candidate = withoutTags || text.replace(/^#+/, '');
  return cleanSharedTitle(candidate);
}

function buildSharedTitle(record) {
  return (
    cleanSharedTitle(record.title) ||
    descriptionTitle(record.description) ||
    cleanSharedTitle(record.result?.title) ||
    descriptionTitle(record.result?.description || record.result?.desc || record.result?.caption || record.result?.text) ||
    (record.author ? `${record.author}的视频` : FALLBACK_TITLE)
  );
}

function normalizeSharedUrl(value) {
  const url = String(value || '').trim();
  if (!/^https?:\/\//i.test(url)) return '';
  if (url.startsWith('http://')) return `https://${url.slice(7)}`;
  return url;
}

function pickSharedImage(value) {
  if (!value) return '';
  if (typeof value === 'string') return normalizeSharedUrl(value);
  if (typeof value !== 'object') return '';
  const direct = value.url || value.src || value.urlDefault || value.urlPre || value.data_src || value.dataSrc;
  if (direct) return normalizeSharedUrl(direct);
  if (Array.isArray(value.url_list) && value.url_list[0]) return normalizeSharedUrl(value.url_list[0]);
  if (Array.isArray(value.urlList) && value.urlList[0]) return normalizeSharedUrl(value.urlList[0]);
  if (Array.isArray(value.infoList) && value.infoList[0]?.url) return normalizeSharedUrl(value.infoList[0].url);
  if (Array.isArray(value.display_image?.url_list) && value.display_image.url_list[0]) {
    return normalizeSharedUrl(value.display_image.url_list[0]);
  }
  return '';
}

function pickSharedCover(result) {
  if (!result || typeof result !== 'object') return '';
  const detail = result.noteCard || result.note || result.aweme_detail || result.itemInfo?.itemStruct || result.data || result;
  const candidates = [
    result.cover,
    result.coverUrl,
    result.cover_url,
    result.thumbnail,
    result.thumbnailUrl,
    result.poster,
    detail?.cover,
    detail?.coverUrl,
    detail?.cover_url,
    detail?.thumbnail,
    detail?.thumbnailUrl,
    detail?.poster,
    detail?.video?.cover,
    detail?.video?.origin_cover,
    detail?.video?.dynamic_cover
  ];

  for (const candidate of candidates) {
    const url = pickSharedImage(candidate);
    if (url) return url;
  }
  return findSharedImageDeep(result);
}

function findSharedImageDeep(input) {
  const queue = [input];
  const seen = new Set();
  const skipKey = /avatar|headimg|head_img|profile|author/i;

  while (queue.length) {
    const item = queue.shift();
    if (!item) continue;
    if (typeof item === 'string') {
      const url = normalizeSharedUrl(item);
      if (url && /\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$/i.test(url)) return url;
      if (url && /mmbiz|qpic|wx_fmt|xhscdn|rednote|douyinpic|douyincdn/i.test(url)) return url;
      continue;
    }
    if (typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);

    const picked = pickSharedImage(item);
    if (picked) return picked;
    for (const [key, value] of Object.entries(item)) {
      if (skipKey.test(key)) continue;
      if (value && (typeof value === 'object' || typeof value === 'string')) queue.push(value);
    }
  }
  return '';
}

export async function readSharedIndex(kv) {
  const raw = await kv.get(SHARED_VIDEO_INDEX_KEY);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export async function writeSharedIndex(kv, items) {
  const deduped = [];
  const seen = new Set();
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
    if (deduped.length >= MAX_SHARED_ITEMS) break;
  }
  await kv.put(SHARED_VIDEO_INDEX_KEY, JSON.stringify(deduped));
  return deduped;
}

export async function createSharedVideo(env, input) {
  const kv = getSharedKv(env);
  if (!kv) throw makeSharedError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法保存共享视频。', 500);

  const sourceUrl = normalizeSharedSourceUrl(input.sourceUrl || input.result?.sourceUrl || '');
  const index = await readSharedIndex(kv);
  if (sourceUrl) {
    const existingSummary = index.find((item) => normalizeSharedSourceUrl(item.sourceUrl) === sourceUrl);
    if (existingSummary?.id) {
      try {
        return { record: await getSharedVideo(env, existingSummary.id), duplicate: true };
      } catch {
        return { record: existingSummary, duplicate: true };
      }
    }
  }

  const now = new Date().toISOString();
  const id = makeShareId();
  const record = {
    id,
    title: String(input.title || '').trim().slice(0, 120),
    description: String(input.description || '').trim().slice(0, 500),
    author: String(input.author || '').trim().slice(0, 80),
    cover: String(input.cover || '').trim(),
    platform: String(input.platform || '').trim(),
    sourceUrl,
    result: input.result && typeof input.result === 'object' ? input.result : {},
    createdAt: now,
    updatedAt: now
  };
  record.title = buildSharedTitle(record);
  record.cover = record.cover || pickSharedCover(record.result);

  const payload = JSON.stringify(record);
  if (payload.length > MAX_RECORD_BYTES) {
    throw makeSharedError('SHARED_VIDEO_TOO_LARGE', '共享内容过大，暂时无法保存。', 413);
  }

  await kv.put(sharedVideoKey(id), payload);
  await writeSharedIndex(kv, [toShareSummary(record), ...index]);
  return { record, duplicate: false };
}

export async function listSharedVideos(env) {
  const kv = getSharedKv(env);
  if (!kv) throw makeSharedError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法读取共享视频。', 500);
  const index = await readSharedIndex(kv);
  const enriched = await Promise.all(index.map(async (item) => {
    if (item.cover && item.title && item.title !== '未命名视频') return item;
    try {
      const raw = await kv.get(sharedVideoKey(item.id));
      if (!raw) return item;
      return toShareSummary(JSON.parse(raw));
    } catch {
      return item;
    }
  }));
  await writeSharedIndex(kv, enriched);
  return enriched;
}

export async function getSharedVideo(env, id) {
  const kv = getSharedKv(env);
  if (!kv) throw makeSharedError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法读取共享视频。', 500);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw makeSharedError('SHARED_VIDEO_ID_MISSING', '缺少共享视频 ID。', 400);
  const raw = await kv.get(sharedVideoKey(cleanId));
  if (!raw) throw makeSharedError('SHARED_VIDEO_NOT_FOUND', '没有找到这个共享视频，可能已被删除或链接不正确。', 404);
  try {
    return JSON.parse(raw);
  } catch {
    throw makeSharedError('SHARED_VIDEO_BROKEN', '共享视频数据异常。', 500);
  }
}

export async function deleteSharedVideo(env, id) {
  const kv = getSharedKv(env);
  if (!kv) throw makeSharedError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法删除共享视频。', 500);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw makeSharedError('SHARED_VIDEO_ID_MISSING', '缺少共享视频 ID。', 400);

  await kv.delete(sharedVideoKey(cleanId));
  const index = await readSharedIndex(kv);
  await writeSharedIndex(kv, index.filter((item) => item.id !== cleanId));
  return { id: cleanId };
}

export async function updateSharedVideoTranscript(env, id, input) {
  const kv = getSharedKv(env);
  if (!kv) throw makeSharedError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法更新共享视频。', 500);
  const record = await getSharedVideo(env, id);
  const transcript = String(input.transcript || input.text || '').trim();
  if (!transcript) throw makeSharedError('TRANSCRIPT_MISSING', '缺少可保存的逐字稿。', 400);

  const now = new Date().toISOString();
  record.result = {
    ...(record.result || {}),
    ...(input.result && typeof input.result === 'object' ? input.result : {}),
    transcript,
    text: transcript
  };
  record.title = buildSharedTitle(record);
  record.cover = record.cover || pickSharedCover(record.result);
  record.updatedAt = now;

  const payload = JSON.stringify(record);
  if (payload.length > MAX_RECORD_BYTES) {
    throw makeSharedError('SHARED_VIDEO_TOO_LARGE', '共享内容过大，暂时无法更新。', 413);
  }

  await kv.put(sharedVideoKey(record.id), payload);
  const index = await readSharedIndex(kv);
  await writeSharedIndex(kv, index.map((item) => item.id === record.id ? toShareSummary(record) : item));
  return record;
}

export async function updateSharedVideoTitle(env, id, input) {
  const kv = getSharedKv(env);
  if (!kv) throw makeSharedError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法更新共享视频。', 500);
  const record = await getSharedVideo(env, id);
  const title = String(input.title || '').trim().slice(0, 120);
  if (!title) throw makeSharedError('TITLE_MISSING', '标题不能为空。', 400);

  record.title = title;
  record.updatedAt = new Date().toISOString();

  const payload = JSON.stringify(record);
  if (payload.length > MAX_RECORD_BYTES) {
    throw makeSharedError('SHARED_VIDEO_TOO_LARGE', '共享内容过大，暂时无法更新。', 413);
  }

  await kv.put(sharedVideoKey(record.id), payload);
  const index = await readSharedIndex(kv);
  await writeSharedIndex(kv, index.map((item) => item.id === record.id ? toShareSummary(record) : item));
  return record;
}

export async function updateSharedVideoResult(env, id, input) {
  const kv = getSharedKv(env);
  if (!kv) throw makeSharedError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法更新共享视频。', 500);
  const record = await getSharedVideo(env, id);
  if (!input?.result || typeof input.result !== 'object') {
    throw makeSharedError('RESULT_MISSING', '缺少重新解析后的视频结果。', 400);
  }

  const now = new Date().toISOString();
  record.result = {
    ...(record.result || {}),
    ...input.result,
    ...(record.result?.transcript ? { transcript: record.result.transcript, text: record.result.text || record.result.transcript } : {})
  };
  record.title = buildSharedTitle(record);
  const refreshedCover = pickSharedCover(record.result);
  record.cover = refreshedCover || record.cover || '';
  record.updatedAt = now;

  const payload = JSON.stringify(record);
  if (payload.length > MAX_RECORD_BYTES) {
    throw makeSharedError('SHARED_VIDEO_TOO_LARGE', '共享内容过大，暂时无法更新。', 413);
  }

  await kv.put(sharedVideoKey(record.id), payload);
  const index = await readSharedIndex(kv);
  await writeSharedIndex(kv, index.map((item) => item.id === record.id ? toShareSummary(record) : item));
  return record;
}

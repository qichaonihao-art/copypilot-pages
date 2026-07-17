const SHARED_VIDEO_PREFIX = 'SHARED_VIDEO:';
const SHARED_VIDEO_INDEX_KEY = 'SHARED_VIDEO_INDEX';
const MAX_SHARED_ITEMS = 80;
const MAX_RECORD_BYTES = 700 * 1024;

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
    title: record.title || '未命名视频',
    description: record.description || '',
    author: record.author || '',
    cover: record.cover || '',
    platform: record.platform || '',
    sourceUrl: record.sourceUrl || '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasTranscript: Boolean(record.result?.transcript || record.transcript)
  };
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

  const now = new Date().toISOString();
  const id = makeShareId();
  const record = {
    id,
    title: String(input.title || '').trim().slice(0, 120) || '未命名视频',
    description: String(input.description || '').trim().slice(0, 500),
    author: String(input.author || '').trim().slice(0, 80),
    cover: String(input.cover || '').trim(),
    platform: String(input.platform || '').trim(),
    sourceUrl: String(input.sourceUrl || '').trim(),
    result: input.result && typeof input.result === 'object' ? input.result : {},
    createdAt: now,
    updatedAt: now
  };

  const payload = JSON.stringify(record);
  if (payload.length > MAX_RECORD_BYTES) {
    throw makeSharedError('SHARED_VIDEO_TOO_LARGE', '共享内容过大，暂时无法保存。', 413);
  }

  await kv.put(sharedVideoKey(id), payload);
  const index = await readSharedIndex(kv);
  await writeSharedIndex(kv, [toShareSummary(record), ...index]);
  return record;
}

export async function listSharedVideos(env) {
  const kv = getSharedKv(env);
  if (!kv) throw makeSharedError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法读取共享视频。', 500);
  return readSharedIndex(kv);
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

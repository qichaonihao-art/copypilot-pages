const PROFIT_SHARE_PREFIX = 'PROFIT_SHARE:';
const PROFIT_SHARE_INDEX_KEY = 'PROFIT_SHARE_INDEX';
const MAX_PROFIT_SHARES = 100;
const MAX_PROFIT_SHARE_BYTES = 180 * 1024;

export function makeProfitShareError(code, message, status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function profitShareErrorResponse(error, json) {
  return json({
    ok: false,
    error: error?.code || 'PROFIT_SHARE_ERROR',
    message: error?.message || 'ROI 数据共享服务异常。'
  }, error?.status || 500);
}

function getKv(env) {
  return env.CONFIG_KV || null;
}

function shareKey(id) {
  return `${PROFIT_SHARE_PREFIX}${id}`;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function readIndex(kv) {
  const raw = await kv.get(PROFIT_SHARE_INDEX_KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function writeIndex(kv, items) {
  const unique = [];
  const ids = new Set();
  for (const item of items) {
    if (!item?.id || ids.has(item.id)) continue;
    ids.add(item.id);
    unique.push(item);
    if (unique.length >= MAX_PROFIT_SHARES) break;
  }
  await kv.put(PROFIT_SHARE_INDEX_KEY, JSON.stringify(unique));
  return unique;
}

function summary(record) {
  return {
    id: record.id,
    title: record.title || 'ROI 测算记录',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    orderCount: record.form?.orderCount ?? '',
    currentGmv: record.form?.currentGrossGmv ?? '',
    adjustedGmv: record.form?.adjustedGrossGmv ?? '',
    currentProfit: record.current?.profit ?? 0,
    adjustedProfit: record.adjusted?.profit ?? 0
  };
}

function validateRecordInput(input) {
  if (!input || typeof input !== 'object') {
    throw makeProfitShareError('BAD_REQUEST', 'ROI 共享数据格式不正确。', 400);
  }
  if (!input.form || typeof input.form !== 'object') {
    throw makeProfitShareError('FORM_MISSING', '缺少 ROI 输入数据。', 400);
  }
}

export async function createProfitShare(env, input) {
  const kv = getKv(env);
  if (!kv) throw makeProfitShareError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法保存 ROI 共享数据。', 500);
  validateRecordInput(input);

  const now = new Date().toISOString();
  const record = {
    id: makeId(),
    title: String(input.title || 'ROI 测算记录').trim().slice(0, 80) || 'ROI 测算记录',
    form: input.form,
    current: input.current && typeof input.current === 'object' ? input.current : {},
    adjusted: input.adjusted && typeof input.adjusted === 'object' ? input.adjusted : {},
    delta: input.delta && typeof input.delta === 'object' ? input.delta : {},
    createdAt: now,
    updatedAt: now
  };
  const payload = JSON.stringify(record);
  if (payload.length > MAX_PROFIT_SHARE_BYTES) {
    throw makeProfitShareError('PROFIT_SHARE_TOO_LARGE', '这套 ROI 数据过大，暂时无法保存。', 413);
  }

  const index = await readIndex(kv);
  await kv.put(shareKey(record.id), payload);
  await writeIndex(kv, [summary(record), ...index]);
  return record;
}

export async function listProfitShares(env) {
  const kv = getKv(env);
  if (!kv) throw makeProfitShareError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法读取 ROI 共享数据。', 500);
  const index = await readIndex(kv);
  return index;
}

export async function getProfitShare(env, id) {
  const kv = getKv(env);
  if (!kv) throw makeProfitShareError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法读取 ROI 共享数据。', 500);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw makeProfitShareError('PROFIT_SHARE_ID_MISSING', '缺少 ROI 共享记录 ID。', 400);
  const raw = await kv.get(shareKey(cleanId));
  if (!raw) throw makeProfitShareError('PROFIT_SHARE_NOT_FOUND', '没有找到这条 ROI 共享记录。', 404);
  try {
    return JSON.parse(raw);
  } catch {
    throw makeProfitShareError('PROFIT_SHARE_BROKEN', 'ROI 共享记录数据异常。', 500);
  }
}

export async function deleteProfitShare(env, id) {
  const kv = getKv(env);
  if (!kv) throw makeProfitShareError('CONFIG_KV_MISSING', 'CONFIG_KV 未绑定，无法删除 ROI 共享数据。', 500);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw makeProfitShareError('PROFIT_SHARE_ID_MISSING', '缺少 ROI 共享记录 ID。', 400);
  await kv.delete(shareKey(cleanId));
  const index = await readIndex(kv);
  await writeIndex(kv, index.filter((item) => item.id !== cleanId));
  return { id: cleanId };
}

export { summary as toProfitShareSummary };

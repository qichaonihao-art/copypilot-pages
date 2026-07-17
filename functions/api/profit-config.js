import { json } from './_tikhub.js';
import {
  DEFAULT_PROFIT_CONFIG,
  PROFIT_CONFIG_KEY,
  normalizeProfitConfig,
  validateProfitConfig
} from './_profit_config.js';

export async function onRequestGet(context) {
  const kv = context.env.CONFIG_KV;
  if (!kv) {
    return json({
      ok: true,
      storageConfigured: false,
      config: DEFAULT_PROFIT_CONFIG,
      message: 'CONFIG_KV 未绑定，公式配置只能使用默认值。'
    });
  }

  const raw = await kv.get(PROFIT_CONFIG_KEY);
  let saved = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }

  return json({
    ok: true,
    storageConfigured: true,
    config: normalizeProfitConfig(saved || DEFAULT_PROFIT_CONFIG)
  });
}

export async function onRequestPut(context) {
  const kv = context.env.CONFIG_KV;
  if (!kv) {
    return json({ ok: false, message: 'CONFIG_KV 未绑定，无法保存公式配置。' }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, message: '请求格式不正确。' }, 400);
  }

  const validated = validateProfitConfig(body?.config || {});
  if (!validated.ok) {
    return json({ ok: false, message: validated.errors.join('；'), errors: validated.errors }, 400);
  }

  const config = {
    ...validated.config,
    updatedAt: new Date().toISOString()
  };
  await kv.put(PROFIT_CONFIG_KEY, JSON.stringify(config));
  return json({ ok: true, message: 'ROI 公式已保存。', config });
}

export async function onRequestDelete(context) {
  const kv = context.env.CONFIG_KV;
  if (!kv) {
    return json({ ok: false, message: 'CONFIG_KV 未绑定，无法恢复默认公式。' }, 500);
  }
  await kv.delete(PROFIT_CONFIG_KEY);
  return json({ ok: true, message: '已恢复默认公式。', config: DEFAULT_PROFIT_CONFIG });
}

import { json } from '../_tikhub.js';
import {
  createProfitShare,
  listProfitShares,
  profitShareErrorResponse,
  toProfitShareSummary
} from '../_profit_shares.js';

export async function onRequestGet(context) {
  try {
    return json({ ok: true, items: await listProfitShares(context.env) });
  } catch (error) {
    return profitShareErrorResponse(error, json);
  }
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'BAD_REQUEST', message: '请求格式不正确。' }, 400);
  }

  try {
    const record = await createProfitShare(context.env, body || {});
    return json({ ok: true, message: 'ROI 数据已保存到共享库。', item: toProfitShareSummary(record), record });
  } catch (error) {
    return profitShareErrorResponse(error, json);
  }
}

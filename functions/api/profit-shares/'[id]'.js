import { json } from '../_tikhub.js';
import {
  deleteProfitShare,
  getProfitShare,
  profitShareErrorResponse,
  toProfitShareSummary
} from '../_profit_shares.js';

export async function onRequestGet(context) {
  try {
    const record = await getProfitShare(context.env, context.params.id);
    return json({ ok: true, item: toProfitShareSummary(record), record });
  } catch (error) {
    return profitShareErrorResponse(error, json);
  }
}

export async function onRequestDelete(context) {
  try {
    return json({ ok: true, deleted: await deleteProfitShare(context.env, context.params.id) });
  } catch (error) {
    return profitShareErrorResponse(error, json);
  }
}

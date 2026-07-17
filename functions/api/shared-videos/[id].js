import { json } from '../_tikhub.js';
import {
  getSharedVideo,
  sharedErrorResponse,
  toShareSummary,
  updateSharedVideoTranscript
} from '../_shared_videos.js';

export async function onRequestGet(context) {
  try {
    const record = await getSharedVideo(context.env, context.params.id);
    return json({ ok: true, item: toShareSummary(record), record });
  } catch (error) {
    return sharedErrorResponse(error, json);
  }
}

export async function onRequestPatch(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'BAD_REQUEST', message: '请求格式不正确。' }, 400);
  }

  try {
    const record = await updateSharedVideoTranscript(context.env, context.params.id, body || {});
    return json({ ok: true, item: toShareSummary(record), record });
  } catch (error) {
    return sharedErrorResponse(error, json);
  }
}

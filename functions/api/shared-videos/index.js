import { json } from '../_tikhub.js';
import {
  createSharedVideo,
  listSharedVideos,
  sharedErrorResponse,
  toShareSummary
} from '../_shared_videos.js';

export async function onRequestGet(context) {
  try {
    const items = await listSharedVideos(context.env);
    return json({ ok: true, items });
  } catch (error) {
    return sharedErrorResponse(error, json);
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
    const record = await createSharedVideo(context.env, body || {});
    return json({
      ok: true,
      item: toShareSummary(record),
      shareUrl: `/share/${record.id}`,
      record
    });
  } catch (error) {
    return sharedErrorResponse(error, json);
  }
}

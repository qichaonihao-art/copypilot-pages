import { json } from '../_tikhub.js';
import { errorResponse, requireAdminPassword, saveWechatCookie } from '../_wechat_channels.js';

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'BAD_REQUEST', message: '请求格式不正确。' }, 400);
  }

  try {
    requireAdminPassword(context.env, body?.adminPassword);
    const saved = await saveWechatCookie(context.env, body?.cookie);
    return json({
      ok: true,
      message: '保存成功，视频号解析 Cookie 已更新。',
      configured: true,
      updatedAt: saved.updatedAt,
      preview: saved.preview
    });
  } catch (error) {
    return errorResponse(error);
  }
}

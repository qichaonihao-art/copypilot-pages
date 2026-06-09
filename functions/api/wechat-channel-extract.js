import { json } from './_tikhub.js';
import { recordUsage, requireQuota } from './_auth.js';
import { errorResponse, parseWechatChannelByStoredCookie } from './_wechat_channels.js';

export async function onRequestPost(context) {
  const { request } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'BAD_REQUEST', message: '请求格式不正确。' }, 400);
  }

  const url = String(body?.url || '').trim();
  if (!url) return json({ ok: false, error: 'URL_MISSING', message: '缺少视频号链接。' }, 400);

  const quota = await requireQuota(context, 'extract');
  if (!quota.ok) return json({ ok: false, message: quota.message, needLogin: quota.status === 401 }, quota.status);

  try {
    const data = await parseWechatChannelByStoredCookie(context.env, url);
    await recordUsage(context, quota, {
      action: 'extract',
      sourceUrl: url,
      resultTitle: data.title || data.description || null
    });
    const headers = quota.setCookie ? { 'Set-Cookie': quota.setCookie } : {};
    return json({ ok: true, data }, 200, headers);
  } catch (error) {
    return errorResponse(error);
  }
}

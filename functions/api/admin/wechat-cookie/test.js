import { json } from '../../_tikhub.js';
import {
  errorResponse,
  getStoredWechatCookie,
  parseWechatChannel,
  recordWechatCookieTest,
  requireAdminPassword
} from '../../_wechat_channels.js';

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'BAD_REQUEST', message: '请求格式不正确。' }, 400);
  }

  try {
    requireAdminPassword(context.env, body?.adminPassword);
    const cookieResult = await getStoredWechatCookie(context.env);
    if (!cookieResult.ok) {
      const error = new Error(cookieResult.message);
      error.code = cookieResult.error;
      error.status = cookieResult.error === 'CONFIG_KV_MISSING' ? 500 : 400;
      throw error;
    }

    const url = String(body?.url || '').trim();
    if (!url) {
      await recordWechatCookieTest(context.env, true, '已配置，未执行链接解析测试');
      return json({ ok: true, message: '已配置，未执行链接解析测试。', tested: false });
    }

    const data = await parseWechatChannel({ url, cookie: cookieResult.cookie });
    await recordWechatCookieTest(context.env, true, '测试成功，当前 Cookie 可用');
    return json({
      ok: true,
      message: '测试成功，当前 Cookie 可用。',
      tested: true,
      sample: {
        title: data.title,
        author: data.author,
        hasVideo: Boolean(data.videoUrl || data.originVideoUrl)
      }
    });
  } catch (error) {
    await recordWechatCookieTest(context.env, false, error?.message || 'Cookie 不可用');
    return errorResponse(error);
  }
}

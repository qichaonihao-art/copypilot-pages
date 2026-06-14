import { signAccessToken } from '../_middleware.js';
import { authJson, serializeCookie } from './_auth.js';

const ACCESS_COOKIE = 'copypilot_access';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ACCESS_PASSWORD) {
    return authJson({ ok: false, message: '站点未配置访问密码。' }, 503);
  }

  let body = {};
  const contentType = request.headers.get('Content-Type') || '';
  try {
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const form = await request.formData();
      body = {
        password: form.get('password'),
        redirect: form.get('redirect')
      };
    }
  } catch {
    return authJson({ ok: false, message: '请求格式错误。' }, 400);
  }

  const inputPassword = String(body.password || '').trim();
  if (inputPassword !== env.ACCESS_PASSWORD) {
    return authJson({ ok: false, message: '密码错误，请重试。' }, 401);
  }

  const token = await signAccessToken(env);
  const cookie = serializeCookie(ACCESS_COOKIE, token, {
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
  });

  const redirectPath = normalizeRedirect(body.redirect);

  // 兼容表单 POST：直接重定向并设置 Cookie。
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectPath,
        'Set-Cookie': cookie
      }
    });
  }

  return authJson(
    { ok: true, message: '验证成功。', redirect: redirectPath },
    200,
    { 'Set-Cookie': cookie }
  );
}

export async function onRequestGet(context) {
  return authJson({ ok: false, message: '请使用 POST 提交密码。' }, 405);
}

function normalizeRedirect(value) {
  const path = String(value || '/').trim();
  if (!path.startsWith('/')) return '/';
  // 避免开放重定向到外部站点。
  if (/^\/\/|https?:/i.test(path)) return '/';
  return path;
}

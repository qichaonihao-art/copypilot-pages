import { authJson, serializeCookie } from './_auth.js';

const ACCESS_COOKIE = 'copypilot_access';

export async function onRequestPost(context) {
  const clearedCookie = serializeCookie(ACCESS_COOKIE, '', {
    maxAge: 0,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
  });

  return authJson(
    { ok: true, message: '访问验证已清除。' },
    200,
    { 'Set-Cookie': clearedCookie }
  );
}

export async function onRequestGet(context) {
  return authJson({ ok: false, message: '请使用 POST 清除验证状态。' }, 405);
}

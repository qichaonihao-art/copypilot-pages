import { parseCookies, serializeCookie, signSession, verifySession } from './api/_auth.js';

const ACCESS_COOKIE = 'copypilot_access';
const MONTH_SECONDS = 30 * 24 * 60 * 60;

const PUBLIC_PATHS = new Set([
  '/api/login',
  '/api/logout',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap.txt'
]);

const PUBLIC_EXTENSIONS = new Set([
  '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf', '.json', '.xml', '.txt', '.map'
]);

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const accessPassword = env.ACCESS_PASSWORD;

  // 如果没有设置访问密码，保持现有行为不变，避免意外锁定站点。
  if (!accessPassword) {
    return next();
  }

  if (isPublicPath(url.pathname)) {
    return next();
  }

  const cookies = parseCookies(request);
  const accessToken = cookies[ACCESS_COOKIE];
  const isAuthenticated = await verifyAccessToken(accessToken, env);

  if (isAuthenticated) {
    return next();
  }

  // API 请求未登录时返回 401 JSON，方便前端统一处理。
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({ ok: false, message: '请先输入访问密码登录。' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 页面请求未登录时返回登录页。
  return renderLoginPage(request, url.pathname);
}

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  const lastSegment = pathname.split('/').pop() || '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex > 0) {
    const ext = lastSegment.slice(dotIndex).toLowerCase();
    if (PUBLIC_EXTENSIONS.has(ext)) return true;
  }
  return false;
}

async function verifyAccessToken(token, env) {
  if (!token) return false;
  const sessionSecret = env.SESSION_SECRET || 'dev-session-secret-change-me';
  try {
    const payload = await verifySession(token, sessionSecret);
    return payload?.access === true;
  } catch {
    return false;
  }
}

export async function signAccessToken(env) {
  const sessionSecret = env.SESSION_SECRET || 'dev-session-secret-change-me';
  const now = Math.floor(Date.now() / 1000);
  return signSession({ access: true, iat: now, exp: now + MONTH_SECONDS }, sessionSecret);
}

function renderLoginPage(request, redirectPath) {
  const safeRedirect = encodeHtml(redirectPath || '/');
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>访问验证 - CopyPilot</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #f0f4ff 0%, #eef2ff 100%);
      color: #1f2937;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 400px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(37, 99, 235, 0.12);
      padding: 40px 32px;
      text-align: center;
    }
    .logo {
      width: 56px;
      height: 56px;
      background: #2563eb;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 20px;
    }
    h1 { margin: 0 0 8px; font-size: 22px; font-weight: 700; }
    p { margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6; }
    form { text-align: left; }
    label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #374151; }
    input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input[type="password"]:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }
    button {
      width: 100%;
      margin-top: 20px;
      padding: 12px 16px;
      border: none;
      border-radius: 10px;
      background: #2563eb;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #1d4ed8; }
    button:active { transform: translateY(1px); }
    .message {
      display: none;
      margin-top: 16px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 13px;
      text-align: center;
    }
    .message.error { display: block; background: #fef2f2; color: #991b1b; }
    .message.success { display: block; background: #f0fdf4; color: #166534; }
    .hint { margin-top: 20px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">CP</div>
    <h1>访问验证</h1>
    <p>该页面仅供内部使用，请输入访问密码后继续。</p>
    <form method="POST" action="/api/login">
      <input type="hidden" name="redirect" value="${safeRedirect}" />
      <label for="password">访问密码</label>
      <input id="password" name="password" type="password" placeholder="请输入密码" autocomplete="current-password" required autofocus />
      <button type="submit">进入 CopyPilot</button>
      <div id="message" class="message"></div>
    </form>
    <p class="hint">验证通过后 30 天内无需再次输入。</p>
  </div>
  <script>
    const messageEl = document.getElementById('message');
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      messageEl.textContent = decodeURIComponent(error);
      messageEl.className = 'message error';
    }
    document.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      messageEl.className = 'message';
      messageEl.textContent = '';
      const form = e.target;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: form.password.value,
            redirect: form.redirect.value
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          messageEl.textContent = data.message || '验证成功，正在跳转...';
          messageEl.className = 'message success';
          window.location.href = data.redirect || '/';
          return;
        }
        messageEl.textContent = data.message || '密码错误，请重试。';
        messageEl.className = 'message error';
      } catch (err) {
        messageEl.textContent = '网络异常，请稍后重试。';
        messageEl.className = 'message error';
      }
    });
  </script>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function encodeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

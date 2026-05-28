import { json } from './_tikhub.js';

function getAuth(env) {
  const apiKey = String(env.VOLCENGINE_API_KEY || '').trim();
  if (apiKey) return { ok: true, mode: 'apiKey', apiKey };

  const useLegacy = String(env.VOLCENGINE_USE_LEGACY || '').trim() === 'true';
  if (useLegacy) {
    const appId = String(env.VOLCENGINE_APP_ID || '').trim();
    const token = String(env.VOLCENGINE_ACCESS_TOKEN || '').trim();
    if (appId && token) return { ok: true, mode: 'legacy', appId, accessToken: token };
  }

  return { ok: false, message: '转写服务暂未配置。请在 Cloudflare Pages 环境变量中设置 VOLCENGINE_API_KEY。' };
}

function makeHeaders(auth, taskId) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Resource-Id': 'volc.seedasr.auc',
    'X-Api-Request-Id': taskId
  };
  if (auth.mode === 'legacy') {
    headers['X-Api-App-Key'] = auth.appId;
    headers['X-Api-Access-Key'] = auth.accessToken;
  } else {
    headers['X-Api-Key'] = auth.apiKey;
  }
  return headers;
}

export async function onRequestGet() {
  return json({ ok: true, message: "transcribe-query alive, use POST" });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const auth = getAuth(env);
    if (!auth.ok) return json({ ok: false, message: auth.message }, 500);

    let body;
    try { body = await request.json(); } catch { return json({ ok: false, message: '请求格式不正确。' }, 400); }

    const taskId = String(body.taskId || '').trim();
    if (!taskId) return json({ ok: false, message: '缺少 taskId。' }, 400);

    const res = await fetch('https://openspeech.bytedance.com/api/v3/auc/bigmodel/query', {
      method: 'POST',
      headers: makeHeaders(auth, taskId),
      body: '{}'
    });

    if (!res.ok) return json({ ok: false, message: `火山查询失败：${res.status}` }, 502);

    let payload;
    try { payload = await res.json(); } catch { return json({ ok: false, message: '火山返回解析失败。' }, 502); }

    const statusCode = res.headers.get('X-Api-Status-Code');
    if (statusCode === '20000001' || statusCode === '20000002') {
      return json({ ok: true, status: 'processing' });
    }

    const text = payload?.result?.text || payload?.text || '';
    if (text) return json({ ok: true, status: 'completed', transcript: String(text).trim() });

    const utterances = payload?.result?.utterances || [];
    if (Array.isArray(utterances) && utterances.length) {
      const combined = utterances.map((u) => u?.text || '').filter(Boolean).join('\n').trim();
      if (combined) return json({ ok: true, status: 'completed', transcript: combined });
    }

    if (statusCode && !String(statusCode).startsWith('2')) {
      return json({ ok: false, message: `火山ASR处理失败：${statusCode}` }, 502);
    }

    return json({ ok: true, status: 'processing' });
  } catch (error) {
    return json({ ok: false, message: error?.message || String(error) }, 500);
  }
}

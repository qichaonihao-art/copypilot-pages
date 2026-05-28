import { json } from './_tikhub.js';

export async function onRequestGet() {
  return json({ ok: true, step: "alive" });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    let body;
    try { body = await request.json(); } catch { return json({ ok: false, message: 'bad request' }, 400); }

    const taskId = String(body.taskId || '').trim();
    if (!taskId) return json({ ok: false, message: 'missing taskId' }, 400);

    const apiKey = String(env.VOLCENGINE_API_KEY || '').trim();
    if (!apiKey) return json({ ok: false, message: 'no volcengine key' }, 500);

    // Just test reaching Volcengine with a query
    const res = await fetch('https://openspeech.bytedance.com/api/v3/auc/bigmodel/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': 'volc.seedasr.auc',
        'X-Api-Request-Id': taskId
      },
      body: '{}'
    });

    return json({ ok: true, step: "fetch ok", status: res.status });
  } catch (error) {
    return json({ ok: false, message: error?.message || String(error) }, 500);
  }
}

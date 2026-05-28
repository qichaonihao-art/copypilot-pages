import { json } from './_tikhub.js';
import { getVolcengineAuth, volcengineHeaders, readVolcengineTranscript } from './_volcengine.js';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const auth = getVolcengineAuth(env);
    if (!auth.ok) return json({ ok: false, message: auth.message }, 500);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, message: '请求格式不正确。' }, 400);
    }

    const taskId = String(body.taskId || '').trim();
    if (!taskId) return json({ ok: false, message: '缺少 taskId。' }, 400);

    const queryUrl = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query';
    const queryResponse = await fetch(queryUrl, {
      method: 'POST',
      headers: volcengineHeaders({ auth, taskId }),
      body: JSON.stringify({})
    });

    if (!queryResponse.ok) {
      return json({ ok: false, message: `火山查询失败：HTTP ${queryResponse.status}` }, 502);
    }

    let payload;
    try {
      payload = await queryResponse.json();
    } catch {
      return json({ ok: false, message: '火山返回数据解析失败。' }, 502);
    }

    const statusCode = queryResponse.headers.get('X-Api-Status-Code');
    if (statusCode === '20000001' || statusCode === '20000002') {
      return json({ ok: true, status: 'processing' });
    }

    const transcript = readVolcengineTranscript(payload);
    if (transcript) {
      return json({ ok: true, status: 'completed', transcript });
    }

    if (statusCode && !String(statusCode).startsWith('2')) {
      return json({ ok: false, message: `火山ASR处理失败：状态码 ${statusCode}` }, 502);
    }

    return json({ ok: true, status: 'processing' });
  } catch (error) {
    return json({ ok: false, message: error?.message || String(error) }, 500);
  }
}

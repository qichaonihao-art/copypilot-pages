import { json } from './_tikhub.js';

const DEFAULT_TIMEOUT_MS = 8 * 60 * 1000;

export async function onRequestGet() {
  return json({ ok: true, message: 'aliyun-transcribe-link alive, use POST' });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const upstreamUrl = String(env.ALIYUN_TRANSCRIBE_API_URL || '').trim();
  const token = String(env.ALIYUN_TRANSCRIBE_TOKEN || '').trim();

  if (!upstreamUrl) {
    return json({ ok: false, message: '阿里云逐字稿接口暂未配置。请设置 ALIYUN_TRANSCRIBE_API_URL。' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: '请求格式不正确。' }, 400);
  }

  const url = String(body.url || '').trim();
  if (!url) return json({ ok: false, message: '缺少作品链接。' }, 400);

  const controller = new AbortController();
  const timeoutMs = Number(env.ALIYUN_TRANSCRIBE_TIMEOUT_MS || 0) || DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        ...body,
        stream: false,
        source: 'copypilot-pages'
      })
    });

    const contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || '';
    const responseText = await response.text();
    const responsePreview = responseText.slice(0, 300);

    if (!contentType.toLowerCase().includes('application/json')) {
      return json({
        ok: false,
        message: '阿里云逐字稿接口没有返回 JSON。',
        upstreamUrl,
        status: response.status,
        contentType,
        responsePreview
      }, 502);
    }

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      return json({
        ok: false,
        message: `阿里云逐字稿接口 JSON 解析失败：${error?.message || String(error)}`,
        upstreamUrl,
        status: response.status,
        contentType,
        responsePreview
      }, 502);
    }

    if (!response.ok || !payload.ok) {
      return json({
        ...payload,
        ok: false,
        message: payload?.message || '阿里云逐字稿提取失败。',
        upstreamUrl,
        status: response.status
      }, response.ok ? 502 : response.status);
    }

    return json(payload);
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    return json({
      ok: false,
      message: aborted
        ? `阿里云逐字稿接口超时（${Math.round(timeoutMs / 1000)}秒），请稍后重试。`
        : `阿里云逐字稿接口请求失败：${error?.message || String(error)}`,
      upstreamUrl,
      status: aborted ? 504 : 502
    }, aborted ? 504 : 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

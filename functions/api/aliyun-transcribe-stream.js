const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, message: 'aliyun-transcribe-stream alive, use POST' }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const upstreamUrl = String(env.ALIYUN_TRANSCRIBE_API_URL || '').trim();
  const token = String(env.ALIYUN_TRANSCRIBE_TOKEN || '').trim();

  if (!upstreamUrl) {
    return jsonError('阿里云逐字稿接口暂未配置。请设置 ALIYUN_TRANSCRIBE_API_URL。', 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('请求格式不正确。', 400);
  }

  const url = String(body.url || '').trim();
  if (!url) return jsonError('缺少作品链接。', 400);

  const controller = new AbortController();
  const timeoutMs = Number(env.ALIYUN_TRANSCRIBE_TIMEOUT_MS || 0) || DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        ...body,
        stream: true,
        source: 'copypilot-pages'
      })
    });

    const contentType = upstream.headers.get('Content-Type') || upstream.headers.get('content-type') || '';
    if (!upstream.ok || !contentType.toLowerCase().includes('text/event-stream') || !upstream.body) {
      const responseText = await upstream.text();
      return jsonError('阿里云流式逐字稿接口不可用。', upstream.ok ? 502 : upstream.status, {
        upstreamUrl,
        status: upstream.status,
        contentType,
        responsePreview: responseText.slice(0, 300)
      });
    }

    const stream = new ReadableStream({
      start(clientController) {
        const reader = upstream.body.getReader();
        const pump = () => reader.read().then(({ done, value }) => {
          if (done) {
            clearTimeout(timeoutId);
            clientController.close();
            return;
          }
          clientController.enqueue(value);
          return pump();
        }).catch((error) => {
          clearTimeout(timeoutId);
          clientController.error(error);
        });
        return pump();
      },
      cancel() {
        clearTimeout(timeoutId);
        controller.abort();
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  } catch (error) {
    clearTimeout(timeoutId);
    const aborted = error?.name === 'AbortError';
    return jsonError(
      aborted
        ? `阿里云逐字稿接口超时（${Math.round(timeoutMs / 1000)}秒），请稍后重试。`
        : `阿里云逐字稿接口请求失败：${error?.message || String(error)}`,
      aborted ? 504 : 502,
      { upstreamUrl, status: aborted ? 504 : 502 }
    );
  }
}

function jsonError(message, status = 500, extra = {}) {
  return new Response(JSON.stringify({ ok: false, message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

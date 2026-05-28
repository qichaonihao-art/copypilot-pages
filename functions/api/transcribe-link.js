export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, message: "alive" }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // Step 1: parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, message: '请求格式不正确。' }, 400);
    }

    const url = String(body.url || '').trim();
    if (!url) {
      return jsonResponse({ ok: false, message: '缺少作品链接。' }, 400);
    }

    return jsonResponse({ ok: true, message: 'body parsed', url });

  } catch (error) {
    return jsonResponse({ ok: false, message: error?.message || String(error) }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

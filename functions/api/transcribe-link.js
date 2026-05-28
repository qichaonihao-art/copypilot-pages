export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, message: "alive" }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

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

    const tikhubKey = env.TIKHUB_API_KEY;
    const tikhubBaseUrl = env.TIKHUB_BASE_URL || 'https://api.tikhub.io';

    // Call TikHub
    const tikhubRes = await fetch(
      `${tikhubBaseUrl}/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(url)}`,
      { headers: { Authorization: `Bearer ${tikhubKey}` } }
    );

    return jsonResponse({
      ok: true,
      message: 'TikHub called',
      tikhubStatus: tikhubRes.status,
      tikhubOk: tikhubRes.ok
    });

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

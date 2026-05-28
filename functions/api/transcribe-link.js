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

    const tikhubData = await tikhubRes.json().catch(() => null);

    // Extract video URL
    const detail = tikhubData?.data?.aweme_detail || tikhubData?.aweme_detail || {};
    const video = detail.video || {};
    const videoUrl = video.play_addr?.url_list?.[0] || video.download_addr?.url_list?.[0] || detail.video_url;

    return jsonResponse({
      ok: true,
      message: 'video extracted',
      hasVideoUrl: Boolean(videoUrl),
      videoUrl: videoUrl ? videoUrl.slice(0, 80) : null
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

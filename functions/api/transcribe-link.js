export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, message: "transcribe-link alive" }), {
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

    // Step 2: check env
    const tikhubKey = env.TIKHUB_API_KEY;
    const volcengineKey = env.VOLCENGINE_API_KEY;

    if (!tikhubKey) {
      return jsonResponse({ ok: false, message: 'TikHub 未配置' }, 500);
    }
    if (!volcengineKey) {
      return jsonResponse({ ok: false, message: '火山引擎未配置' }, 500);
    }

    // Step 3: extract via TikHub
    const tikhubRes = await fetch(`${env.TIKHUB_BASE_URL || 'https://api.tikhub.io'}/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${tikhubKey}` }
    });

    if (!tikhubRes.ok) {
      return jsonResponse({ ok: false, message: 'TikHub 解析失败' }, 502);
    }

    const sourceData = await tikhubRes.json();

    // Step 4: get video URL
    const detail = sourceData?.data?.aweme_detail || sourceData?.aweme_detail || {};
    const video = detail.video || {};
    const videoUrl = video.play_addr?.url_list?.[0] || video.download_addr?.url_list?.[0] || detail.video_url;

    if (!videoUrl) {
      return jsonResponse({ ok: false, message: '没有拿到视频源' }, 502);
    }

    // Step 5: submit to Volcengine
    const taskId = crypto.randomUUID();
    const submitRes = await fetch('https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': volcengineKey,
        'X-Api-Resource-Id': 'volc.seedasr.auc',
        'X-Api-Request-Id': taskId,
        'X-Api-Sequence': '-1'
      },
      body: JSON.stringify({
        user: { uid: taskId },
        audio: { format: 'mp4', url: videoUrl },
        request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true }
      })
    });

    if (!submitRes.ok) {
      return jsonResponse({ ok: false, message: '火山ASR提交失败' }, 502);
    }

    // Step 6: poll for result
    const maxAttempts = 30;
    const pollInterval = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, pollInterval));

      const queryRes = await fetch('https://openspeech.bytedance.com/api/v3/auc/bigmodel/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': volcengineKey,
          'X-Api-Resource-Id': 'volc.seedasr.auc',
          'X-Api-Request-Id': taskId
        },
        body: '{}'
      });

      if (!queryRes.ok) continue;

      let result;
      try {
        result = await queryRes.json();
      } catch {
        continue;
      }

      const statusCode = queryRes.headers.get('X-Api-Status-Code');
      if (statusCode === '20000001' || statusCode === '20000002') continue;

      if (result?.result?.text) {
        return jsonResponse({
          ok: true,
          data: {
            ...sourceData,
            text: result.result.text,
            transcript: result.result.text,
            publishedText: detail.desc || ''
          }
        });
      }
    }

    return jsonResponse({ ok: false, message: '火山ASR转写超时' }, 504);

  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error?.message || String(error)
    }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

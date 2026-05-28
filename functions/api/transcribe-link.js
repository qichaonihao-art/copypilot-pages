export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, message: "alive" }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  try {
    const { env } = context;
    const volcengineKey = env.VOLCENGINE_API_KEY;

    const taskId = crypto.randomUUID();

    // Test Volcengine submit with a known video URL
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
        audio: {
          format: 'mp4',
          url: 'https://www.w3schools.com/html/mov_bbb.mp4'
        },
        request: { model_name: 'bigmodel' }
      })
    });

    return jsonResponse({
      ok: true,
      message: 'volcengine submitted',
      submitStatus: submitRes.status,
      submitOk: submitRes.ok
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

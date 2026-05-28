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

    // Submit
    await fetch('https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit', {
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
        audio: { format: 'mp4', url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
        request: { model_name: 'bigmodel' }
      })
    });

    // Poll once
    await new Promise(r => setTimeout(r, 1000));
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

    const queryData = await queryRes.json().catch(() => null);

    return jsonResponse({
      ok: true,
      message: 'poll done',
      queryStatus: queryRes.status,
      queryData: queryData ? 'has data' : 'no data'
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

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, message: "alive" }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  try {
    const { env } = context;
    const volcengineKey = env.VOLCENGINE_API_KEY;

    // Test crypto.randomUUID
    const taskId = crypto.randomUUID();

    return jsonResponse({
      ok: true,
      message: 'uuid generated',
      taskId: taskId.slice(0, 8)
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

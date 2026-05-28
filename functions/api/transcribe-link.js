export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, message: "transcribe-link alive" }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true, message: "post received" }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, message: "query alive" }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

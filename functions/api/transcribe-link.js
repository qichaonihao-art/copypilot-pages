import { json } from './_tikhub.js';

export async function onRequestGet() {
  return json({ ok: true, message: "alive" });
}

export async function onRequestPost(context) {
  try {
    return json({ ok: true, message: "import _tikhub works" });
  } catch (error) {
    return json({ ok: false, message: error?.message || String(error) }, 500);
  }
}

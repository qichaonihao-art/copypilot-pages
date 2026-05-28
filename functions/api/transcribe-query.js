import { json } from './_tikhub.js';

export async function onRequestGet() {
  return json({ ok: true, step: "import works" });
}

export async function onRequestPost() {
  return json({ ok: true, step: "post works" });
}

import { json } from './_tikhub.js';
import { requireQuota } from './_auth.js';

export async function onRequestGet() {
  return json({ ok: true, message: "alive" });
}

export async function onRequestPost(context) {
  try {
    const quota = await requireQuota(context, 'extract');
    return json({ ok: true, message: "import _auth works", quotaOk: quota.ok });
  } catch (error) {
    return json({ ok: false, message: error?.message || String(error) }, 500);
  }
}

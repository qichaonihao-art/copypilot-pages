import { json } from './_tikhub.js';
import { requireQuota } from './_auth.js';
import { getDefaultMaxVideoMinutes, getMembershipPlan } from './_plans.js';

export async function onRequestGet() {
  return json({ ok: true, message: "alive" });
}

export async function onRequestPost(context) {
  try {
    const quota = await requireQuota(context, 'extract');
    const plan = quota?.user?.plan;
    let maxMinutes = 5;
    if (context.env.DB && plan && plan !== 'free') {
      try {
        const config = await getMembershipPlan(context.env.DB, plan);
        if (config?.maxVideoMinutes) maxMinutes = config.maxVideoMinutes;
        else maxMinutes = getDefaultMaxVideoMinutes(plan);
      } catch {
        maxMinutes = getDefaultMaxVideoMinutes(plan);
      }
    }
    return json({ ok: true, message: "import _plans works", maxMinutes });
  } catch (error) {
    return json({ ok: false, message: error?.message || String(error) }, 500);
  }
}

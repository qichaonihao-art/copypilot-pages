import { json } from './_tikhub.js';

function getAuth(env) {
  const apiKey = String(env.VOLCENGINE_API_KEY || '').trim();
  const appId = String(env.VOLCENGINE_APP_ID || '').trim();
  const token = String(env.VOLCENGINE_ACCESS_TOKEN || '').trim();

  return {
    apiKeyPresent: Boolean(apiKey),
    appIdPresent: Boolean(appId),
    tokenPresent: Boolean(token),
    apiKeyFirst8: apiKey ? apiKey.slice(0, 8) : '',
    appIdFirst8: appId ? appId.slice(0, 8) : ''
  };
}

export async function onRequestGet() {
  return json({ ok: true, message: "alive" });
}

export async function onRequestPost(context) {
  try {
    const { env } = context;
    const auth = getAuth(env);
    return json({ ok: true, debug: auth });
  } catch (error) {
    return json({ ok: false, message: error?.message || String(error) }, 500);
  }
}

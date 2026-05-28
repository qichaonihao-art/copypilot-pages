import { json } from './_tikhub.js';

export async function onRequestGet(context) {
  const env = context.env || {};
  const volcApiKey = Boolean(env.VOLCENGINE_API_KEY || env.VOLC_API_KEY || env.ARK_API_KEY);
  const volcAppId = Boolean(env.VOLCENGINE_APP_ID || env.VOLCENGINE_APPID || env.VOLCENGINE_APP_KEY || env.VOLC_APP_ID || env.APP_ID || env.APPID);
  const volcAccessToken = Boolean(env.VOLCENGINE_ACCESS_TOKEN || env.VOLCENGINE_ACCESS_KEY || env.VOLCENGINE_TOKEN || env.VOLC_ACCESS_TOKEN || env.ACCESS_TOKEN);

  return json({
    ok: true,
    apiConfigured: Boolean(env.TIKHUB_API_KEY),
    transcribeConfigured: volcApiKey || (volcAppId && volcAccessToken),
    siliconFlowConfigured: Boolean(env.SILICONFLOW_API_KEY),
    volcengineConfigured: volcApiKey || (volcAppId && volcAccessToken),
    volcengineAuthMode: volcApiKey ? 'apiKey' : volcAppId && volcAccessToken ? 'legacy' : 'missing',
    volcengineHasApiKey: volcApiKey,
    volcengineHasAppId: volcAppId,
    volcengineHasAccessToken: volcAccessToken
  });
}

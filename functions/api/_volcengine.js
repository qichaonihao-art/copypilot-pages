export function getVolcengineAuth(env) {
  const apiKey = String(
    env.VOLCENGINE_API_KEY ||
    env.VOLC_API_KEY ||
    env.ARK_API_KEY ||
    ''
  ).trim();
  if (apiKey) return { ok: true, mode: 'apiKey', apiKey };

  const appId = String(
    env.VOLCENGINE_APP_ID ||
    env.VOLCENGINE_APPID ||
    env.VOLCENGINE_APP_KEY ||
    env.VOLC_APP_ID ||
    env.APP_ID ||
    env.APPID ||
    ''
  ).trim();
  const accessToken = String(
    env.VOLCENGINE_ACCESS_TOKEN ||
    env.VOLCENGINE_ACCESS_KEY ||
    env.VOLCENGINE_TOKEN ||
    env.VOLC_ACCESS_TOKEN ||
    env.ACCESS_TOKEN ||
    ''
  ).trim();
  if (appId && accessToken) return { ok: true, mode: 'legacy', appId, accessToken };

  return {
    ok: false,
    message: `转写服务暂未配置完成。新版控制台请配置 VOLCENGINE_API_KEY；旧版控制台请配置 VOLCENGINE_APP_ID 和 VOLCENGINE_ACCESS_TOKEN。当前读取状态：apiKey=${Boolean(apiKey)}，appId=${Boolean(appId)}，accessToken=${Boolean(accessToken)}。`
  };
}

export function volcengineHeaders({ auth, taskId, sequence }) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Resource-Id': 'volc.seedasr.auc',
    'X-Api-Request-Id': taskId
  };
  if (sequence) headers['X-Api-Sequence'] = sequence;
  if (auth.mode === 'legacy') {
    headers['X-Api-App-Key'] = auth.appId;
    headers['X-Api-Access-Key'] = auth.accessToken;
  } else {
    headers['X-Api-Key'] = auth.apiKey;
  }
  return headers;
}

export function readVolcengineTranscript(payload) {
  const text = payload?.result?.text || payload?.text || payload?.data?.result?.text;
  if (text) return String(text).trim();

  const utterances = payload?.result?.utterances || payload?.data?.result?.utterances;
  if (Array.isArray(utterances)) {
    return utterances
      .map((item) => item?.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return '';
}

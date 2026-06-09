import { json } from '../../_tikhub.js';
import { getWechatCookieStatus } from '../../_wechat_channels.js';

export async function onRequestGet(context) {
  const status = await getWechatCookieStatus(context.env);
  return json(status);
}

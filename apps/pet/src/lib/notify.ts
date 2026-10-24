/**
 * 桌面通知：旅行归来/生病/成就解锁时，若页面在后台则发送浏览器通知。
 * 开关存 localStorage `ale-pet-notify`；需先授权（设置里点开关时请求）。
 */

const NOTIFY_KEY = 'ale-pet-notify';

let muted = false;
if (typeof window !== 'undefined') {
  muted = localStorage.getItem(NOTIFY_KEY) === 'off';
}

export function isNotifyMuted(): boolean {
  return muted;
}

/** 开/关通知；开启时请求权限，返回是否可用 */
export async function setNotifyMuted(value: boolean): Promise<boolean> {
  if (!value) {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    }
    if (Notification.permission !== 'granted') return false;
  }
  muted = value;
  try {
    localStorage.setItem(NOTIFY_KEY, value ? 'off' : 'on');
  } catch {
    /* ignore */
  }
  return true;
}

/** 发送通知（仅在已授权 + 未静音 + 页面隐藏时） */
export function notify(title: string, body: string, icon?: string) {
  if (muted || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && !document.hidden) return;
  try {
    new Notification(title, { body, icon, tag: 'gugu' });
  } catch {
    /* 部分环境（如无 SW 的移动端）可能抛错，忽略 */
  }
}

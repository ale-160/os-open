/**
 * Ale OS 系统共享语言 · 无框架内核（不依赖 React）
 *
 * - 键 `ale-os-language`（localStorage）：所有帧读写同一个键；
 * - 跨帧同步：storage 事件（同源 iframe 彼此收到对方帧的变更）；
 * - 同帧同步：写入时派发自定义事件，同一页面里的多个订阅者即时更新。
 *
 * React 应用用 `@os/shared/os-language`（含 useOsLanguage，并原样再导出本模块）；
 * 非 React 应用（如 Vue 的 nchat）直接引 `@os/shared/os-language-core`，
 * 避免把 React 打进产物。
 */

export type OsLanguage = 'zh' | 'en';

/** 全系统共享语言键（localStorage） */
export const OS_LANGUAGE_KEY = 'ale-os-language';

/** 同帧订阅事件（写入者派发，弥补 storage 事件不通知本帧） */
const OS_LANGUAGE_EVENT = 'os-language-change';

function parseLanguage(value: string | null | undefined): OsLanguage | null {
  return value === 'zh' || value === 'en' ? value : null;
}

/** 读取共享语言；无记录或值非法返回 null */
export function readOsLanguage(): OsLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseLanguage(localStorage.getItem(OS_LANGUAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * 写入共享语言。storage 事件只通知其他帧，
 * 本帧订阅者通过自定义事件即时收到。
 */
export function writeOsLanguage(lang: OsLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OS_LANGUAGE_KEY, lang);
  } catch {
    // 隐私模式等场景写入失败可忽略（本帧状态仍由调用方自行维护）
  }
  window.dispatchEvent(new CustomEvent<OsLanguage>(OS_LANGUAGE_EVENT, { detail: lang }));
}

/**
 * 订阅共享语言变更（storage 事件 + 同帧自定义事件）。
 * 回调参数可能为 null（键被移除时）。返回取消订阅函数。
 */
export function subscribeOsLanguage(
  callback: (lang: OsLanguage | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === OS_LANGUAGE_KEY) callback(parseLanguage(event.newValue));
  };
  const onCustom = (event: Event) => {
    callback((event as CustomEvent<OsLanguage>).detail);
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(OS_LANGUAGE_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(OS_LANGUAGE_EVENT, onCustom);
  };
}

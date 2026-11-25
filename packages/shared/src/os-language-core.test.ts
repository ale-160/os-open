// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OS_LANGUAGE_KEY,
  readOsLanguage,
  subscribeOsLanguage,
  writeOsLanguage,
  type OsLanguage,
} from './os-language-core';

/** 模拟其他帧（壳 / 别的 iframe 应用）改写共享键：storage 事件只在「别的」窗口触发，jsdom 里手动派发 */
function dispatchStorageFromOtherFrame(key: string | null, newValue: string | null) {
  window.dispatchEvent(
    new StorageEvent('storage', { key, newValue, oldValue: null, storageArea: localStorage })
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readOsLanguage', () => {
  it('共享键为 ale-os-language', () => {
    expect(OS_LANGUAGE_KEY).toBe('ale-os-language');
  });

  it('无记录返回 null（由调用方决定默认值）', () => {
    expect(readOsLanguage()).toBeNull();
  });

  it('读取合法值 zh / en', () => {
    localStorage.setItem(OS_LANGUAGE_KEY, 'en');
    expect(readOsLanguage()).toBe('en');
    localStorage.setItem(OS_LANGUAGE_KEY, 'zh');
    expect(readOsLanguage()).toBe('zh');
  });

  it('非法值回退为 null', () => {
    for (const bad of ['fr', 'EN', 'zh-CN', '', '"en"']) {
      localStorage.setItem(OS_LANGUAGE_KEY, bad);
      expect(readOsLanguage()).toBeNull();
    }
  });

  it('localStorage 不可用（隐私模式等）时返回 null 而不抛错', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readOsLanguage()).toBeNull();
  });
});

describe('writeOsLanguage', () => {
  it('写入共享键，之后可读回', () => {
    writeOsLanguage('en');
    expect(localStorage.getItem(OS_LANGUAGE_KEY)).toBe('en');
    expect(readOsLanguage()).toBe('en');
  });

  it('写入失败时不抛错，本帧订阅者仍收到通知', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const callback = vi.fn();
    const unsubscribe = subscribeOsLanguage(callback);
    expect(() => writeOsLanguage('en')).not.toThrow();
    expect(callback).toHaveBeenCalledWith('en');
    unsubscribe();
  });
});

describe('subscribeOsLanguage', () => {
  it('同帧写入即时通知（自定义事件，弥补 storage 事件不通知本帧）', () => {
    const received: Array<OsLanguage | null> = [];
    const unsubscribe = subscribeOsLanguage(lang => received.push(lang));
    writeOsLanguage('en');
    writeOsLanguage('zh');
    expect(received).toEqual(['en', 'zh']);
    unsubscribe();
  });

  it('同帧多个订阅者都收到通知', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeOsLanguage(a);
    const offB = subscribeOsLanguage(b);
    writeOsLanguage('en');
    expect(a).toHaveBeenCalledExactlyOnceWith('en');
    expect(b).toHaveBeenCalledExactlyOnceWith('en');
    offA();
    offB();
  });

  it('其他帧改写共享键时经 storage 事件通知', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeOsLanguage(callback);
    dispatchStorageFromOtherFrame(OS_LANGUAGE_KEY, 'en');
    expect(callback).toHaveBeenCalledExactlyOnceWith('en');
    unsubscribe();
  });

  it('storage 事件：非法值与键被移除都回调 null', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeOsLanguage(callback);
    dispatchStorageFromOtherFrame(OS_LANGUAGE_KEY, 'fr');
    dispatchStorageFromOtherFrame(OS_LANGUAGE_KEY, null);
    expect(callback.mock.calls).toEqual([[null], [null]]);
    unsubscribe();
  });

  it('storage 事件：其他键的变更被忽略', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeOsLanguage(callback);
    dispatchStorageFromOtherFrame('web-img-language', 'en');
    dispatchStorageFromOtherFrame(null, null); // 其他帧 localStorage.clear()
    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('取消订阅后不再收到任何通知', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeOsLanguage(callback);
    unsubscribe();
    writeOsLanguage('en');
    dispatchStorageFromOtherFrame(OS_LANGUAGE_KEY, 'zh');
    expect(callback).not.toHaveBeenCalled();
  });
});

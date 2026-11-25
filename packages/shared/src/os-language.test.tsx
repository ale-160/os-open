// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OS_LANGUAGE_KEY, useOsLanguage, type UseOsLanguageOptions } from './os-language';

// 让 React 18+/19 的 act() 在测试环境里同步刷新更新
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HookResult = ReturnType<typeof useOsLanguage>;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** 挂载一个只调用 useOsLanguage 的组件，返回最新一次渲染的结果 */
function renderHook(options?: UseOsLanguageOptions): { current: HookResult } {
  const result = {} as { current: HookResult };
  function Probe() {
    result.current = useOsLanguage(options);
    return null;
  }
  act(() => root.render(<Probe />));
  return result;
}

describe('useOsLanguage', () => {
  it('无任何记录时默认 zh，并发布到共享键', () => {
    const hook = renderHook();
    expect(hook.current.language).toBe('zh');
    expect(hook.current.isMounted).toBe(true);
    expect(localStorage.getItem(OS_LANGUAGE_KEY)).toBe('zh');
  });

  it('共享键已有合法值时沿用', () => {
    localStorage.setItem(OS_LANGUAGE_KEY, 'en');
    expect(renderHook().current.language).toBe('en');
  });

  it('共享键为非法值时回退默认值并改写共享键', () => {
    localStorage.setItem(OS_LANGUAGE_KEY, 'fr');
    const hook = renderHook();
    expect(hook.current.language).toBe('zh');
    expect(localStorage.getItem(OS_LANGUAGE_KEY)).toBe('zh');
  });

  it('defaultLanguage 覆盖默认值', () => {
    expect(renderHook({ defaultLanguage: 'en' }).current.language).toBe('en');
  });

  it('共享键缺失时从旧个人键一次性迁移；共享键优先于旧键', () => {
    localStorage.setItem('web-img-language', 'en');
    const hook = renderHook({ legacyKey: 'web-img-language' });
    expect(hook.current.language).toBe('en');
    expect(localStorage.getItem(OS_LANGUAGE_KEY)).toBe('en');

    act(() => root.unmount());
    root = createRoot(container);
    localStorage.setItem(OS_LANGUAGE_KEY, 'zh');
    expect(renderHook({ legacyKey: 'web-img-language' }).current.language).toBe('zh');
  });

  it('setLanguage / toggleLanguage 写回共享键', () => {
    const hook = renderHook();
    act(() => hook.current.setLanguage('en'));
    expect(hook.current.language).toBe('en');
    expect(localStorage.getItem(OS_LANGUAGE_KEY)).toBe('en');

    let toggled: string | undefined;
    act(() => {
      toggled = hook.current.toggleLanguage();
    });
    expect(toggled).toBe('zh');
    expect(hook.current.language).toBe('zh');
    expect(localStorage.getItem(OS_LANGUAGE_KEY)).toBe('zh');
  });

  it('跟随其他帧的 storage 事件；键被移除（null）时保持当前语言', () => {
    const hook = renderHook();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: OS_LANGUAGE_KEY, newValue: 'en' }));
    });
    expect(hook.current.language).toBe('en');

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: OS_LANGUAGE_KEY, newValue: null }));
    });
    expect(hook.current.language).toBe('en');
  });
});

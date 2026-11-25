// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { readOsLanguage, subscribeOsLanguage, writeOsLanguage } from './os-language-core';

// SSR / 预渲染（Next 服务端、构建期）没有 window：内核必须安全降级为空操作
describe('os-language-core（无 window 环境）', () => {
  it('read 返回 null，write 与 subscribe 不抛错且为空操作', () => {
    expect(typeof window).toBe('undefined');
    expect(readOsLanguage()).toBeNull();
    expect(() => writeOsLanguage('en')).not.toThrow();

    const callback = vi.fn();
    const unsubscribe = subscribeOsLanguage(callback);
    expect(() => unsubscribe()).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });
});

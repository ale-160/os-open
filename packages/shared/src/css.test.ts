import { describe, expect, it } from 'vitest';

import { cn } from './css';

describe('cn', () => {
  it('合并条件类名（clsx 语义：忽略假值、展开数组与对象）', () => {
    expect(cn('px-2', false, null, undefined, ['py-1', { 'text-sm': true, hidden: false }])).toBe(
      'px-2 py-1 text-sm'
    );
  });

  it('Tailwind 冲突类后者覆盖前者（tailwind-merge）', () => {
    expect(cn('px-2 py-1 bg-red-500', 'px-4', { 'bg-blue-500': true })).toBe('py-1 px-4 bg-blue-500');
    expect(cn('p-4', 'px-2')).toBe('p-4 px-2');
    expect(cn('px-2', 'p-4')).toBe('p-4');
  });
});

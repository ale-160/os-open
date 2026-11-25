import { describe, expect, it } from 'vitest';

import { STRINGS_EN, STRINGS_ZH, getStrings } from './i18n';

/** 递归收集对象的叶子键路径（如 gallery.title） */
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? keyPaths(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );
}

/** 文案中的占位符（{count}、{name} …） */
function placeholders(text: string): string[] {
  return (text.match(/\{\w+\}/g) ?? []).sort();
}

describe('壳文案字典', () => {
  it('中英文 key 完整对齐', () => {
    expect(keyPaths(STRINGS_EN).sort()).toEqual(keyPaths(STRINGS_ZH).sort());
  });

  it('系统图库：中英文案非空且占位符一致', () => {
    const zh = STRINGS_ZH.gallery;
    const en = STRINGS_EN.gallery;
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(zh[key].trim(), `zh.gallery.${key}`).not.toBe('');
      expect(en[key].trim(), `en.gallery.${key}`).not.toBe('');
      expect(placeholders(en[key]), `gallery.${key}`).toEqual(placeholders(zh[key]));
    }
    expect(zh.libraryCount.replace('{count}', '3')).toBe('图库（3）');
    expect(en.libraryCount.replace('{count}', '3')).toBe('Library (3)');
  });

  it('系统图库空状态覆盖全部存入来源（图片工具箱 / TypeV / 聊天室）', () => {
    const zhEmpty = [
      STRINGS_ZH.gallery.emptySourceImageToolbox,
      STRINGS_ZH.gallery.emptySourceTypeV,
      STRINGS_ZH.gallery.emptySourceChat
    ].join('\n');
    expect(zhEmpty).toContain('图片工具箱');
    expect(zhEmpty).toContain('文字动画');
    expect(zhEmpty).toContain('P2P 聊天室');

    const enEmpty = [
      STRINGS_EN.gallery.emptySourceImageToolbox,
      STRINGS_EN.gallery.emptySourceTypeV,
      STRINGS_EN.gallery.emptySourceChat
    ].join('\n');
    expect(enEmpty).toContain('Image Toolbox');
    expect(enEmpty).toContain('TypeV');
    expect(enEmpty).toContain('P2P Chat');
  });

  it('getStrings 按语言返回对应字典', () => {
    expect(getStrings('zh').gallery.title).toBe('系统图库');
    expect(getStrings('en').gallery.title).toBe('Gallery');
  });
});

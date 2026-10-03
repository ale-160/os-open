import { describe, expect, it } from 'vitest';

import {
  APP_URL_SCHEME,
  OS_APPS,
  getAppById,
  getAppByPath,
  getAppFromUrl,
  getAppLocalePath
} from './apps';

describe('OS 应用注册表', () => {
  it('id 唯一且路径以 / 开头、以 / 结尾', () => {
    const ids = OS_APPS.map(app => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const app of OS_APPS) {
      expect(app.path.startsWith('/')).toBe(true);
      expect(app.path.endsWith('/')).toBe(true);
    }
  });

  it('按 id 查找应用', () => {
    expect(getAppById('web-img')?.id).toBe('web-img');
    expect(getAppById('not-exist')).toBeNull();
  });

  it(`解析 ${APP_URL_SCHEME} URL`, () => {
    expect(getAppFromUrl('app://web-text')?.id).toBe('web-text');
    expect(getAppFromUrl('app://not-exist')).toBeNull();
    expect(getAppFromUrl('https://example.com')).toBeNull();
    expect(getAppFromUrl('')).toBeNull();
  });

  it('按路径匹配应用（深链接）', () => {
    expect(getAppByPath('/img/')?.id).toBe('web-img');
    expect(getAppByPath('/img/sub/page')?.id).toBe('web-img');
    expect(getAppByPath('/text/')?.id).toBe('web-text');
    expect(getAppByPath('/')).toBeNull();
    expect(getAppByPath('/image-something')).toBeNull();
  });

  it('按壳语言返回应用入口路径（中文为主）', () => {
    const app = getAppById('web-img');
    expect(app).not.toBeNull();
    expect(getAppLocalePath(app!, 'zh')).toBe('/img/zh/');
    expect(getAppLocalePath(app!, 'en')).toBe('/img/');
  });
});

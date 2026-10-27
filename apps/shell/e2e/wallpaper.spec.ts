import { test, expect, Page } from '@playwright/test';
import { dismissWelcome } from './helpers';

/**
 * 壁纸存储优化：本地上传的壁纸存入 IndexedDB 壁纸库，
 * localStorage 配置里只保留 `asset://<id>` 引用（不再内联 base64），
 * 桌面背景通过解析引用正常显示。
 */

// 1x1 PNG
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('上传壁纸写入 IndexedDB，配置只留 asset:// 引用且背景生效', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  // 打开设置面板（默认外观页）
  await page.getByTitle(/设置|Settings/).click();
  const settings = page.getByRole('dialog');
  await expect(settings).toBeVisible();

  await page.locator('#wallpaper-upload').setInputFiles({
    name: 'wallpaper.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_BASE64, 'base64')
  });

  // 配置里的壁纸应是 asset:// 引用，而不是内联 data:
  await expect
    .poll(() =>
      page.evaluate(() => {
        try {
          const raw = localStorage.getItem('hub-nav-config');
          const config = raw ? JSON.parse(raw) : null;
          return config?.theme?.wallpaperUrl ?? '';
        } catch {
          return '';
        }
      })
    )
    .toMatch(/^asset:\/\/wallpaper-/);

  // 桌面背景通过引用解析生效（根容器出现 data: 背景图）
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.querySelector('div.h-screen') as HTMLElement | null;
        return el?.style.background ?? '';
      })
    )
    .toContain('data:image/png');
});

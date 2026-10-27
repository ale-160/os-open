import { test, expect, Page } from '@playwright/test';
import { dismissWelcome } from './helpers';

/**
 * App 窗口（内嵌应用）冒烟：多任务模型——
 * 点击桌面 app:// 图标 → 全屏 iframe 窗口；Home 键 / Esc 只是最小化回桌面
 * （iframe 保活不销毁），运行中的应用出现在桌面 dock，可切回可关闭。
 * e2e 仅起 shell 的静态导出，/img、/text 用路由拦截返回桩页面。
 */

test.beforeEach(async ({ page }) => {
  // 拦截两个内嵌应用的路径，返回可识别的桩页面
  await page.route('**/img/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<html><body id="img-app-stub">IMG APP STUB</body></html>' })
  );
  await page.route('**/text/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<html><body id="text-app-stub">TEXT APP STUB</body></html>' })
  );
});

test('点击 App 图标打开应用窗口并同步 URL', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.locator('[data-icon-item][data-id="icon-app-web-img"]').click();

  const frame = page.locator('[data-os-app-window="web-img"]');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute('data-active', 'true');
  await expect(page.locator('iframe[data-os-app-frame]')).toBeVisible();
  // URL 已 pushState 到应用路径
  await expect(page).toHaveURL(/\/img\/$/);
});

test('Home 键最小化回桌面，应用保活并出现在 dock', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.locator('[data-icon-item][data-id="icon-app-web-img"]').click();
  await expect(page.locator('[data-os-app-window="web-img"]')).toHaveAttribute('data-active', 'true');

  await page.getByRole('button', { name: /返回桌面|back to home/i }).click();
  // 窗口仍在（保活）但非激活；dock 出现运行指示
  await expect(page.locator('[data-os-app-window="web-img"]')).toHaveCount(1);
  await expect(page.locator('[data-os-app-window="web-img"]')).toHaveAttribute('data-active', 'false');
  await expect(page.locator('[data-os-dock]')).toBeVisible();
  await expect(page.locator('[data-os-dock] [data-os-dock-running]')).toHaveCount(1);
});

test('dock 图标可切回运行中的应用', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.locator('[data-icon-item][data-id="icon-app-web-img"]').click();
  await page.getByRole('button', { name: /返回桌面|back to home/i }).click();
  await expect(page.locator('[data-os-dock]')).toBeVisible();

  await page.getByRole('button', { name: /打开 图片工具箱|open image toolbox/i }).click();
  await expect(page.locator('[data-os-app-window="web-img"]')).toHaveAttribute('data-active', 'true');
  await expect(page).toHaveURL(/\/img\/$/);
});

test('dock 可关闭运行中的应用', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.locator('[data-icon-item][data-id="icon-app-web-img"]').click();
  await page.getByRole('button', { name: /返回桌面|back to home/i }).click();
  await expect(page.locator('[data-os-dock]')).toBeVisible();

  await page.getByRole('button', { name: /关闭 图片工具箱|close image toolbox/i }).click();
  await expect(page.locator('[data-os-app-window="web-img"]')).toHaveCount(0);
  await expect(page.locator('[data-os-dock]')).toHaveCount(0);
});

test('Esc 键最小化应用窗口回桌面', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.locator('[data-icon-item][data-id="icon-app-web-text"]').click();
  await expect(page.locator('[data-os-app-window="web-text"]')).toHaveAttribute('data-active', 'true');

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-os-app-window="web-text"]')).toHaveAttribute('data-active', 'false');
  await expect(page.locator('[data-os-dock]')).toBeVisible();
});

test('键盘 Home 键最小化应用窗口回桌面（应用保活）', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.locator('[data-icon-item][data-id="icon-app-web-text"]').click();
  await expect(page.locator('[data-os-app-window="web-text"]')).toHaveAttribute('data-active', 'true');

  await page.keyboard.press('Home');
  await expect(page.locator('[data-os-app-window="web-text"]')).toHaveAttribute('data-active', 'false');
  await expect(page.locator('[data-os-app-window="web-text"]')).toHaveCount(1);
  await expect(page.locator('[data-os-dock]')).toBeVisible();
});

test('应用 iframe 上报未读角标：dock 显示徽标，打开应用即清零', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.locator('[data-icon-item][data-id="icon-app-web-img"]').click();
  await expect(page.locator('[data-os-app-window="web-img"]')).toHaveAttribute('data-active', 'true');

  // 模拟应用内向壳上报未读（框架内执行 postMessage）
  // 注意：点击图标后主页 URL 被 pushState 成 /img/，必须取子 frame（非 mainFrame）
  const frame = page.frames().find(f => f !== page.mainFrame() && f.url().includes('/img/'));
  await frame!.evaluate(() => window.parent.postMessage({ type: 'os-badge', appId: 'nchat', count: 3 }, '*'));

  await page.getByRole('button', { name: /返回桌面|back to home/i }).click();
  await expect(page.locator('[data-os-dock]')).toBeVisible();
  const badge = page.locator('[data-os-dock-badge="web-img"]');
  await expect(badge).toHaveText('3');

  // 打开应用清零
  await page.getByRole('button', { name: /打开 图片工具箱|open image toolbox/i }).click();
  await expect(page.locator('[data-os-app-window="web-img"]')).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', { name: /返回桌面|back to home/i }).click();
  await expect(page.locator('[data-os-dock-badge="web-img"]')).toHaveCount(0);
});

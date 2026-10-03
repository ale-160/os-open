import { test, expect, Page } from '@playwright/test';

/**
 * App 窗口（内嵌应用）冒烟：多任务模型——
 * 点击桌面 app:// 图标 → 全屏 iframe 窗口；Home 键 / Esc 只是最小化回桌面
 * （iframe 保活不销毁），运行中的应用出现在桌面 dock，可切回可关闭。
 * e2e 仅起 shell 的静态导出，/img、/text 用路由拦截返回桩页面。
 */
async function dismissWelcome(page: Page) {
  const welcome = page.getByRole('dialog', { name: /welcome|欢迎/i });
  try {
    await welcome.waitFor({ state: 'visible', timeout: 10_000 });
    await welcome.getByRole('button', { name: /default configuration|默认配置/i }).click();
  } catch {
    // 无引导弹窗时直接继续
  }
}

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

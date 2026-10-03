import { test, expect, Page } from '@playwright/test';

/**
 * App 窗口（内嵌应用）冒烟：点击桌面 app:// 图标 → 全屏 iframe 窗口，
 * URL 同步为应用路径；Home 键 / Esc 收起回桌面。
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

  const frame = page.locator('[data-os-app-window]');
  await expect(frame).toBeVisible();
  await expect(page.locator('iframe[data-os-app-frame]')).toBeVisible();
  // URL 已 pushState 到应用路径
  await expect(page).toHaveURL(/\/img\/$/);
});

test('Home 键收起应用窗口回桌面', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.locator('[data-icon-item][data-id="icon-app-web-img"]').click();
  await expect(page.locator('[data-os-app-window]')).toBeVisible();

  await page.getByRole('button', { name: /返回桌面|back to home/i }).click();
  await expect(page.locator('[data-os-app-window]')).toHaveCount(0);
  await expect(page).toHaveURL(/:\/\/localhost:4173\/$/);
});

test('Esc 键收起应用窗口', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.locator('[data-icon-item][data-id="icon-app-web-text"]').click();
  await expect(page.locator('[data-os-app-window]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-os-app-window]')).toHaveCount(0);
});

import { test, expect, Page } from '@playwright/test';

/**
 * 全局命令面板（Spotlight）：Ctrl/⌘+K 或顶栏搜索按钮唤起，
 * 聚合系统应用/桌面图标/系统操作，回车执行；无结果回退网络搜索。
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
  await page.route('**/img/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<html><body id="img-app-stub">IMG APP STUB</body></html>' })
  );
  await page.route('**/text/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<html><body id="text-app-stub">TEXT APP STUB</body></html>' })
  );
});

test('Ctrl+K 唤起面板，回车启动系统应用', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: /命令面板|Command Palette/i });
  await expect(palette).toBeVisible();
  await expect(palette.getByPlaceholder(/搜索应用、图标或操作|search apps, icons or actions/i)).toBeVisible();

  await palette.getByPlaceholder(/搜索应用、图标或操作|search apps, icons or actions/i).fill('图片');
  await page.keyboard.press('Enter');

  // 命令执行：web-img 全屏窗口打开，面板关闭
  await expect(page.locator('[data-os-app-window="web-img"]')).toHaveAttribute('data-active', 'true');
  await expect(palette).toBeHidden();
});

test('顶栏搜索按钮唤起面板，可执行系统操作（打开设置）', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.getByTitle(/全局搜索|Global Search/i).click();
  const palette = page.getByRole('dialog', { name: /命令面板|Command Palette/i });
  await expect(palette).toBeVisible();

  // 用英文关键词过滤（两种语言下 actions 条目的 keywords 都含 settings），
  // 并精确点击「设置」条目——网络搜索回退项会匹配任意查询词，不能靠回车取第一项
  await palette.getByPlaceholder(/搜索应用、图标或操作|search apps, icons or actions/i).fill('Settings');
  const settingsItem = palette.locator('[cmdk-item]').filter({ hasText: /^(Settings|设置)$/ });
  await expect(settingsItem).toHaveCount(1);
  await settingsItem.click();

  await expect(page.getByRole('dialog', { name: /设置|Settings/i })).toBeVisible();
  await expect(palette).toBeHidden();
});

test('Esc 关闭面板', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: /命令面板|Command Palette/i });
  await expect(palette).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
});

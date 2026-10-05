import { test, expect } from '@playwright/test';

/**
 * 系统应用商城冒烟：从商城移除桌面应用 → 桌面图标消失 → 重新添加 → 恢复。
 */
async function dismissWelcome(page: import('@playwright/test').Page) {
  const welcome = page.getByRole('dialog', { name: /welcome|欢迎/i });
  try {
    await welcome.waitFor({ state: 'visible', timeout: 10_000 });
    await welcome.getByRole('button', { name: /default configuration|默认配置/i }).click();
  } catch {
    // 无引导弹窗时直接继续
  }
}

test('商城可移除并重新添加应用', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  // 打开商城
  await page.getByTitle(/应用商城|App Store/i).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // 移除第一个应用（图片工具箱）→ 桌面图标消失
  const imgRow = dialog.locator('div.rounded-xl').filter({ hasText: /图片工具箱|Image Toolbox/ });
  await imgRow.getByRole('button', { name: /移除|Remove/i }).click();
  await expect(
    page.locator('[data-icon-item]').filter({ hasText: /图片工具箱|Image Toolbox/ })
  ).toHaveCount(0);

  // 重新添加 → 桌面图标恢复
  await imgRow.getByRole('button', { name: /添加|Add/i }).click();
  await expect(
    page.locator('[data-icon-item]').filter({ hasText: /图片工具箱|Image Toolbox/ })
  ).toHaveCount(1);
  await expect(dialog).toBeVisible(); // 商城保持打开，可继续管理
});

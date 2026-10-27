import { test, expect } from '@playwright/test';

/**
 * 首次使用引导的"选择要添加的应用"步骤：
 * 默认配置 → 取消勾选某个应用 → 桌面不出现该应用图标 → 从商城加回。
 */

test('首启引导可选择要添加的应用', async ({ page }) => {
  await page.goto('/');
  const welcome = page.getByRole('dialog', { name: /welcome|欢迎/i });
  await welcome.waitFor({ state: 'visible', timeout: 10_000 });
  await welcome.getByRole('button', { name: /default configuration|默认配置/i }).click();

  // 应用挑选步骤：按分类分组，取消勾选"文字动画"
  const picker = page.getByRole('dialog', { name: /choose apps|选择要添加的应用/i });
  await picker.waitFor({ state: 'visible' });
  await expect(picker.getByRole('button', { name: /select all|全选/i })).toBeVisible();
  await picker.locator('button').filter({ hasText: /TypeV|文字动画/ }).first().click();
  await picker.getByRole('button', { name: /get started|开始使用/i }).click();

  // 桌面没有文字动画图标，其他应用（图片工具箱）仍在
  await expect(
    page.locator('[data-icon-item]').filter({ hasText: /TypeV|文字动画/ })
  ).toHaveCount(0);
  await expect(
    page.locator('[data-icon-item]').filter({ hasText: /图片工具箱|Image Toolbox/ })
  ).toHaveCount(1);

  // 商城里仍可随时加回
  await page.getByTitle(/应用商城|App Store/i).click();
  const store = page.getByRole('dialog');
  const typevRow = store.locator('div.rounded-xl').filter({ hasText: /TypeV|文字动画/ });
  await typevRow.getByRole('button', { name: /^Add$|^添加$/i }).click();
  await expect(
    page.locator('[data-icon-item]').filter({ hasText: /TypeV|文字动画/ })
  ).toHaveCount(1);
});

import { test, expect } from '@playwright/test';
import { dismissWelcome } from './helpers';

/**
 * 系统应用商城冒烟：分类筛选；从商城移除桌面应用 → 桌面图标消失 → 重新添加 → 恢复。
 */

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

test('商城按分类筛选应用', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  await page.getByTitle(/应用商城|App Store/i).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // 分类 chips 存在（全部 + 各分类）
  await expect(dialog.getByRole('button', { name: /^All$|^全部$/i })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Games$|^游戏$/i })).toBeVisible();

  // 筛选"游戏"分类 → 只剩游戏类应用
  await dialog.getByRole('button', { name: /^Games$|^游戏$/i }).click();
  await expect(dialog.locator('div.rounded-xl').filter({ hasText: /咕咕|GuGu/ })).toBeVisible();
  await expect(dialog.locator('div.rounded-xl').filter({ hasText: /麦堡突击队|Burger Commando/ })).toBeVisible();
  await expect(dialog.locator('div.rounded-xl').filter({ hasText: /图片工具箱|Image Toolbox/ })).toHaveCount(0);

  // 回到"全部"恢复完整列表
  await dialog.getByRole('button', { name: /^All$|^全部$/i }).click();
  await expect(dialog.locator('div.rounded-xl').filter({ hasText: /图片工具箱|Image Toolbox/ })).toBeVisible();
});

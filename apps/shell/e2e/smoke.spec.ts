import { test, expect, Page } from '@playwright/test';
import { dismissWelcome } from './helpers';

test('首页正常渲染核心元素', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  // 单语言路由：根目录即中文站
  await expect(page).toHaveTitle(/ale os/i);

  // 搜索框存在且可见，placeholder 正确
  const searchInput = page.getByPlaceholder(/搜索图标或网址|search icons or urls/i);
  await expect(searchInput).toBeVisible();
});

test('搜索框可输入并清空', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);

  const searchInput = page.getByPlaceholder(/搜索图标或网址|search icons or urls/i);
  await searchInput.fill('github');
  await expect(searchInput).toHaveValue('github');

  await searchInput.clear();
  await expect(searchInput).toHaveValue('');
  // 清空后主导航区域仍正常渲染（无崩溃）
  await expect(page.getByRole('banner')).toBeVisible();
});

test('主题切换按钮可切换明暗模式', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);
  await expect(page.getByRole('banner')).toBeVisible();

  const htmlClass = () => page.evaluate(() => document.documentElement.className);
  const before = await htmlClass();

  await page.getByTitle(/切换主题|toggle theme/i).click();
  // @wrksz/themes 以 class 形式挂载明暗模式，点击后 html class 应变化
  await expect.poll(htmlClass, { timeout: 5_000 }).not.toBe(before);
});

test('设置面板可打开', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);
  await expect(page.getByRole('banner')).toBeVisible();

  await page.getByTitle(/设置|Settings/).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('帮助面板可打开', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);
  await expect(page.getByRole('banner')).toBeVisible();

  await page.getByTitle(/帮助|Help/).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

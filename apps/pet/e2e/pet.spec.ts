import { expect, test } from '@playwright/test';

/**
 * 咕咕冒烟链路：领养 → 啄壳破壳 → 喂食（冷却生效）。
 * 前置：CI 已完成 pnpm build + compose（out/pet/ 存在）。
 */

test('领养 → 破壳 → 喂食全链路', async ({ page }) => {
  await page.goto('/pet/');
  await expect(page.getByRole('heading', { name: /咕咕 GuGu/ })).toBeVisible();

  // 选奶黄蛋并开始孵化
  await page.getByRole('button', { name: /奶黄/ }).first().click();
  await page.getByRole('button', { name: /开始孵化/ }).click();

  // 蛋阶段：动作禁用，连点蛋壳 5 次破壳
  await expect(page.getByRole('button', { name: 'egg' })).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'egg' }).click({ force: true });
  }
  const pet = page.getByRole('button', { name: 'pet' });
  await expect(pet).toBeVisible();

  // 喂食：按钮进入冷却（45 秒倒计时）
  const feed = page.getByRole('button', { name: /喂食/ });
  await feed.click();
  await expect(feed).toBeDisabled();

  // 成就图鉴可打开（初次见面已解锁）：入口在「更多」面板
  await page.getByRole('button', { name: '更多' }).click();
  await page.getByRole('button', { name: '成就图鉴' }).click();
  await expect(page.getByText('1 / 13')).toBeVisible();
});

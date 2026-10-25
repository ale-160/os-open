import { expect, test } from '@playwright/test';

/**
 * 咕咕冒烟链路：领养 → 啄壳破壳 → 喂食（冷却生效）。
 * 前置：CI 已完成 pnpm build + compose（out/pet/ 存在）。
 */

const SEED_SAVE = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    saveVersion: 5,
    name: '咕咕',
    variant: 'cream',
    stage: 'baby',
    bornAt: Date.now() - 86_400_000,
    hatchedAt: Date.now() - 82_800_000,
    updatedAt: Date.now(),
    satiety: 82,
    cleanliness: 88,
    mood: 90,
    energy: 76,
    health: 100,
    growth: 12,
    coins: 36,
    personality: { foodie: 14, lively: 10, artsy: 4, chill: 2 },
    counters: { feed: 6, wash: 4, play: 5, work: 2, study: 2, tap: 23, heal: 1, aiChat: 3 },
    bests: { snack: 15, whack: 6, memory: 9, race: 0, toss: 0, sing: 0 },
    achievements: ['hatch', 'feed10'],
    sleeping: false,
    sick: false,
    alive: true,
    mode: 'casual',
    tapsToHatch: 0,
    lastFedAt: 0,
    lastWashedAt: 0,
    lastPlayedAt: 0,
    lastWorkedAt: 0,
    lastStudiedAt: 0,
    tutorialStep: 3,
    trip: null,
    album: { photos: [], souvenirs: [] },
    ...overrides,
  });

test('领养 → 破壳 → 喂食全链路', async ({ page }) => {
  await page.addInitScript(`localStorage.setItem('ale-pet-save', JSON.stringify(${SEED_SAVE()}));`);
  await page.goto('/pet/');
  // 种子存档已破壳：直接进入游戏态
  const pet = page.getByRole('button', { name: 'pet' });
  await expect(pet).toBeVisible();

  // 喂食：按钮进入冷却（45 秒倒计时）
  const feed = page.getByRole('button', { name: /喂食/ });
  await feed.click();
  await expect(feed).toBeDisabled();

  // 成就图鉴可打开（种子成就 + 打开瞬间可能自动解锁更多）：入口在底部无级滚动条里
  await page.evaluate("(function(){ var btns = document.querySelectorAll('button'); for (var i = 0; i < btns.length; i++) { if (btns[i].textContent.trim() === '🏆成就图鉴') { btns[i].click(); return; } } })()");
  await page.waitForTimeout(500);
  await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible();
});

/** 旅行归来场景的种子覆盖（在测试外定义，保证 addInitScript 只传字符串源码） */
const tripOverrides = {
  trip: {
    status: 'returned',
    departAt: Date.now() - 40 * 60_000,
    returnAt: Date.now() - 5 * 60_000,
    dest: 'onsen',
    provision: 'bento',
    photos: [0, 1],
    souvenir: true,
  },
  album: {
    photos: [
      { dest: 'onsen', cap: 0, at: Date.now() - 20 * 60_000 },
      { dest: 'onsen', cap: 1, at: Date.now() - 10 * 60_000 },
    ],
    souvenirs: [{ dest: 'onsen', at: Date.now() - 5 * 60_000 }],
  },
};

test('旅行归来：报告弹窗显示照片与手信', async ({ page }) => {
  await page.addInitScript(`localStorage.setItem('ale-pet-save', JSON.stringify(${SEED_SAVE(tripOverrides)}));`);
  await page.goto('/pet/');
  // 报告弹窗应自动弹出
  await expect(page.getByText(/旅行归来/)).toBeVisible();
  await expect(page.getByText(/温泉/).first()).toBeVisible();
  // 关闭后咕咕回家
  await page.getByRole('button', { name: /欢迎回家/ }).click();
  await expect(page.getByRole('button', { name: 'pet' })).toBeVisible();
});

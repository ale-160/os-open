import { defineConfig, devices } from '@playwright/test';

/**
 * 咕咕 e2e 冒烟：对合成产物 out/ 起静态服务，走「领养 → 破壳 → 喂食」冒烟链路。
 * 注意固定 en-US 之外的无关项：本应用无根路径重定向，locale 仅影响 UI 语言。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4181',
    locale: 'zh-CN',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx serve ../../out -l 4181',
    url: 'http://localhost:4181',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

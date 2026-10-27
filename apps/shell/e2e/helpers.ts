import type { Page } from '@playwright/test';

/**
 * 完成首访引导：选"使用默认配置" → 在"选择要添加的应用"步骤保持全选并确认。
 * 注意：SetupGuide 是动态导入的，弹窗可能晚于首屏渲染，必须先等待其出现，
 * 否则背景内容带有 aria-hidden，role 选择器（如 banner）无法命中。
 * 无引导弹窗时（已有配置）直接继续。
 */
export async function dismissWelcome(page: Page) {
  const welcome = page.getByRole('dialog', { name: /welcome|欢迎/i });
  try {
    await welcome.waitFor({ state: 'visible', timeout: 10_000 });
    await welcome.getByRole('button', { name: /default configuration|默认配置/i }).click();
  } catch {
    return; // 无引导弹窗时直接继续
  }
  // 默认配置流程的第二步：挑选要放到桌面的应用
  try {
    const picker = page.getByRole('dialog', { name: /choose apps|选择要添加的应用/i });
    await picker.waitFor({ state: 'visible', timeout: 5_000 });
    await picker.getByRole('button', { name: /get started|开始使用/i }).click();
  } catch {
    // 兼容旧构建（无挑选步骤）时直接继续
  }
}

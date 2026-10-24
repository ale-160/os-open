import { defineConfig } from 'vitest/config';

// 只跑 src 下的单测；e2e/ 交给 Playwright（pnpm e2e）
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});

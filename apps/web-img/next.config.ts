import { withOsPreset } from '@os/next-preset';

export default withOsPreset({
  // 配置 Turbopack（Next.js 16 默认使用；构建脚本仍用 --webpack）
  turbopack: {}
});

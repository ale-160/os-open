/**
 * Ale OS Next.js 静态导出统一预设。
 * 固化系统级构建契约：output: 'export'、trailingSlash、关闭图片优化、
 * 部署子路径（环境变量）注入、@os/* 共享包转译。
 *
 * 预设字段优先于应用配置（output/basePath/trailingSlash 不可覆盖），
 * 应用自有字段（如 turbopack、redirects）原样透传。
 *
 * @param {import('next').NextConfig} [config] 应用自有配置
 * @param {{
 *   basePathEnv?: string,
 *   env?: Record<string, string>,
 *   transpilePackages?: string[]
 * }} [options] basePathEnv：读取哪个环境变量作为部署子路径（默认 APP_BASE_PATH）
 * @returns {import('next').NextConfig}
 */
export function withOsPreset(config = {}, options = {}) {
  const basePathEnv = options.basePathEnv || 'APP_BASE_PATH';
  const basePath = process.env[basePathEnv] || '';
  const transpilePackages = new Set([
    '@os/shared',
    ...(config.transpilePackages || []),
    ...(options.transpilePackages || [])
  ]);
  return {
    ...config,
    output: 'export',
    basePath,
    trailingSlash: true,
    images: { unoptimized: true, ...(config.images || {}) },
    // 把子路径暴露给客户端代码（静态导出下 <img>/fetch 需自行拼接前缀）
    env: {
      NEXT_PUBLIC_APP_BASE_PATH: basePath,
      ...(options.env || {}),
      ...(config.env || {})
    },
    transpilePackages: [...transpilePackages]
  };
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.APP_BASE_PATH || '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // 配置 Turbopack（Next.js 16 默认使用）
  turbopack: {},
};

export default nextConfig;

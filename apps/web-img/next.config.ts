import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // 配置 Turbopack（Next.js 16 默认使用）
  turbopack: {},
};

export default nextConfig;

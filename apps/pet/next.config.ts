import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'export',
    basePath: process.env.APP_BASE_PATH || '',
    trailingSlash: true,
    images: {
        unoptimized: true,
    },
    // 把子路径暴露给客户端代码（静态导出下 <img>/fetch 需自行拼接前缀）
    env: {
        NEXT_PUBLIC_APP_BASE_PATH: process.env.APP_BASE_PATH || '',
    },
};

export default nextConfig;

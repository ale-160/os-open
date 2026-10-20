import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'export',
    basePath: process.env.APP_BASE_PATH || '',
    trailingSlash: true,
    images: {
        unoptimized: true,
    },
};

export default nextConfig;

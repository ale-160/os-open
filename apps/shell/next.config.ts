import fs from 'fs';
import path from 'path';
import { withOsPreset } from '@os/next-preset';

const BASE_PATH = process.env.BASE_PATH || ''; // 部署子路径，通过环境变量 BASE_PATH 设置

// 将 basePath 暴露给客户端代码
process.env.NEXT_PUBLIC_BASE_PATH = BASE_PATH;

const baseConfig = withOsPreset(
  { env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH } },
  { basePathEnv: 'BASE_PATH' }
);

// 尝试加载本地私有配置文件
let finalConfig = baseConfig;
try {
    const localConfigPath = path.join(process.cwd(), 'next.config.local.ts');
    if (fs.existsSync(localConfigPath)) {
        // 动态导入本地配置
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const localModule = require(localConfigPath);
        const localConfig = localModule.default || localModule;

        // 合并配置（本地配置优先）
        finalConfig = {
            ...baseConfig,
            ...localConfig,
            // 特殊处理 webpack 配置，如果本地有则使用本地的
            webpack: localConfig.webpack || baseConfig.webpack,
        };
    }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_error) {
    // 如果加载失败，忽略错误，使用默认配置
}

export default finalConfig;

import type { NextConfig } from 'next';

export interface OsNextPresetOptions {
  /** 读取哪个环境变量作为部署子路径（默认 APP_BASE_PATH） */
  basePathEnv?: string;
  /** 追加注入到构建期的环境变量 */
  env?: Record<string, string>;
  /** 额外的 transpilePackages */
  transpilePackages?: string[];
}

export declare function withOsPreset(
  config?: NextConfig,
  options?: OsNextPresetOptions
): NextConfig;

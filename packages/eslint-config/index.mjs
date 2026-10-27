import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Ale OS Next 应用共享 ESLint flat config。
 * 合并各应用既有差异：静态导出下关闭 next/image 告警、
 * 下划线前缀变量不告警；应用可通过 options 追加 ignores/rules。
 *
 * @param {{
 *   ignores?: string[],
 *   rules?: Record<string, unknown>
 * }} [options]
 */
export function createOsEslintConfig(options = {}) {
  const { ignores = [], rules = {} } = options;
  return defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      ...ignores
    ]),
    {
      rules: {
        // 静态导出模式下必须使用原生 img 标签，禁用 next/image 警告
        '@next/next/no-img-element': 'off',
        // 允许下划线前缀的未使用变量（有意忽略的场景）
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_'
          }
        ],
        ...rules
      }
    }
  ]);
}

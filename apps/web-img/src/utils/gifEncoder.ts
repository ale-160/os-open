/**
 * GIF 编码器已迁入运行时公共库 `@os/shared/gif-encoder`（TypeV 等应用复用）。
 *
 * 这里保留一层薄转发，使应用内既有的 `@/utils/gifEncoder` 引用保持不变。
 * 刻意使用相对路径而非包名：CI 的「web-img encoder tests」步骤用 tsc 单独编译本文件
 * （`--module commonjs`，不解析 package.json exports），编译产物会把共享源码一并输出到
 * `.test-tmp/packages/shared/src/`，再由 scripts/test-gif-encoder.mjs 加载做往返校验。
 */
export * from '../../../../packages/shared/src/gif-encoder';

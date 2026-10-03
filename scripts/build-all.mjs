/**
 * 全量构建：依次构建三个应用（子应用带 basePath），然后合成单一 out/。
 * 在仓库根目录运行：node scripts/build-all.mjs（或 pnpm build）
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env }
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('pnpm', ['--filter', 'shell', 'build']);
run('pnpm', ['--filter', 'web-img', 'build'], { APP_BASE_PATH: '/img' });
run('pnpm', ['--filter', 'web-text', 'build'], { APP_BASE_PATH: '/text' });
run('node', ['scripts/compose.mjs']);

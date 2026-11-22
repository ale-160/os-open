/**
 * 把各应用的静态导出合成为单一站点（由 build-all.mjs 在全部构建成功后调用）：
 *   apps/shell/out     → out/          （桌面壳，根路径）
 *   apps/web-img/out   → out/img/      （图片工具箱）
 *   apps/web-text/out  → out/text/     （Markdown 编辑器）
 *   apps/nchat/out     → out/chat/     （P2P 聊天室）
 *   apps/typev/out     → out/typev/    （文字动画）
 *   apps/pet/out       → out/pet/      （咕咕桌宠）
 *   apps/burger/out    → out/burger/   （麦堡突击队）
 * 任一产物缺失即报错退出。
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(rootDir, 'out');

const parts = [
  ['apps/shell/out', '.'],
  ['apps/web-img/out', 'img'],
  ['apps/web-text/out', 'text'],
  ['apps/nchat/out', 'chat'],
  ['apps/typev/out', 'typev'],
  ['apps/pet/out', 'pet'],
  ['apps/burger/out', 'burger']
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const [src, dest] of parts) {
  const from = path.join(rootDir, src);
  if (!existsSync(from)) {
    console.error(`缺少构建产物: ${from}（请先运行 pnpm build）`);
    process.exit(1);
  }
  cpSync(from, path.join(outDir, dest), { recursive: true });
  console.log(`已合入 ${src} → out/${dest === '.' ? '' : dest + '/'}`);
}

console.log('compose 完成 → out/');

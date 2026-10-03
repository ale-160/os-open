/**
 * 把三个应用的静态导出合成为单一站点：
 *   apps/shell/out     → out/          （桌面壳，根路径）
 *   apps/web-img/out   → out/img/      （图片工具箱，/img/）
 *   apps/web-text/out  → out/text/     （Markdown 编辑器，/text/）
 * 并写入 GitHub Pages 所需的 .nojekyll 与 CNAME。
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(rootDir, 'out');

const parts = [
  ['apps/shell/out', '.'],
  ['apps/web-img/out', 'img'],
  ['apps/web-text/out', 'text']
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

writeFileSync(path.join(outDir, '.nojekyll'), '');
writeFileSync(path.join(outDir, 'CNAME'), 'os.ale160.com\n');
console.log('compose 完成 → out/');

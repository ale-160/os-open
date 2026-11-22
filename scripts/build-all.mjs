/**
 * 全量构建：按有限并发构建全部应用（桌面壳 + 子应用，子应用带 basePath），
 * 全部成功后合成单一 out/（scripts/compose.mjs）。
 * 在仓库根目录运行：node scripts/build-all.mjs（或 pnpm build）
 *
 * - 并发数：环境变量 BUILD_CONCURRENCY（默认 2；设为 1 即串行）
 * - 输出：各应用日志实时转发，每行带 [应用名] 前缀
 * - 失败即停：任一应用构建失败，终止其余正在进行的构建，不再启动新任务，非零退出
 *
 * 新增应用：在下方 APPS 加一项（name 为 pnpm 包名，env 里给出 APP_BASE_PATH），
 * 并在 scripts/compose.mjs 的 parts 中加对应的产物目录。
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isWindows = process.platform === 'win32';

/** @type {{ name: string, env?: Record<string, string> }[]} */
const APPS = [
  { name: 'shell' },
  { name: 'web-img', env: { APP_BASE_PATH: '/img' } },
  { name: 'web-text', env: { APP_BASE_PATH: '/text' } },
  { name: 'nchat', env: { APP_BASE_PATH: '/chat' } },
  { name: 'typev', env: { APP_BASE_PATH: '/typev' } },
  { name: 'pet', env: { APP_BASE_PATH: '/pet' } },
  { name: 'burger' }
];

function parseConcurrency(raw) {
  if (raw === undefined || raw === '') return 2;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`BUILD_CONCURRENCY 无效: "${raw}"（需为 ≥1 的整数）`);
    process.exit(1);
  }
  return n;
}

const concurrency = Math.min(parseConcurrency(process.env.BUILD_CONCURRENCY), APPS.length);
const prefixWidth = Math.max(...APPS.map((app) => app.name.length)) + 2;
const formatSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

/** 把子进程输出按行加前缀转发（保留不完整的末行，等下一块数据拼接） */
function pipeWithPrefix(stream, target, prefix) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) target.write(`${prefix}${line}\n`);
  });
  stream.on('end', () => {
    if (pending) target.write(`${prefix}${pending}\n`);
    pending = '';
  });
}

/** 终止子进程及其整棵进程树（pnpm → next → worker） */
function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  try {
    if (isWindows) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      // detached 启动的子进程自成进程组，负 pid 终止整组
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // 进程已退出
  }
}

const running = new Set();
let failed = false;

/** 构建单个应用；resolve 为耗时（ms），失败时 reject */
function buildApp(app) {
  const prefix = `[${app.name}]`.padEnd(prefixWidth) + ' ';
  const startedAt = Date.now();
  console.log(`${prefix}▶ 开始构建${app.env?.APP_BASE_PATH ? `（basePath ${app.env.APP_BASE_PATH}）` : ''}`);

  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['--filter', app.name, 'build'], {
      cwd: rootDir,
      // Windows 上 pnpm 是 .cmd，需要经 shell 启动
      shell: isWindows,
      detached: !isWindows,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...app.env }
    });
    running.add(child);
    pipeWithPrefix(child.stdout, process.stdout, prefix);
    pipeWithPrefix(child.stderr, process.stderr, prefix);

    child.on('error', (err) => {
      running.delete(child);
      reject(new Error(`${app.name} 无法启动: ${err.message}`));
    });
    child.on('close', (code, signal) => {
      running.delete(child);
      const elapsed = Date.now() - startedAt;
      if (code === 0) {
        console.log(`${prefix}✔ 完成（${formatSeconds(elapsed)}）`);
        resolve(elapsed);
      } else {
        reject(new Error(`${app.name} 构建失败（${signal ?? `exit ${code}`}，${formatSeconds(elapsed)}）`));
      }
    });
  });
}

function abortAll() {
  for (const child of running) killTree(child);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    abortAll();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

async function main() {
  const startedAt = Date.now();
  console.log(`构建 ${APPS.length} 个应用，并发 ${concurrency}（BUILD_CONCURRENCY）`);

  const queue = [...APPS];
  /** @type {{ name: string, ms: number }[]} */
  const timings = [];
  /** @type {Error | null} */
  let firstError = null;

  async function worker() {
    while (!failed && queue.length > 0) {
      const app = queue.shift();
      try {
        timings.push({ name: app.name, ms: await buildApp(app) });
      } catch (err) {
        if (!failed) {
          failed = true;
          firstError = err;
          abortAll();
        }
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  if (firstError) {
    console.error(`\n✖ ${firstError.message}；已终止其余构建。`);
    process.exit(1);
  }

  console.log(`\n全部应用构建完成（${formatSeconds(Date.now() - startedAt)}）：`);
  for (const { name, ms } of timings) console.log(`  ${name.padEnd(prefixWidth)} ${formatSeconds(ms)}`);

  const compose = spawnSync(process.execPath, ['scripts/compose.mjs'], {
    cwd: rootDir,
    stdio: 'inherit'
  });
  if (compose.status !== 0) process.exit(compose.status ?? 1);
  console.log(`总耗时 ${formatSeconds(Date.now() - startedAt)}`);
}

main().catch((err) => {
  console.error(err);
  abortAll();
  process.exit(1);
});

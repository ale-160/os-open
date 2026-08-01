#!/usr/bin/env node
/**
 * nchat unified startup script (cross-platform, Node.js)
 *
 * Usage:
 *   node scripts/start.js            # default ports 9000 + 5173
 *   node scripts/start.js --fe=5180  # custom frontend port
 *   node scripts/start.js --sig=9001 # custom signaling port
 *
 * Features:
 *   - Cross-platform (Windows/macOS/Linux)
 *   - Check port occupancy, kill the process that holds the port
 *   - Start signaling server (peerjs) and frontend (vite) concurrently
 *   - Ctrl+C cleanly stops both child processes
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Parse args: --fe=5180 --sig=9001
function parseArgs() {
  const args = { fe: 5173, sig: 9000 }
  for (const a of process.argv.slice(2)) {
    const m = /^--(fe|sig)=(\d+)$/.exec(a)
    if (m) args[m[1]] = Number(m[2])
  }
  return args
}

const { fe: FE_PORT, sig: SIG_PORT } = parseArgs()
const isWin = process.platform === 'win32'

function log(tag, msg, color = '') {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    reset: '\x1b[0m'
  }
  const c = colors[color] || ''
  const r = colors.reset
  console.log(`${c}[${tag}]${r} ${msg}`)
}

/** Find the PID occupying a port. Returns null if free. */
function findPortPid(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
    tester.once('error', () => {
      // Port in use; find the PID via OS command
      try {
        let cmd, args
        if (isWin) {
          // netstat -ano is more reliable than PowerShell Get-NetTCPConnection
          cmd = 'cmd'
          args = ['/c', `netstat -ano | findstr ":${port} " | findstr "LISTENING"`]
        } else {
          cmd = 'sh'
          args = ['-c', `lsof -ti:${port} 2>/dev/null | head -n 1`]
        }
        const res = spawnSync(cmd, args, { encoding: 'utf8' })
        const out = (res.stdout || '').trim()
        let pid = 'unknown'
        if (isWin) {
          // netstat output: "  TCP    0.0.0.0:9000    0.0.0.0:0    LISTENING    12345"
          // Take the last non-empty token from the first matching line
          const line = out.split('\n')[0] || ''
          const tokens = line.trim().split(/\s+/)
          const last = parseInt(tokens[tokens.length - 1], 10)
          if (Number.isFinite(last) && last > 0) pid = last
        } else {
          const num = parseInt(out, 10)
          if (Number.isFinite(num) && num > 0) pid = num
        }
        resolve(pid)
      } catch {
        resolve('unknown')
      }
    })
    tester.once('listening', () => {
      tester.close(() => resolve(null))
    })
    tester.listen(port)
  })
}

/** Kill a process by PID. */
function killPid(pid) {
  if (!pid || pid === 'unknown') return
  try {
    if (isWin) {
      spawnSync('taskkill', ['/PID', String(pid), '/F', '/T'], { stdio: 'ignore' })
    } else {
      spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' })
    }
  } catch {
    /* ignore */
  }
}

async function ensurePortFree(port, label) {
  const pid = await findPortPid(port)
  if (pid) {
    log('start', `Port ${port} (${label}) occupied by PID ${pid}, killing...`, 'yellow')
    killPid(pid)
    await new Promise((r) => setTimeout(r, 600))
    const still = await findPortPid(port)
    if (still) {
      log('start', `Warning: port ${port} still occupied, service may fail to start`, 'yellow')
    } else {
      log('start', `Port ${port} released`, 'green')
    }
  } else {
    log('start', `Port ${port} (${label}) free`, 'gray')
  }
}

function ensureDeps() {
  if (!existsSync(path.join(rootDir, 'node_modules'))) {
    log('start', 'node_modules not found, installing dependencies...', 'yellow')
    spawnSync('npm', ['install'], { stdio: 'inherit', cwd: rootDir, shell: isWin })
  }
}

/** Spawn a long-running child, forward stdout/stderr. */
function spawnChild(label, cmd, args, color) {
  const colors = { peerjs: '\x1b[90m', vite: '\x1b[90m', reset: '\x1b[0m' }
  const c = colors[color] || colors.peerjs
  const child = spawn(cmd, args, {
    cwd: rootDir,
    shell: isWin,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout?.on('data', (d) => process.stdout.write(`${c}[${label}]${colors.reset} ${d}`))
  child.stderr?.on('data', (d) => process.stderr.write(`${c}[${label}]${colors.reset} ${d}`))
  child.on('exit', (code) => {
    log('start', `${label} exited with code ${code}`, code === 0 ? 'gray' : 'red')
  })
  return child
}

async function main() {
  console.log('')
  console.log('\x1b[36m===== nchat startup script =====\x1b[0m')
  log('start', 'Checking port occupancy...', 'cyan')

  await ensurePortFree(SIG_PORT, 'signaling')
  await ensurePortFree(FE_PORT, 'frontend')
  ensureDeps()

  console.log('')
  log('start', `Starting signaling server (port ${SIG_PORT})...`, 'cyan')
  const sig = spawnChild('peerjs', isWin ? 'npx' : 'npx', [
    'peerjs', '--port', String(SIG_PORT), '--allow_discovery', 'true'
  ], 'peerjs')

  await new Promise((r) => setTimeout(r, 2000))

  log('start', `Starting frontend dev server (port ${FE_PORT})...`, 'cyan')
  const fe = spawnChild('vite', isWin ? 'npm' : 'npm', ['run', 'dev'], 'vite')

  await new Promise((r) => setTimeout(r, 3000))

  console.log('')
  console.log('\x1b[32m===== Started =====\x1b[0m')
  console.log(`Frontend:    http://localhost:${FE_PORT}`)
  console.log(`Signaling:   ws://localhost:${SIG_PORT}`)
  console.log('')
  console.log('\x1b[90mPress Ctrl+C to stop all services\x1b[0m')

  const cleanup = () => {
    console.log('')
    log('start', 'Stopping all services...', 'yellow')
    try { sig.kill() } catch { /* ignore */ }
    try { fe.kill() } catch { /* ignore */ }
    if (isWin) {
      // On Windows, kill the whole tree
      try {
        if (sig.pid) spawnSync('taskkill', ['/PID', String(sig.pid), '/F', '/T'], { stdio: 'ignore' })
        if (fe.pid) spawnSync('taskkill', ['/PID', String(fe.pid), '/F', '/T'], { stdio: 'ignore' })
      } catch { /* ignore */ }
    }
    log('start', 'Stopped', 'green')
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', cleanup)
}

main().catch((e) => {
  log('start', `Fatal: ${e?.message || e}`, 'red')
  process.exit(1)
})

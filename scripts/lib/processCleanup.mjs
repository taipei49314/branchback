/**
 * Shared helpers for release scripts on Windows (and Unix).
 * Goal: avoid EPERM / hung preview children locking node_modules.
 */
import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const VERIFY_PORTS = [5173, 4173, 4177, 4174]

export function sleepMs(ms) {
  spawnSync(
    process.execPath,
    [
      '-e',
      `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,${ms})`,
    ],
    { stdio: 'ignore' },
  )
}

/** Kill a process tree. On Windows, taskkill /T is required for npm.cmd children. */
export function killProcessTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
    } catch {
      // already gone
    }
    return
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // already gone
    }
  }
}

/** Best-effort: free Vite/preview ports that commonly lock native bindings. */
export function freeDevPorts(ports = VERIFY_PORTS) {
  if (process.platform === 'win32') {
    for (const port of ports) {
      try {
        const out = execSync(
          `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`,
          { encoding: 'utf8' },
        )
        const pids = [
          ...new Set(
            out
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter((s) => /^\d+$/.test(s))
              .map(Number),
          ),
        ]
        for (const pid of pids) killProcessTree(pid)
      } catch {
        // ignore
      }
    }
    return
  }

  for (const port of ports) {
    try {
      const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' })
      for (const line of out.split(/\r?\n/)) {
        const pid = Number(line.trim())
        if (pid) killProcessTree(pid)
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Remove node_modules with retries after freeing ports.
 * Returns { ok, attempts, error }.
 */
export function removeNodeModulesRobust(root, { attempts = 6 } = {}) {
  const target = path.join(root, 'node_modules')
  if (!fs.existsSync(target)) {
    return { ok: true, attempts: 0, error: null }
  }

  let lastError = null
  for (let i = 1; i <= attempts; i++) {
    freeDevPorts()
    try {
      fs.rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 150,
      })
      if (!fs.existsSync(target)) {
        return { ok: true, attempts: i, error: null }
      }
    } catch (e) {
      lastError = e
    }
    sleepMs(400 * i)
  }

  if (process.platform === 'win32') {
    freeDevPorts()
    try {
      execSync(`cmd /c "rmdir /s /q node_modules"`, {
        cwd: root,
        stdio: 'ignore',
      })
      if (!fs.existsSync(target)) {
        return { ok: true, attempts: attempts + 1, error: null }
      }
    } catch (e) {
      lastError = e
    }
  }

  return {
    ok: !fs.existsSync(target),
    attempts,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  }
}

/** Critical tools that must exist after a healthy npm ci. */
export function assertInstallHealthy(root) {
  const required = [
    path.join('node_modules', '.bin', 'oxlint.cmd'),
    path.join('node_modules', '.bin', 'vitest.cmd'),
    path.join('node_modules', '.bin', 'tsc.cmd'),
    path.join('node_modules', 'vitest', 'vitest.mjs'),
    path.join('node_modules', 'oxlint', 'bin', 'oxlint'),
  ]
  // Cross-platform: check package entrypoints; .bin may be without .cmd on Unix.
  const packages = [
    path.join('node_modules', 'vitest', 'package.json'),
    path.join('node_modules', 'oxlint', 'package.json'),
    path.join('node_modules', 'typescript', 'package.json'),
    path.join('node_modules', '@playwright', 'test', 'package.json'),
  ]
  for (const rel of packages) {
    if (!fs.existsSync(path.join(root, rel))) return false
  }
  // Prefer package.json checks; also ensure .bin exists when present on Windows.
  if (process.platform === 'win32') {
    for (const rel of required.slice(0, 3)) {
      const p = path.join(root, rel)
      const alt = p.replace(/\.cmd$/, '')
      if (!fs.existsSync(p) && !fs.existsSync(alt)) return false
    }
  }
  return true
}

function runNpmCi(root) {
  return spawnSync('npm', ['ci'], {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    env: process.env,
  })
}

/**
 * npm ci after a robust clean.
 * Retries once when tar warnings / missing binaries indicate a corrupted install
 * (common on Windows when another process still holds files).
 */
export function cleanInstall(root) {
  freeDevPorts()
  const removed = removeNodeModulesRobust(root)
  let result = runNpmCi(root)
  const stderr = `${result.stderr ?? ''}${result.stdout ?? ''}`
  const tarGlitch = /TAR_ENTRY_ERROR/i.test(stderr)
  let healthy = result.status === 0 && assertInstallHealthy(root)

  if (!healthy || tarGlitch) {
    freeDevPorts()
    sleepMs(1000)
    removeNodeModulesRobust(root)
    result = runNpmCi(root)
    healthy = result.status === 0 && assertInstallHealthy(root)
  }

  if (!healthy && result.status === 0) {
    result = {
      ...result,
      status: 1,
      stderr: `${result.stderr ?? ''}\nINSTALL_HEALTH_CHECK_FAILED: critical packages missing after npm ci\n`,
    }
  }

  return { removed, result, healthy, tarGlitch }
}

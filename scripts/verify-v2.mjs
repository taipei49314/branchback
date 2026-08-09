/**
 * Capture v2.0 verification into verification/v2.0/
 * Uses npm ci when package-lock.json is present (authoritative lockfile).
 *
 * Windows-hardened: frees Vite/preview ports and retries node_modules deletion
 * before npm ci so EPERM locks do not falsely fail the suite.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  cleanInstall,
  freeDevPorts,
  sleepMs,
} from './lib/processCleanup.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(root, 'verification', 'v2.0')
fs.mkdirSync(outDir, { recursive: true })

function run(name, command, args) {
  const logPath = path.join(outDir, `${name}.log`)
  const started = new Date().toISOString()
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    env: process.env,
  })
  fs.writeFileSync(
    logPath,
    [
      `# ${name}`,
      `started: ${started}`,
      `command: ${command} ${args.join(' ')}`,
      `exit_code: ${result.status}`,
      `node: ${process.version}`,
      '',
      '--- stdout ---',
      result.stdout ?? '',
      '',
      '--- stderr ---',
      result.stderr ?? '',
      '',
    ].join('\n'),
    'utf8',
  )
  console.log(`${name}: exit ${result.status} -> ${logPath}`)
  return result.status ?? 1
}

const major = Number(process.versions.node.split('.')[0])
if (major < 24) {
  console.error(`Node ${process.version} does not satisfy engines.node >=24`)
  process.exit(1)
}

const lockPath = path.join(root, 'package-lock.json')
if (!fs.existsSync(lockPath)) {
  console.error(
    'package-lock.json missing — refuse to invent a PASS without locked install',
  )
  process.exit(1)
}

let failed = 0

{
  const logPath = path.join(outDir, '01-clean-install.log')
  const started = new Date().toISOString()
  console.log('01-clean-install: freeing ports + removing node_modules…')
  const { removed, result, healthy, tarGlitch } = cleanInstall(root)
  fs.writeFileSync(
    logPath,
    [
      '# 01-clean-install',
      `started: ${started}`,
      'command: freeDevPorts + removeNodeModulesRobust + npm ci (+retry if unhealthy)',
      `exit_code: ${result.status}`,
      `node: ${process.version}`,
      `node_modules_removed: ${removed.ok}`,
      `remove_attempts: ${removed.attempts}`,
      `remove_error: ${removed.error ?? ''}`,
      `install_healthy: ${healthy}`,
      `tar_glitch_seen: ${tarGlitch}`,
      '',
      '--- stdout ---',
      result.stdout ?? '',
      '',
      '--- stderr ---',
      result.stderr ?? '',
      '',
    ].join('\n'),
    'utf8',
  )
  console.log(`01-clean-install: exit ${result.status} -> ${logPath}`)
  if (!removed.ok) {
    console.warn(
      'warn: node_modules delete was incomplete; health check + retry still applied',
    )
  }
  if (!healthy) {
    console.error('error: install health check failed after npm ci')
  }
  failed += result.status ? 1 : 0
}

if (failed === 0) {
  console.log('warming module cache for Vitest…')
  const warm = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "await Promise.all([import('vitest'),import('jsdom'),import('vite'),import('fake-indexeddb/auto'),import('@vitejs/plugin-react')])",
    ],
    { cwd: root, encoding: 'utf8', env: process.env },
  )
  fs.writeFileSync(
    path.join(outDir, '01b-warmup.log'),
    [
      '# 01b-warmup',
      `exit_code: ${warm.status}`,
      warm.stdout ?? '',
      warm.stderr ?? '',
    ].join('\n'),
    'utf8',
  )
}

failed += run('02-lint', 'npm', ['run', 'lint']) ? 1 : 0

{
  let unit = run('03-unit-integrity', 'npm', ['test'])
  if (unit !== 0) {
    console.warn('unit suite failed once after clean install — retrying…')
    sleepMs(3000)
    unit = run('03-unit-integrity-retry', 'npm', ['test'])
  }
  failed += unit ? 1 : 0
}

failed += run('04-build', 'npm', ['run', 'build']) ? 1 : 0
freeDevPorts()
failed += run('05-playwright', 'npm', ['run', 'test:e2e']) ? 1 : 0
freeDevPorts()
failed += run('06-playwright-offline', 'npx', [
  'playwright',
  'test',
  '--config=playwright.offline.config.ts',
])
  ? 1
  : 0

const report = {
  milestone: 'v2.0.0',
  generatedAt: new Date().toISOString(),
  failedSteps: failed,
  node: process.version,
  install: 'npm ci (Windows-hardened cleanup)',
  story:
    'Accumulated-history layer with integrity closure: lineage/evidence tombstones, provenance honesty, dossiers, history explorer/search, backup health, schema 5',
}
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exit(failed > 0 ? 1 : 0)

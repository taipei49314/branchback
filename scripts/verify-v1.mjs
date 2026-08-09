/**
 * Capture v1.0 verification into verification/v1.0/
 * Uses npm ci when package-lock.json is present (authoritative lockfile).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(root, 'verification', 'v1.0')
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

let failed = 0
try {
  fs.rmSync(path.join(root, 'node_modules'), { recursive: true, force: true })
} catch (e) {
  console.warn('clean install: could not remove node_modules', e.message)
}

const lockPath = path.join(root, 'package-lock.json')
if (!fs.existsSync(lockPath)) {
  console.error('package-lock.json missing — refuse to invent a PASS without locked install')
  process.exit(1)
}

failed += run('01-clean-install', 'npm', ['ci']) ? 1 : 0
failed += run('02-lint', 'npm', ['run', 'lint']) ? 1 : 0
failed += run('03-unit-integrity', 'npm', ['test']) ? 1 : 0
failed += run('04-build', 'npm', ['run', 'build']) ? 1 : 0
failed += run('05-playwright', 'npm', ['run', 'test:e2e']) ? 1 : 0
failed += run('06-playwright-offline', 'npx', [
  'playwright',
  'test',
  '--config=playwright.offline.config.ts',
])
  ? 1
  : 0

const report = {
  milestone: 'v1.0.0',
  generatedAt: new Date().toISOString(),
  failedSteps: failed,
  node: process.version,
  install: 'npm ci',
  story:
    'Complete historical proposition registry + authentic evaluations + latest-wins review history + public v1 release',
}
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exit(failed > 0 ? 1 : 0)

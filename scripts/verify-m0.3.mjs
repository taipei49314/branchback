/**
 * Capture M0.3 verification command output into verification/m0.3/
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(root, 'verification', 'm0.3')
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

let failed = 0
fs.rmSync(path.join(root, 'node_modules'), { recursive: true, force: true })
failed += run('01-clean-install', 'npm', ['install']) ? 1 : 0
failed += run('02-lint', 'npm', ['run', 'lint']) ? 1 : 0
failed += run('03-unit-integrity', 'npm', ['test']) ? 1 : 0
failed += run('04-build', 'npm', ['run', 'build']) ? 1 : 0
failed += run('05-playwright', 'npm', ['run', 'test:e2e']) ? 1 : 0

const report = {
  milestone: 'M0.3',
  generatedAt: new Date().toISOString(),
  failedSteps: failed,
  claims: [
    'Ordinary application code cannot bypass the declared persistence authority.',
    'Every accepted post-commit historical state transition either preserves the prior state truthfully or is rejected.',
  ],
}
fs.writeFileSync(
  path.join(outDir, 'summary.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
process.exit(failed > 0 ? 1 : 0)

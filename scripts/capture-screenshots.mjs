/**
 * Capture representative screenshots from the production preview build.
 * Requires a prior `npm run build`.
 *
 * Always terminates the preview process tree (Windows-safe) and exits.
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { freeDevPorts, killProcessTree } from './lib/processCleanup.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(root, 'docs', 'screenshots')
const PREVIEW_PORT = 4177
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/`

fs.mkdirSync(outDir, { recursive: true })

freeDevPorts([PREVIEW_PORT])

const preview = spawn(
  'npm',
  ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)],
  {
    cwd: root,
    shell: true,
    stdio: 'ignore',
    // Detached false: we own the tree and kill it explicitly.
    detached: false,
  },
)

let exitCode = 0

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(PREVIEW_URL)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview server did not start')
}

function shutdownPreview() {
  if (preview.pid) killProcessTree(preview.pid)
  freeDevPorts([PREVIEW_PORT])
}

try {
  await waitForServer()
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    })
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' })
    const demo = page.getByRole('button', {
      name: /guided demo|six-decision demo/i,
    })
    if (await demo.count()) {
      await demo.first().click()
      await page.getByRole('link', { name: /Accept Staff Engineer/ }).first().waitFor({
        timeout: 20000,
      })
    }

    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' })
    await page.screenshot({
      path: path.join(outDir, 'home.png'),
      fullPage: false,
    })

    await page.goto(`${PREVIEW_URL}calibration`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Calibration' }).waitFor()
    await page.screenshot({
      path: path.join(outDir, 'calibration.png'),
      fullPage: false,
    })

    await page.goto(`${PREVIEW_URL}insights`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Insights' }).waitFor()
    await page.screenshot({
      path: path.join(outDir, 'insights.png'),
      fullPage: false,
    })

    await page.goto(`${PREVIEW_URL}decisions`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Decisions' }).waitFor()
    await page.screenshot({
      path: path.join(outDir, 'library.png'),
      fullPage: false,
    })

    console.log('screenshots written to', outDir)
  } finally {
    await browser.close()
  }
} catch (err) {
  exitCode = 1
  console.error(err instanceof Error ? err.message : err)
} finally {
  shutdownPreview()
}

process.exit(exitCode)

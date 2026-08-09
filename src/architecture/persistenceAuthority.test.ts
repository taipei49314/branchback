import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      out.push(...walk(full))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function isTestFile(file: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(file)
}

const ILLEGAL_APP_IMPORT =
  /from\s+['"](?:@\/storage\/db|\.\/db|\.\.\/storage\/db|@\/storage\/testing|\.\/testing)['"]/

describe('persistence authority architecture', () => {
  it('ordinary application modules cannot import db handles or test teardown', () => {
    const appDirs = [
      'application',
      'pages',
      'components',
      'features',
      'demo',
      'visualization',
    ]
    const violations: string[] = []
    for (const dir of appDirs) {
      const abs = path.join(root, dir)
      if (!fs.existsSync(abs)) continue
      for (const file of walk(abs)) {
        const text = fs.readFileSync(file, 'utf8')
        if (ILLEGAL_APP_IMPORT.test(text) || /getDb\s*\(/.test(text)) {
          // allow comments mentioning getDb? still fail on imports
          if (
            /import\s+.*from\s+['"]@\/storage\/db['"]/.test(text) ||
            /import\s+.*from\s+['"]\.\/db['"]/.test(text) ||
            /import\s+.*from\s+['"]\.\.\/storage\/db['"]/.test(text) ||
            /import\s+.*from\s+['"]@\/storage\/testing['"]/.test(text) ||
            /import\s+.*\{[^}]*getDb/.test(text)
          ) {
            violations.push(path.relative(root, file))
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('only repository.ts may import the internal db module among non-test sources', () => {
    const violations: string[] = []
    for (const file of walk(root)) {
      if (isTestFile(file)) continue
      const rel = path.relative(root, file).replace(/\\/g, '/')
      if (rel === 'storage/db.ts') continue
      if (rel === 'storage/testing.ts') continue
      if (rel === 'storage/repository.ts') continue
      const text = fs.readFileSync(file, 'utf8')
      if (
        /from\s+['"]\.\/db['"]/.test(text) ||
        /from\s+['"]@\/storage\/db['"]/.test(text) ||
        /from\s+['"]\.\.\/storage\/db['"]/.test(text)
      ) {
        violations.push(rel)
      }
    }
    expect(violations).toEqual([])
  })

  it('public storage barrel does not expose database write capability symbols', () => {
    const barrel = fs.readFileSync(path.join(root, 'storage/index.ts'), 'utf8')
    expect(barrel).not.toMatch(/\bgetDb\b/)
    expect(barrel).not.toMatch(/\bputDecision\b/)
    expect(barrel).not.toMatch(/\bdeleteDatabase\b/)
    expect(barrel).not.toMatch(/\bclearAllDecisions\b/)
    expect(barrel).not.toMatch(/\breplaceAllDecisions\b/)
    expect(barrel).toMatch(/DecisionRepository/)
  })

  it('storage testing harness is only imported from test files', () => {
    const violations: string[] = []
    for (const file of walk(root)) {
      if (isTestFile(file)) continue
      const rel = path.relative(root, file).replace(/\\/g, '/')
      if (rel === 'storage/testing.ts') continue
      const text = fs.readFileSync(file, 'utf8')
      if (
        /import\s+[\s\S]*?from\s+['"]@\/storage\/testing['"]/.test(text) ||
        /import\s+[\s\S]*?from\s+['"]\.\/testing['"]/.test(text) ||
        /import\s+[\s\S]*?from\s+['"]\.\.\/storage\/testing['"]/.test(text)
      ) {
        violations.push(rel)
      }
    }
    expect(violations).toEqual([])
  })
})

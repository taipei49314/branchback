import { test, expect } from '@playwright/test'
import fs from 'node:fs'

async function createMinimalDecision(
  page: import('@playwright/test').Page,
  title: string,
) {
  await page.goto('/decisions/new')
  await page.locator('input[name="title"]').fill(title)
  await page
    .locator('textarea[name="situation"]')
    .fill(`Situation for ${title}`)
  await page.getByRole('button', { name: 'Continue to options' }).click()

  async function addOption(name: string) {
    await page.locator('input[name="title"]').fill(name)
    await page.getByRole('button', { name: 'Add option' }).click()
  }
  await addOption('Option One')
  await addOption('Option Two')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Save decision' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

async function commitCurrent(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Commit decision' }).click()
  await page.getByRole('radio', { name: /Option One/ }).check()
  await page.locator('label:has-text("Decision date") input').fill('2026-08-01')
  await page.locator('label:has-text("Review date") input').fill('2099-12-31')
  await page.getByRole('button', { name: 'Create immutable snapshot' }).click()
}

test('v2 lineage: relation survives reload and tombstone keeps history', async ({
  page,
}) => {
  await createMinimalDecision(page, 'Lineage Source Alpha')
  const sourceUrl = page.url()
  await createMinimalDecision(page, 'Lineage Target Beta')

  await page.goto(sourceUrl)
  await page.locator('#lineage').scrollIntoViewIfNeeded()
  await page
    .locator('#lineage select')
    .first()
    .selectOption({ label: 'Lineage Target Beta' })
  await page.getByRole('button', { name: 'Add lineage link' }).click()
  await expect(page.getByText('Related to').first()).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('link', { name: 'Lineage Target Beta' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Remove link' }).click()
  await expect(page.getByText(/Removed lineage history/i)).toBeVisible()
})

test('v2 evidence: claimed then vs recorded-at after commit', async ({
  page,
}) => {
  await createMinimalDecision(page, 'Evidence Provenance Decision')
  await commitCurrent(page)
  await expect(
    page.getByRole('heading', { name: 'Evidence Provenance Decision' }),
  ).toBeVisible()

  await page.locator('#evidence').scrollIntoViewIfNeeded()
  await page.locator('#evidence input[name="label"]').fill('Prior briefing note')
  await page
    .locator('#evidence textarea[name="body"]')
    .fill('I had this note at decision time')
  await page.locator('#evidence select[name="availableAt"]').selectOption('then')
  await page.getByRole('button', { name: 'Add evidence' }).click()

  await expect(page.getByText(/Claimed available then/i)).toBeVisible()
  await expect(page.getByText(/recorded later/i)).toBeVisible()

  await page.reload()
  await expect(page.getByText(/Claimed available then/i)).toBeVisible()
})

test('v2 history search shows temporal provenance', async ({ page }) => {
  await createMinimalDecision(page, 'Searchable Unique Phrase Decision')
  await commitCurrent(page)

  await page.getByRole('link', { name: 'Record later change' }).click()
  await page
    .getByLabel(/Reason for this later change/)
    .fill('UniqueZebraRevisionToken after commit')
  await page.getByRole('button', { name: 'Save revision' }).click()

  await page.goto('/search')
  await page.getByLabel('Query').fill('UniqueZebraRevisionToken')
  await expect(page.getByText(/Revision/i).first()).toBeVisible({
    timeout: 15000,
  })
})

test('v2 dossier download contains Known Then layer', async ({ page }) => {
  await page.goto('/')
  const demo = page.getByRole('button', {
    name: /guided demo|six-decision demo/i,
  })
  if (await demo.count()) {
    await demo.first().click()
    await page.waitForTimeout(800)
  }
  await page.goto('/decisions')
  await page.getByRole('link', { name: /Accept Staff Engineer/ }).first().click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download dossier' }).click(),
  ])
  const path = await download.path()
  expect(path).toBeTruthy()
  const text = fs.readFileSync(path!, 'utf8')
  expect(text).toMatch(/Known Then|Immutable commit snapshot/i)
  expect(text).not.toMatch(/undefined/)
})

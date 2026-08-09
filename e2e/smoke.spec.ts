import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

test('lifecycle: create → commit → reload → revise → review → Known Then intact', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'New', exact: true }).click()

  await page.locator('input[name="title"]').fill('Lifecycle Demo Decision')
  await page
    .locator('textarea[name="situation"]')
    .fill('Known then: limited runway')
  await page.getByRole('button', { name: 'Continue to options' }).click()

  async function addOption(title: string) {
    await page.locator('input[name="title"]').fill(title)
    await page.getByRole('button', { name: 'Add option' }).click()
  }
  await addOption('Ship now')
  await addOption('Wait a quarter')
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.locator('input[name="statement"]').fill('Demand holds')
  await page.getByRole('button', { name: 'Add assumption' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.locator('input[name="statement"]').fill('Ten users in 14 days')
  await page.locator('input[name="expectedResult"]').fill('10')
  await page.locator('input[name="expectedDate"]').fill('2099-12-01')
  await page.getByRole('button', { name: 'Add prediction' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Save decision' }).click()

  await page.getByRole('link', { name: 'Commit decision' }).click()
  await page.getByRole('radio', { name: /Ship now/ }).check()
  await page.locator('label:has-text("Decision date") input').fill('2026-08-08')
  await page.locator('label:has-text("Review date") input').fill('2099-12-31')
  await page.getByRole('button', { name: 'Create immutable snapshot' }).click()

  await expect(page.locator('#then')).toContainText('Known then: limited runway')
  const snapId = (
    await page.locator('#then code').first().textContent()
  )?.trim()
  expect(snapId).toMatch(/^snap_/)

  await page.reload()
  await expect(page.locator('#then')).toContainText(snapId!)

  await page.locator(`a.btn[href="/decisions/${await decisionIdFromUrl(page)}/revise"]`).click()
  await page
    .getByLabel(/Reason for this later change/)
    .fill('Clarified stakes after a board conversation')
  await page.getByLabel(/^Title$/).fill('Lifecycle Demo Decision (clarified)')
  await page.getByRole('button', { name: 'Save revision' }).click()

  await expect(page.locator('#history')).toContainText('Revision 1')
  await expect(page.locator('#then')).toContainText('Known then: limited runway')
  await expect(page.locator('#then')).toContainText(snapId!)

  await page.locator('a.btn.primary[href$="/review"]').click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Continue to reality' }).click()
  await page
    .getByLabel(/What actually happened/)
    .fill('Shipped; demand was uneven but survivable.')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue to ratings' }).click()
  await page.getByRole('button', { name: 'Preview summary' }).click()
  await page.getByRole('button', { name: 'Save review' }).click()

  await expect(page.locator('#review')).toContainText('Outcome quality')
  await expect(page.locator('#then')).toContainText(snapId!)
})

async function decisionIdFromUrl(page: import('@playwright/test').Page): Promise<string> {
  const url = page.url()
  const match = url.match(/\/decisions\/(dec_[^/#?]+)/)
  if (!match?.[1]) throw new Error(`No decision id in ${url}`)
  return match[1]
}
test('integrity path: create → commit → reload → review mutation → reload → export/import', async ({
  page,
}) => {
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-e2e-'))

  await page.goto('/')
  await page.getByRole('link', { name: 'New', exact: true }).click()
  await page.locator('input[name="title"]').fill('Integrity E2E Decision')
  await page
    .locator('textarea[name="situation"]')
    .fill('Known then: limited budget')
  await page.getByRole('button', { name: 'Continue to options' }).click()

  async function addOption(title: string, probability: string) {
    await page.locator('input[name="title"]').fill(title)
    await page.locator('input[name="probability"]').fill(probability)
    await page.getByRole('button', { name: 'Add option' }).click()
  }
  await addOption('Option Keep', '70')
  await addOption('Option Pass', '30')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('input[name="statement"]').fill('Cash runway lasts 6 months')
  await page.getByRole('button', { name: 'Add assumption' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page
    .locator('input[name="statement"]')
    .fill('Prototype usable by ten people')
  await page.locator('input[name="expectedResult"]').fill('10 users')
  await page.locator('input[name="expectedDate"]').fill('2099-12-01')
  await page.getByRole('button', { name: 'Add prediction' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Save decision' }).click()

  await page.getByRole('link', { name: 'Commit decision' }).click()
  await page.getByRole('radio', { name: /Option Keep/ }).check()
  await page.locator('label:has-text("Decision date") input').fill('2026-08-08')
  await page.locator('label:has-text("Review date") input').fill('2099-12-31')
  await page.getByRole('button', { name: 'Create immutable snapshot' }).click()

  const snapshotId = (
    await page.locator('#then code').first().textContent()
  )?.trim()
  expect(snapshotId).toMatch(/^snap_/)

  await page.reload()
  await expect(page.locator('#then')).toContainText(snapshotId!)

  await page.locator('a.btn.primary[href$="/review"]').click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Continue to reality' }).click()
  await page
    .getByLabel(/What actually happened/)
    .fill('Reality differed, but Known Then must stay frozen.')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue to ratings' }).click()
  await page.getByRole('button', { name: 'Preview summary' }).click()
  await page.getByRole('button', { name: 'Save review' }).click()
  await expect(page.locator('#review')).toContainText('Outcome quality')

  await page.reload()
  await expect(page.locator('#then')).toContainText(snapshotId!)

  await page.getByRole('link', { name: 'Settings' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download JSON backup' }).click()
  const download = await downloadPromise
  const exportPath = path.join(downloadDir, await download.suggestedFilename())
  await download.saveAs(exportPath)
  await page.setInputFiles('input[type="file"]', exportPath)
  await page.getByRole('button', { name: 'Confirm import' }).click()
  await expect(page.getByText(/Imported \d+ decisions/)).toBeVisible()

  await page.getByRole('link', { name: 'Decisions' }).click()
  await page.getByRole('link', { name: 'Integrity E2E Decision' }).click()
  await expect(page.locator('#then')).toContainText(snapshotId!)
})

test('demo + attention surfaces', async ({ page }) => {
  await page.goto('/')
  const demoBtn = page.getByRole('button', {
    name: /guided demo|six-decision demo/i,
  })
  if (await demoBtn.count()) {
    await demoBtn.first().click()
  }
  await page.getByLabel('Primary').getByRole('link', { name: 'Decisions' }).click()
  await expect(
    page.getByRole('link', { name: /Accept Staff Engineer/ }).first(),
  ).toBeVisible({ timeout: 15000 })
  await page.getByLabel('Primary').getByRole('link', { name: 'Timeline' }).click()
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible()
  await page
    .getByLabel('Primary')
    .getByRole('link', { name: 'Calibration' })
    .click()
  await expect(page.getByText('Text summary')).toBeVisible()
  await page.getByLabel('Primary').getByRole('link', { name: 'Insights' }).click()
  await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible()
})

test('keyboard: open new decision from home', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'New decision' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/decisions\/new/)
})

test('removed commit prediction remains evaluable in Review', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'New', exact: true }).click()
  await page.locator('input[name="title"]').fill('Temporal Identity E2E')
  await page
    .locator('textarea[name="situation"]')
    .fill('Commit a prediction then remove it from working state')
  await page.getByRole('button', { name: 'Continue to options' }).click()
  await page.locator('input[name="title"]').fill('Go')
  await page.getByRole('button', { name: 'Add option' }).click()
  await page.locator('input[name="title"]').fill('Wait')
  await page.getByRole('button', { name: 'Add option' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('input[name="statement"]').fill('Ship by June')
  await page.locator('input[name="expectedResult"]').fill('shipped')
  await page.locator('input[name="expectedDate"]').fill('2099-06-01')
  await page.getByRole('button', { name: 'Add prediction' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Save decision' }).click()

  await page.getByRole('link', { name: 'Commit decision' }).click()
  await page.getByRole('radio', { name: /Go/ }).check()
  await page.locator('label:has-text("Decision date") input').fill('2026-08-08')
  await page.locator('label:has-text("Review date") input').fill('2099-12-31')
  await page.getByRole('button', { name: 'Create immutable snapshot' }).click()

  await page.locator('a.btn[href$="/revise"]').click()
  await page.getByLabel(/Reason for this later change/).fill('Remove prediction from working state')
  await page.getByRole('button', { name: 'Predictions' }).click()
  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByRole('button', { name: 'Save revision' }).click()

  await page.locator('a.btn.primary[href$="/review"]').click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Continue to reality' }).click()
  await page
    .getByLabel(/What actually happened/)
    .fill('Never shipped; historical claim still matters.')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(
    page.getByTestId('hist-pred-removed-from-working'),
  ).toBeVisible()
  await expect(page.getByTestId('hist-pred-removed-from-working')).toContainText(
    'Ship by June',
  )
  await expect(page.getByTestId('hist-pred-removed-from-working')).toContainText(
    /removed from working state/i,
  )
})

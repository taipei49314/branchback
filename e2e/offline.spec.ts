import { test, expect } from '@playwright/test'

/**
 * Offline evidence against the production preview build (service worker).
 * Run via: npm run test:e2e:offline (requires prior `npm run build`).
 */
test.describe('offline PWA', () => {
  test('decision remains usable after going offline', async ({
    page,
    context,
  }) => {
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
    ).toBeVisible({ timeout: 20000 })

    // Allow SW registration / caching after first online load.
    await page.waitForTimeout(2000)
    await page.goto('/')
    await page.getByLabel('Primary').getByRole('link', { name: 'Decisions' }).click()
    await expect(
      page.getByRole('link', { name: /Accept Staff Engineer/ }).first(),
    ).toBeVisible({ timeout: 20000 })

    await context.setOffline(true)
    await page.reload()
    await expect(
      page.getByRole('link', { name: /Accept Staff Engineer/ }).first(),
    ).toBeVisible({ timeout: 20000 })
    await page.getByRole('link', { name: /Accept Staff Engineer/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /Staff Engineer/i,
    )
    await expect(page.locator('#then')).toBeVisible()
    await context.setOffline(false)
  })
})

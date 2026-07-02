import type { Page } from '@playwright/test'

import { expect, test } from '../helpers/fixtures'
import {
  setDesktopViewport,
  waitForVisualStability,
} from '../helpers/test-utils'

test.use({ useAuth: false })

async function triggerRenderError(page: Page): Promise<void> {
  await setDesktopViewport(page)
  await page.goto('/debug/sentry')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Throw Render Error' }).click()
  await expect(
    page.getByRole('heading', { name: 'Spell Fizzled' }),
  ).toBeVisible()
  await waitForVisualStability(page, { timeout: 300 })
}

test.describe('Error Page Visual Tests', () => {
  test('full-screen error page', async ({ page }) => {
    await triggerRenderError(page)

    await expect(page).toHaveScreenshot('error-page.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    })
  })

  test('error report dialog', async ({ page }) => {
    await triggerRenderError(page)
    await page.getByRole('button', { name: 'Report this fizzle' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Report this fizzle' }),
    ).toBeVisible()

    await expect(page).toHaveScreenshot('error-report-dialog.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    })
  })
})

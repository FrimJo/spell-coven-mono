import { expect, test } from '../helpers/fixtures'
import { setDesktopViewport } from '../helpers/test-utils'

/**
 * Visual regression tests for the landing page.
 * These tests capture and compare screenshots to detect unintended UI changes.
 */
test.use({ useAuth: false })

test.describe('Landing Page Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Use unauthenticated state for consistent visuals
    await page.goto('/')
    // Wait for fonts and page to stabilize
    await page.waitForLoadState('networkidle')
    // Additional wait for any animations to settle
    await page.waitForTimeout(500)
  })

  test.describe('Full Page Screenshots', () => {
    test('landing page - full page (unauthenticated)', async ({ page }) => {
      await setDesktopViewport(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      await expect(page).toHaveScreenshot('landing-page-full.png', {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.02, // allow up to 2% of pixels to differ
      })
    })

    test('landing page - above the fold / hero section', async ({ page }) => {
      await setDesktopViewport(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Capture just the viewport (above the fold)
      await expect(page).toHaveScreenshot('landing-page-hero.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      })
    })
  })

  test.describe('Section Screenshots', () => {
    test('header section', async ({ page }) => {
      await setDesktopViewport(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const header = page.locator('header')
      await expect(header).toHaveScreenshot('landing-header.png', {
        animations: 'disabled',
      })
    })

    test('features section', async ({ page }) => {
      await setDesktopViewport(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const featuresSection = page.locator('#features')
      await featuresSection.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)

      await expect(featuresSection).toHaveScreenshot('landing-features.png', {
        animations: 'disabled',
      })
    })

    test('how it works section', async ({ page }) => {
      await setDesktopViewport(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const howItWorksSection = page.locator('#how-it-works')
      await howItWorksSection.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)

      await expect(howItWorksSection).toHaveScreenshot(
        'landing-how-it-works.png',
        {
          animations: 'disabled',
        },
      )
    })

    test('footer section', async ({ page }) => {
      await setDesktopViewport(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const footer = page.locator('footer')
      await footer.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)

      await expect(footer).toHaveScreenshot('landing-footer.png', {
        animations: 'disabled',
      })
    })

    test('CTA section', async ({ page }) => {
      await setDesktopViewport(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Scroll to the CTA section (Ready to Enter the Coven?)
      const ctaHeading = page.getByText('Ready to Enter the Coven?')
      await ctaHeading.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)

      // Capture the parent section
      const ctaSection = ctaHeading.locator('..').locator('..')
      await expect(ctaSection).toHaveScreenshot('landing-cta.png', {
        animations: 'disabled',
      })
    })
  })
})

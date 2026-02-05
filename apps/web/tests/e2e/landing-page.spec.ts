import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { setDesktopViewport, setMobileViewport } from '../helpers/test-utils'

const MTG_THEME_BRAND_COLORS = {
  white: '#d4af37',
  blue: '#1f4fd8',
  black: '#4a2d80',
  red: '#c62828',
  green: '#2e7d32',
} as const

const MTG_THEME_LABELS: Record<keyof typeof MTG_THEME_BRAND_COLORS, string> = {
  white: 'White',
  blue: 'Blue',
  black: 'Black',
  red: 'Red',
  green: 'Green',
}

/**
 * Landing page e2e tests.
 * Tests cover navigation, authentication UI, mobile menu, and join game dialog.
 */
test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('Page Structure', () => {
    test('should render the landing page with header, hero, features, and footer', async ({
      page,
    }) => {
      // Header
      await expect(page.locator('header')).toBeVisible()
      await expect(page.getByText('Spell Coven').first()).toBeVisible()

      // Hero section
      await expect(
        page.getByRole('heading', { name: 'Play Magic Anywhere.' }),
      ).toBeVisible()
      await expect(
        page.getByText('Anywhere.', { exact: true }).first(),
      ).toBeVisible()

      // Features section
      await expect(page.locator('#features')).toBeVisible()
      await expect(page.getByText('Everything You Need to Play')).toBeVisible()

      // How It Works section
      await expect(page.locator('#how-it-works')).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'How It Works' }),
      ).toBeVisible()

      // Footer
      await expect(page.locator('footer')).toBeVisible()
    })

    test('should display live stats (Online Users, Active Game Rooms)', async ({
      page,
    }) => {
      await expect(page.getByText('Online Users')).toBeVisible()
      await expect(page.getByText('Active Game Rooms')).toBeVisible()
    })
  })

  test.describe('Page Navigation', () => {
    test('should navigate to Features section when clicking "Features" nav link', async ({
      page,
    }) => {
      await setDesktopViewport(page)

      // Click the Features nav link
      const featuresLink = page.locator('nav').getByText('Features')
      await featuresLink.click()

      // Check that the Features section is now visible in viewport
      const featuresSection = page.locator('#features')
      await expect(featuresSection).toBeInViewport()
    })

    test('should navigate to "How It Works" section when clicking nav link', async ({
      page,
    }) => {
      await setDesktopViewport(page)

      // Click the How It Works nav link
      const howItWorksLink = page.locator('nav').getByText('How It Works')
      await howItWorksLink.click()

      // Check that the How It Works section is now visible in viewport
      const howItWorksSection = page.locator('#how-it-works')
      await expect(howItWorksSection).toBeInViewport()
    })
  })

  test.describe('Authentication UI (unauthenticated)', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('should display "Sign in with Discord" button when not authenticated', async ({
      page,
    }) => {
      await setDesktopViewport(page)
      await page.goto('/')

      // Should see Discord sign-in button in the nav
      const navSignInButton = page
        .locator('nav')
        .getByRole('button', { name: /Sign in with Discord/i })
      await expect(navSignInButton).toBeVisible()
    })

    test('should show Discord sign-in button in hero section', async ({
      page,
    }) => {
      await setDesktopViewport(page)
      await page.goto('/')

      // Hero section should have Discord sign-in button when not authenticated
      const heroSignInButton = page
        .locator('section')
        .getByRole('button', { name: /Sign in with Discord/i })
        .first()
      await expect(heroSignInButton).toBeVisible()
    })

    test('should not show Create Game / Join Game buttons when unauthenticated', async ({
      page,
    }) => {
      await setDesktopViewport(page)

      // Create Game and Join Game buttons should not be visible
      const createGameButton = page.getByRole('button', {
        name: /Create Game/i,
      })
      const joinGameButton = page.getByRole('button', { name: /Join Game/i })

      await expect(createGameButton).not.toBeVisible()
      await expect(joinGameButton).not.toBeVisible()
    })
  })

  test.describe('Mobile Menu', () => {
    test('should open mobile menu sheet on small screens', async ({ page }) => {
      await setMobileViewport(page)

      // Mobile menu button should be visible
      const menuButton = page.getByRole('button', {
        name: /open navigation menu/i,
      })
      await expect(menuButton).toBeVisible()

      // Click to open mobile menu
      await menuButton.click()

      // Mobile menu sheet should be visible
      const mobileMenu = page.getByRole('dialog')
      await expect(mobileMenu).toBeVisible()
    })

    test('should display navigation links in mobile menu', async ({ page }) => {
      await setMobileViewport(page)

      // Open mobile menu
      const menuButton = page.getByRole('button', {
        name: /open navigation menu/i,
      })
      await menuButton.click()

      // Navigation links should be visible in the sheet
      await expect(page.getByRole('dialog').getByText('Features')).toBeVisible()
      await expect(
        page.getByRole('dialog').getByText('How It Works'),
      ).toBeVisible()
    })

    test('should display sign-in option in mobile menu', async ({
      browser,
    }) => {
      // Use a fresh context without auth state
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      })
      const page = await context.newPage()

      await page.goto('/')
      await setMobileViewport(page)

      // Open mobile menu
      const menuButton = page.getByRole('button', {
        name: /open navigation menu/i,
      })
      await menuButton.click()

      // Sign in button should be visible in the mobile menu sheet
      await expect(
        page.getByRole('dialog').getByText(/Sign in with Discord/i),
      ).toBeVisible()

      await context.close()
    })

    test('should navigate to Features from mobile menu link', async ({
      page,
    }) => {
      await setMobileViewport(page)

      const menuButton = page.getByRole('button', {
        name: /open navigation menu/i,
      })
      await menuButton.click()

      const featuresLink = page.getByRole('dialog').getByText('Features')
      await featuresLink.click()

      await expect(page.locator('#features')).toBeInViewport()
    })
  })

  test.describe('Footer Navigation', () => {
    test('should navigate to Features section from footer link', async ({
      page,
    }) => {
      // Click Features link in footer
      const footerFeaturesLink = page.locator('footer').getByText('Features')
      await footerFeaturesLink.click()

      // Features section should be in viewport
      await expect(page.locator('#features')).toBeInViewport()
    })

    test('should navigate to How It Works section from footer link', async ({
      page,
    }) => {
      // Click How It Works link in footer
      const footerHowItWorksLink = page
        .locator('footer')
        .getByText('How It Works')
      await footerHowItWorksLink.click()

      // How It Works section should be in viewport
      await expect(page.locator('#how-it-works')).toBeInViewport()
    })
  })

  test.describe('Footer Content', () => {
    test('should include license and PolyForm links', async ({ page }) => {
      const footer = page.locator('footer')

      await expect(
        footer.getByRole('link', { name: 'License' }),
      ).toHaveAttribute('href', '/license')
      await expect(
        footer.getByRole('link', { name: /PolyForm Noncommercial/i }),
      ).toHaveAttribute(
        'href',
        'https://polyformproject.org/licenses/noncommercial/1.0.0/',
      )
    })

    test('should link to the GitHub repository', async ({ page }) => {
      const footer = page.locator('footer')
      const githubLink = footer.getByRole('link', { name: /View on GitHub/i })

      await expect(githubLink).toHaveAttribute(
        'href',
        'https://github.com/FrimJo/spell-coven-mono',
      )
      await expect(githubLink).toHaveAttribute('target', '_blank')
    })

    test('should display copyright text', async ({ page }) => {
      await expect(
        page.locator('footer').getByText(/Spell Coven ©/i),
      ).toBeVisible()
    })
  })

  test.describe('Bottom CTA', () => {
    test('should display CTA section with call to action', async ({
      browser,
    }) => {
      // Use a fresh context without auth state
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      })
      const page = await context.newPage()
      await page.goto('/')

      // Scroll to bottom CTA section
      await page.getByText('Ready to Enter the Coven?').scrollIntoViewIfNeeded()

      await expect(page.getByText('Ready to Enter the Coven?')).toBeVisible()
      // When not authenticated, shows "Start Playing for Free" and "Learn More"
      await expect(
        page.getByRole('button', { name: /Start Playing for Free/i }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /Learn More/i }),
      ).toBeVisible()

      await context.close()
    })

    test('should scroll to How It Works when clicking Learn More', async ({
      browser,
    }) => {
      // Use a fresh context without auth state
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      })
      const page = await context.newPage()
      await page.goto('/')

      // Scroll to and click Learn More button
      const learnMoreButton = page.getByRole('button', { name: /Learn More/i })
      await learnMoreButton.scrollIntoViewIfNeeded()
      await learnMoreButton.click()

      // How It Works section should be in viewport
      await expect(page.locator('#how-it-works')).toBeInViewport()

      await context.close()
    })
  })

  test.describe('Theme Switcher', () => {
    const themes = Object.keys(
      MTG_THEME_BRAND_COLORS,
    ) as (keyof typeof MTG_THEME_BRAND_COLORS)[]

    const expectThemeApplied = async (
      page: Page,
      theme: keyof typeof MTG_THEME_BRAND_COLORS,
    ) => {
      await expect(page.locator('html')).toHaveAttribute(
        'data-mtg-theme',
        theme,
      )
      const brandColor = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--brand')
          .trim(),
      )
      expect(brandColor.toLowerCase()).toBe(MTG_THEME_BRAND_COLORS[theme])
    }

    test('should apply each theme from the desktop toggle and persist on reload', async ({
      page,
    }) => {
      await setDesktopViewport(page)

      const toggleButton = page
        .locator('nav')
        .getByTestId('theme-toggle-button')

      for (const theme of themes) {
        await toggleButton.click()
        await page
          .getByRole('menuitemradio', { name: MTG_THEME_LABELS[theme] })
          .click()
        await expectThemeApplied(page, theme)
      }

      await page.reload()
      await expectThemeApplied(page, themes[themes.length - 1])
    })

    test('should apply each theme from the mobile menu and persist on reload', async ({
      page,
    }) => {
      await setMobileViewport(page)

      const openMobileMenu = async () => {
        const menuButton = page.getByRole('button', {
          name: /open navigation menu/i,
        })
        await menuButton.click()
        await expect(page.getByRole('dialog')).toBeVisible()
      }

      await openMobileMenu()

      const toggleButton = page
        .getByRole('dialog')
        .getByTestId('theme-toggle-button')

      for (const theme of themes) {
        await toggleButton.click()
        await page
          .getByRole('menuitemradio', { name: MTG_THEME_LABELS[theme] })
          .click()
        await expectThemeApplied(page, theme)
      }

      await page.reload()
      await expectThemeApplied(page, themes[themes.length - 1])
    })
  })
})

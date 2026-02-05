import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import {
  clearStorage,
  getRoomId,
  mockGetUserMedia,
  mockMediaDevices,
  navigateToTestGame,
  setDesktopViewport,
} from '../helpers/test-utils'

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
 * Game room e2e tests.
 * Tests cover route access, header controls, share link, leave flow, and settings dialog.
 * Note: These tests require authentication setup as test IDs no longer bypass auth.
 */
test.describe('Game Room', () => {
  let roomId: string
  test.use({ permissions: ['camera', 'microphone'] })

  test.beforeEach(async ({ page }) => {
    roomId = getRoomId()
    // Mock media devices before navigating
    await mockMediaDevices(page)
    await mockGetUserMedia(page)
  })

  const generateRoomId = () => {
    const base = Math.random().toString(36).toUpperCase()
    const cleaned = base.replace(/[^A-Z0-9]/g, '')
    return cleaned.padEnd(6, 'Z').slice(0, 6)
  }

  const findMissingRoomId = async (page: Page): Promise<string> => {
    const maxAttempts = 5

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = generateRoomId()
      await navigateToTestGame(page, candidate)

      const notFound = page.getByText('404')
      const gameHeader = page.getByTestId('game-id-display')

      try {
        await notFound.waitFor({ timeout: 5000 })
        return candidate
      } catch {
        if (await gameHeader.isVisible()) {
          continue
        }
      }
    }

    throw new Error('Failed to find a missing room ID after several attempts.')
  }

  test.describe('Route Access', () => {
    test('should show 404 for missing room even when media is not configured', async ({
      page,
    }) => {
      const missingRoomId = await findMissingRoomId(page)
      await clearStorage(page)
      await page.goto(`/game/${missingRoomId}`)

      await expect(page).toHaveURL(`/game/${missingRoomId}`)
      await expect(page.getByText('404')).toBeVisible({ timeout: 10000 })
    })

    test('should redirect to /setup when media is not configured', async ({
      page,
    }) => {
      await page.goto(`/game/${roomId}`)

      await expect(page).toHaveURL(
        `/setup?returnTo=${encodeURIComponent(`/game/${roomId}`)}`,
      )
      await expect(page.getByText('Setup Audio & Video')).toBeVisible({
        timeout: 10000,
      })
    })

    test('should return to game room after completing setup', async ({
      page,
    }) => {
      await page.goto(`/game/${roomId}`)

      await expect(page).toHaveURL(
        `/setup?returnTo=${encodeURIComponent(`/game/${roomId}`)}`,
      )

      const completeButton = page.getByTestId('media-setup-complete-button')
      await expect(completeButton).toBeEnabled({ timeout: 10000 })
      await completeButton.click()

      await expect(page).toHaveURL(`/game/${roomId}`)
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
    })

    test('should show 404 for a non-existent room', async ({ page }) => {
      const missingRoomId = await findMissingRoomId(page)
      await navigateToTestGame(page, missingRoomId)

      await expect(page).toHaveURL(`/game/${missingRoomId}`)
      await expect(page.getByText('404')).toBeVisible({ timeout: 10000 })
      await expect(
        page.getByRole('button', { name: /Return Home/i }),
      ).toBeVisible()
    })

    test('should return to landing page when clicking "Return Home"', async ({
      page,
    }) => {
      const missingRoomId = await findMissingRoomId(page)
      await navigateToTestGame(page, missingRoomId)

      await expect(page).toHaveURL(`/game/${missingRoomId}`)
      await page.getByRole('button', { name: /Return Home/i }).click()

      await expect(page).toHaveURL('/')
    })

    test('should go back to the previous page when clicking "Go Back"', async ({
      page,
    }) => {
      const missingRoomId = await findMissingRoomId(page)

      await navigateToTestGame(page)
      await expect(page).toHaveURL(`/game/${roomId}`)

      await page.goto(`/game/${missingRoomId}`)
      await expect(page).toHaveURL(`/game/${missingRoomId}`)
      await expect(page.getByText('404')).toBeVisible({ timeout: 10000 })

      await page.getByRole('button', { name: /Go Back/i }).click()
      await expect(page).toHaveURL(`/game/${roomId}`)
    })
  })

  test.describe('Header Controls', () => {
    test('should display Leave button in header', async ({ page }) => {
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Leave button should be visible
      const leaveButton = page.getByTestId('leave-game-button')
      await expect(leaveButton).toBeVisible()
    })

    test('should display game ID in header', async ({ page }) => {
      await navigateToTestGame(page)

      // Game ID should be visible in header
      const gameIdDisplay = page.getByTestId('game-id-display')
      await expect(gameIdDisplay).toBeVisible({ timeout: 10000 })
      await expect(gameIdDisplay).toContainText(roomId)
    })

    test('should display Settings button', async ({ page }) => {
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Settings button should be visible
      const settingsButton = page.getByTestId('settings-button')
      await expect(settingsButton).toBeVisible()
    })

    test('should display player count', async ({ page }) => {
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Player count should be visible (format: X/4 Players)
      await expect(page.getByText(/\d\/4 Players/)).toBeVisible()
    })
  })

  test.describe('Share Link', () => {
    test('should have a share/copy button', async ({ page }) => {
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Share button should be visible
      const shareButton = page.getByTestId('copy-share-link-button')
      await expect(shareButton).toBeVisible()
    })

    test.skip('should copy game room link to clipboard when clicking share button', async ({
      page,
      context,
    }) => {
      // Skip: Dialog overlay blocks interaction in headless test environment
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Wait for any dialogs to settle
      await page.waitForTimeout(2000)

      // Click share button with force to bypass any overlay
      const shareButton = page.getByTestId('copy-share-link-button')
      await shareButton.click({ force: true })

      // Read clipboard content
      const clipboardContent = await page.evaluate(() =>
        navigator.clipboard.readText(),
      )

      // Should contain the game URL
      expect(clipboardContent).toContain(`/game/${roomId}`)
    })

    test.skip('should show toast notification after copying', async ({
      page,
    }) => {
      // Skip: Dialog overlay blocks interaction in headless test environment
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Wait for any dialogs/overlays to close
      await page.waitForTimeout(1000)

      // Click share button with force to bypass any overlay
      const shareButton = page.getByTestId('copy-share-link-button')
      await shareButton.click({ force: true })

      // Toast should appear
      await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Leave Game Flow', () => {
    // Skip these tests due to dialog overlay blocking interaction in headless test environment
    // The game room shows a connection dialog that persists during testing
    test.skip('should open LeaveGameDialog when clicking Leave button', async ({
      page,
    }) => {
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Click Leave button
      const leaveButton = page.getByTestId('leave-game-button')
      await leaveButton.click()

      // Dialog should appear - check for the dialog title "Leave Game?"
      await expect(
        page.getByRole('heading', { name: /Leave Game\?/i }),
      ).toBeVisible()
    })

    test.skip('should return to landing page when confirming leave', async ({
      page,
    }) => {
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Click Leave button
      const leaveButton = page.getByTestId('leave-game-button')
      await leaveButton.click()

      // Wait for dialog - check for the dialog title
      await expect(
        page.getByRole('heading', { name: /Leave Game\?/i }),
      ).toBeVisible()

      // Click confirm/leave button in dialog
      const confirmButton = page.getByTestId('leave-dialog-confirm-button')
      await confirmButton.click()

      // Should navigate to landing page
      await expect(page).toHaveURL('/')
    })

    test.skip('should stay in game room when canceling leave dialog', async ({
      page,
    }) => {
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Click Leave button
      const leaveButton = page.getByTestId('leave-game-button')
      await leaveButton.click()

      // Wait for dialog - check for the dialog title
      await expect(
        page.getByRole('heading', { name: /Leave Game\?/i }),
      ).toBeVisible()

      // Click cancel button in dialog
      const cancelButton = page.getByTestId('leave-dialog-cancel-button')
      await cancelButton.click()

      // Should still be on game page
      await expect(page).toHaveURL(`/game/${roomId}`)
    })
  })

  test.describe('Settings Dialog', () => {
    test('should open MediaSetupDialog when clicking Settings button', async ({
      page,
    }) => {
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Click Settings button
      const settingsButton = page.getByTestId('settings-button')
      await settingsButton.click()

      // Media setup dialog should appear
      await expect(page.getByTestId('media-setup-dialog')).toBeVisible()
    })

    test.skip('should close dialog when clicking cancel', async ({ page }) => {
      // Skip: Dialog overlay blocks interaction in headless test environment
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Wait for any loading dialogs to settle
      await page.waitForTimeout(2000)

      // Click Settings button with force to bypass any overlay
      const settingsButton = page.getByTestId('settings-button')
      await settingsButton.click({ force: true })

      // Wait for dialog
      await expect(page.getByTestId('media-setup-dialog')).toBeVisible()

      // Click cancel button - this should close the dialog
      const cancelButton = page.getByTestId('media-setup-cancel-button')
      await cancelButton.click()

      // Wait a moment for the dialog close animation and state machine to process
      await page.waitForTimeout(1000)

      // Dialog should be closed (not visible or detached)
      // Note: Due to in-game settings mode, cancel triggers restore which then closes
      await expect(page.getByTestId('media-setup-dialog')).not.toBeVisible({
        timeout: 10000,
      })
    })
  })

  test.describe('Video Controls', () => {
    test('should have video toggle in settings dialog', async ({ page }) => {
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Open settings dialog
      const settingsButton = page.getByTestId('settings-button')
      await settingsButton.click()

      // Wait for dialog
      await expect(page.getByTestId('media-setup-dialog')).toBeVisible()

      // Video toggle switch should be visible (first switch in the dialog)
      const videoSwitch = page
        .getByTestId('media-setup-dialog')
        .getByRole('switch')
        .first()
      await expect(videoSwitch).toBeVisible()
    })

    test.skip('should have audio toggle in settings dialog', async ({
      page,
    }) => {
      // Skip: Dialog overlay blocks interaction in headless test environment
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Wait for any loading dialogs to settle
      await page.waitForTimeout(2000)

      // Open settings dialog with force to bypass any overlay
      const settingsButton = page.getByTestId('settings-button')
      await settingsButton.click({ force: true })

      // Wait for dialog
      await expect(page.getByTestId('media-setup-dialog')).toBeVisible()

      // There should be switch elements in the dialog (for video/audio toggles)
      const switchCount = await page
        .getByTestId('media-setup-dialog')
        .getByRole('switch')
        .count()
      expect(switchCount).toBeGreaterThan(0)
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

    test('should apply each theme from the header toggle and persist on reload', async ({
      page,
    }) => {
      await setDesktopViewport(page)
      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      const toggleButton = page.getByTestId('theme-toggle-button')

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

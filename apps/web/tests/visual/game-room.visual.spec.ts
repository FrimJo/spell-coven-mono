import { expect, test } from '@playwright/test'

import {
  AUTH_STATE_PATH,
  getRoomId,
  hasAuthStorageState,
  mockGetUserMedia,
  mockMediaDevices,
  navigateToTestGame,
  readCachedRoomId,
} from '../helpers/test-utils'

/**
 * Visual regression tests for the game room.
 * These tests capture and compare screenshots of the game room UI,
 * including commander viewing and selection flows.
 */
test.describe('Game Room Visual Tests', () => {
  let roomId: string
  test.use({ storageState: AUTH_STATE_PATH })
  test.use({ permissions: ['camera', 'microphone'] })

  test.beforeEach(async ({ page }) => {
    if (!hasAuthStorageState()) {
      test.skip(
        'Auth storage state missing. Run auth.setup.ts or the full Playwright project chain.',
      )
    }
    const cachedRoomId = readCachedRoomId()
    if (!cachedRoomId) {
      test.skip('Room state missing. Run room.setup.ts first.')
    }
    roomId = cachedRoomId ?? getRoomId()
    // Mock media devices before navigating
    await mockMediaDevices(page)
    await mockGetUserMedia(page)
  })

  test.describe('Game Room Layout', () => {
    test('game room - initial state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000) // Allow video streams and UI to stabilize

      await expect(page).toHaveScreenshot('game-room-initial.png', {
        animations: 'disabled',
        // Mask video elements as they may have slight variations
        mask: [page.locator('video')],
      })
    })

    test('game room - header controls', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Capture the header area with controls
      const header = page.locator('header').first()
      await expect(header).toHaveScreenshot('game-room-header.png', {
        animations: 'disabled',
      })
    })
  })

  test.describe('Player Stats Overlay', () => {
    test('player stats overlay - visible state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Find the stats overlay (health/poison controls on video cards)
      const statsOverlay = page.locator('.absolute.left-3.top-16').first()

      // Wait for stats to be visible
      await expect(statsOverlay).toBeVisible({ timeout: 5000 })

      await expect(statsOverlay).toHaveScreenshot('player-stats-overlay.png', {
        animations: 'disabled',
      })
    })
  })

  test.describe('Commander Panel', () => {
    test('commander panel - opened state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Click the COMMANDERS button to open the GameStatsPanel
      const commandersButton = page.getByRole('button', { name: 'COMMANDERS' })
      await expect(commandersButton.first()).toBeVisible({ timeout: 5000 })
      await commandersButton.first().click()

      // Wait for panel to open
      await page.waitForTimeout(500)

      // The GameStatsPanel should now be visible
      // Look for the panel dialog/sheet
      const panel = page.getByRole('dialog')
      await expect(panel).toBeVisible({ timeout: 5000 })

      await expect(panel).toHaveScreenshot('commander-panel-open.png', {
        animations: 'disabled',
      })
    })

    test('commander panel - setup tab', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Open the commander panel
      const commandersButton = page.getByRole('button', { name: 'COMMANDERS' })
      await expect(commandersButton.first()).toBeVisible({ timeout: 5000 })
      await commandersButton.first().click()

      // Wait for panel to open
      const panel = page.getByRole('dialog')
      await expect(panel).toBeVisible({ timeout: 5000 })
      await page.waitForTimeout(300)

      // Click on the Setup tab if it exists
      const setupTab = panel.getByRole('tab', { name: /setup/i })
      if (await setupTab.isVisible()) {
        await setupTab.click()
        await page.waitForTimeout(300)
      }

      await expect(panel).toHaveScreenshot('commander-panel-setup-tab.png', {
        animations: 'disabled',
      })
    })

    test('commander panel - damage tab', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Open the commander panel
      const commandersButton = page.getByRole('button', { name: 'COMMANDERS' })
      await expect(commandersButton.first()).toBeVisible({ timeout: 5000 })
      await commandersButton.first().click()

      // Wait for panel to open
      const panel = page.getByRole('dialog')
      await expect(panel).toBeVisible({ timeout: 5000 })
      await page.waitForTimeout(300)

      // Click on the Damage tab
      const damageTab = panel.getByRole('tab', { name: /damage/i })
      if (await damageTab.isVisible()) {
        await damageTab.click()
        await page.waitForTimeout(300)
      }

      await expect(panel).toHaveScreenshot('commander-panel-damage-tab.png', {
        animations: 'disabled',
      })
    })
  })

  test.describe('Commander Selection Flow', () => {
    test('commander search input - focused state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Open the commander panel
      const commandersButton = page.getByRole('button', { name: 'COMMANDERS' })
      await expect(commandersButton.first()).toBeVisible({ timeout: 5000 })
      await commandersButton.first().click()

      // Wait for panel to open
      const panel = page.getByRole('dialog')
      await expect(panel).toBeVisible({ timeout: 5000 })
      await page.waitForTimeout(300)

      // Navigate to setup tab if needed
      const setupTab = panel.getByRole('tab', { name: /setup/i })
      if (await setupTab.isVisible()) {
        await setupTab.click()
        await page.waitForTimeout(300)
      }

      // Find and click on commander slot to open search
      // The CommanderSlot component should have a way to add/change commander
      const addCommanderButton = panel.getByText(/add commander/i).first()
      if (await addCommanderButton.isVisible()) {
        await addCommanderButton.click()
        await page.waitForTimeout(300)

        // Capture the search input state
        await expect(panel).toHaveScreenshot('commander-search-open.png', {
          animations: 'disabled',
        })
      }
    })

    test('commander search - with results', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Open the commander panel
      const commandersButton = page.getByRole('button', { name: 'COMMANDERS' })
      await expect(commandersButton.first()).toBeVisible({ timeout: 5000 })
      await commandersButton.first().click()

      // Wait for panel to open
      const panel = page.getByRole('dialog')
      await expect(panel).toBeVisible({ timeout: 5000 })
      await page.waitForTimeout(300)

      // Navigate to setup tab if needed
      const setupTab = panel.getByRole('tab', { name: /setup/i })
      if (await setupTab.isVisible()) {
        await setupTab.click()
        await page.waitForTimeout(300)
      }

      // Find commander search input and type a search query
      const searchInput = panel.getByPlaceholder(/search/i).first()
      if (await searchInput.isVisible()) {
        await searchInput.click()
        await searchInput.fill('Atraxa')
        await page.waitForTimeout(1000) // Wait for search results

        await expect(panel).toHaveScreenshot('commander-search-results.png', {
          animations: 'disabled',
        })
      }
    })
  })

  test.describe('Settings Dialog', () => {
    test('media settings dialog - open state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Open settings dialog
      const settingsButton = page.getByTestId('settings-button')
      await settingsButton.click()

      // Wait for dialog
      const mediaDialog = page.getByTestId('media-setup-dialog')
      await expect(mediaDialog).toBeVisible()
      await page.waitForTimeout(300)

      await expect(mediaDialog).toHaveScreenshot('media-settings-dialog.png', {
        animations: 'disabled',
        // Mask video preview as it may vary
        mask: [mediaDialog.locator('video')],
      })
    })
  })
})

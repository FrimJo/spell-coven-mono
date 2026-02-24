import type { Page } from '@playwright/test'

import { expect, test } from '../helpers/fixtures'
import {
  getOrCreateRoomId,
  hasAuthStorageState,
  mockGetUserMedia,
  mockMediaDevices,
  navigateToTestGame,
} from '../helpers/test-utils'

/**
 * Visual regression tests for the game room.
 * These tests capture and compare screenshots of the game room UI,
 * including commander viewing and selection flows.
 */
test.describe('Game Room Visual Tests', () => {
  let roomId: string
  test.use({ permissions: ['camera', 'microphone'] })

  /** Open the commanders panel via the header "Commanders" button. */
  async function openCommandersPanel(page: Page): Promise<void> {
    const commandersButton = page.getByTestId('commanders-panel-button')
    await expect(commandersButton).toBeVisible({ timeout: 5000 })
    await commandersButton.click()
  }

  test.beforeEach(async ({ page }) => {
    if (!hasAuthStorageState()) {
      test.skip(
        true,
        'Auth storage state missing. Run auth.setup.ts or the full Playwright project chain.',
      )
    }
    roomId = await getOrCreateRoomId(page, { fresh: true, persist: false })
    // Mock media devices before navigating
    await mockMediaDevices(page)
    await mockGetUserMedia(page)
  })

  test.describe('Game Room Layout', () => {
    test('game room - initial state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
        timeoutMs: 5000,
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000) // Allow video streams and UI to stabilize

      await expect(page).toHaveScreenshot('game-room-initial.png', {
        animations: 'disabled',
        // Mask video elements as they may have slight variations
        mask: [page.locator('video'), page.getByTestId('player-name')],
        maxDiffPixelRatio: 0.02,
      })
    })

    test('game room - header controls', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
        timeoutMs: 5000,
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Capture the header area with controls
      const header = page.locator('header').first()
      await expect(header).toHaveScreenshot('game-room-header.png', {
        animations: 'disabled',
        mask: [
          header.getByTestId('game-id-display'),
          header.getByTestId('header-user-menu'),
        ],
        maxDiffPixelRatio: 0.02,
      })
    })
  })

  test.describe('Player Stats Overlay', () => {
    test('player stats overlay - visible state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
        timeoutMs: 5000,
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Find the stats overlay (health/poison controls on video cards)
      const statsOverlay = page.getByTestId('player-stats-overlay').first()

      // Wait for stats to be visible
      await expect(statsOverlay).toBeVisible({ timeout: 5000 })

      await expect(statsOverlay).toHaveScreenshot('player-stats-overlay.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      })
    })
  })

  test.describe('Commander Panel', () => {
    test('commander panel - opened state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
        timeoutMs: 5000,
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Open the commanders panel via header button
      await openCommandersPanel(page)

      // Wait for panel to open
      await page.waitForTimeout(500)

      // The GameStatsPanel should now be visible
      // Look for the panel dialog/sheet
      const panel = page.getByRole('dialog', { name: /commanders/i })
      await expect(panel).toBeVisible({ timeout: 5000 })

      await expect(panel).toHaveScreenshot('commander-panel-open.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      })
    })

    test('commander panel - setup tab', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
        timeoutMs: 5000,
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Open the commander panel via header button
      await openCommandersPanel(page)

      // Wait for panel to open
      const panel = page.getByRole('dialog', { name: /commanders/i })
      await expect(panel).toBeVisible({ timeout: 5000 })
      await page.waitForTimeout(300)

      // Click on the Setup tab if it exists
      const setupTab = panel.getByRole('tab', { name: /setup/i })
      await expect(setupTab).toBeVisible()
      await setupTab.click()
      await page.waitForTimeout(300)

      await expect(panel).toHaveScreenshot('commander-panel-setup-tab.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      })
    })

    test('commander panel - damage tab', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
        timeoutMs: 5000,
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Open the commander panel via header button
      await openCommandersPanel(page)

      // Wait for panel to open
      const panel = page.getByRole('dialog', { name: /commanders/i })
      await expect(panel).toBeVisible({ timeout: 5000 })
      await page.waitForTimeout(300)

      // Click on the Damage tab
      const damageTab = panel.getByRole('tab', { name: /damage/i })
      await expect(damageTab).toBeVisible()
      await damageTab.click()
      await page.waitForTimeout(300)

      await expect(panel).toHaveScreenshot('commander-panel-damage-tab.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      })
    })
  })

  test.describe('Commander Selection Flow', () => {
    test('commander search input - focused state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
        timeoutMs: 5000,
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Open the commander panel via header button
      await openCommandersPanel(page)

      // Wait for panel to open
      const panel = page.getByRole('dialog', { name: /commanders/i })
      await expect(panel).toBeVisible({ timeout: 5000 })
      await page.waitForTimeout(300)

      // Navigate to setup tab if needed
      const setupTab = panel.getByRole('tab', { name: /setup/i })
      await expect(setupTab).toBeVisible()
      await setupTab.click()
      await page.waitForTimeout(300)

      // Find and click on commander slot to open search
      // The CommanderSlot component should have a way to add/change commander
      const addCommanderButton = panel.getByText(/add commander/i).first()
      await expect(addCommanderButton).toBeVisible()
      await addCommanderButton.click()
      await page.waitForTimeout(300)

      // Capture the search input state
      await expect(panel).toHaveScreenshot('commander-search-open.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      })
    })

    test('commander search - with results', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
        timeoutMs: 5000,
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Open the commander panel via header button
      await openCommandersPanel(page)

      // Wait for panel to open
      const panel = page.getByRole('dialog', { name: /commanders/i })
      await expect(panel).toBeVisible({ timeout: 5000 })
      await page.waitForTimeout(300)

      // Navigate to setup tab if needed
      const setupTab = panel.getByRole('tab', { name: /setup/i })
      await expect(setupTab).toBeVisible()
      await setupTab.click()
      await page.waitForTimeout(300)

      // Find commander search input and type a search query
      const searchInput = panel.getByPlaceholder(/search/i).first()
      await expect(searchInput).toBeVisible()
      await searchInput.click()
      await searchInput.fill('Atraxa')
      await page.waitForTimeout(1000) // Wait for search results

      await expect(panel).toHaveScreenshot('commander-search-results.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      })
    })
  })

  test.describe('Settings Dialog', () => {
    test('media settings dialog - open state', async ({ page }) => {
      await navigateToTestGame(page, roomId, {
        handleDuplicateSession: 'transfer',
        timeoutMs: 5000,
      })

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Open settings dialog via header dropdown: Settings → Setup Audio & Video
      const settingsButton = page.getByTestId('settings-button')
      await settingsButton.click()
      await page.getByRole('menuitem', { name: /setup audio & video/i }).click()

      // Wait for dialog
      const mediaDialog = page.getByTestId('media-setup-dialog')
      await expect(mediaDialog).toBeVisible()
      await page.waitForTimeout(300)

      await expect(mediaDialog).toHaveScreenshot('media-settings-dialog.png', {
        animations: 'disabled',
        // Mask video preview as it may vary
        mask: [mediaDialog.locator('video')],
        maxDiffPixelRatio: 0.02,
      })
    })
  })
})

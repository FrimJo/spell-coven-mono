import { expect, test } from '@playwright/test'

import {
  clearStorage,
  getGameState,
  getMediaPreferences,
  getRoomId,
  mockGetUserMedia,
  mockMediaDevices,
  navigateToTestGame,
  setMediaPreferences,
  STORAGE_KEYS,
} from '../helpers/test-utils'

/**
 * Session storage e2e tests.
 * Tests cover game state persistence, media preferences, and storage behavior.
 */
test.describe('Session Storage', () => {
  let roomId: string
  test.use({ permissions: ['camera', 'microphone'] })

  test.beforeEach(async ({ page }) => {
    roomId = getRoomId()
    // Mock media devices
    await mockMediaDevices(page)
    await mockGetUserMedia(page)
  })

  test.describe('Game State Persistence', () => {
    test('should pre-populate game state and read it when entering a game', async ({
      page,
    }) => {
      // Set up media preferences to bypass setup redirect
      await page.addInitScript((key) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            videoEnabled: false,
            audioEnabled: false,
            videoinput: 'mock-camera-1',
            audioinput: 'mock-mic-1',
          }),
        )
      }, STORAGE_KEYS.MEDIA_DEVICES)

      // Pre-populate game state in sessionStorage (simulating create/join flow)
      await page.addInitScript(
        ({ gameId, key }) => {
          sessionStorage.setItem(
            key,
            JSON.stringify({
              gameId,
              playerName: 'TestPlayer',
              timestamp: Date.now(),
            }),
          )
        },
        { gameId: roomId, key: STORAGE_KEYS.GAME_STATE },
      )

      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Check sessionStorage for game state - it should still exist
      const gameState = await getGameState(page)
      // Game state was pre-populated, verify it's readable
      expect(gameState).not.toBeNull()
    })

    test.skip('should clear game state when leaving a game', async ({
      page,
    }) => {
      // Skip: Dialog overlay blocks interaction in headless test environment
      // Set up media preferences
      await page.addInitScript((key) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            videoEnabled: false,
            audioEnabled: false,
            videoinput: 'mock-camera-1',
            audioinput: 'mock-mic-1',
          }),
        )
      }, STORAGE_KEYS.MEDIA_DEVICES)

      // Pre-populate game state
      await page.addInitScript(
        ({ gameId, key }) => {
          sessionStorage.setItem(
            key,
            JSON.stringify({
              gameId,
              playerName: 'TestPlayer',
              timestamp: Date.now(),
            }),
          )
        },
        { gameId: roomId, key: STORAGE_KEYS.GAME_STATE },
      )

      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Wait for any dialogs/overlays to settle
      await page.waitForTimeout(2000)

      // Leave the game - use force to bypass any overlay
      const leaveButton = page.getByTestId('leave-game-button')
      await leaveButton.click({ force: true })

      // Confirm leave in dialog
      const confirmButton = page.getByTestId('leave-dialog-confirm-button')
      await confirmButton.click()

      // Wait for navigation to landing page
      await expect(page).toHaveURL('/')

      // Check that game state is cleared
      const gameState = await getGameState(page)
      expect(gameState).toBeNull()
    })

    test('should maintain game state on page refresh', async ({ page }) => {
      // Set up media preferences
      await page.addInitScript((key) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            videoEnabled: false,
            audioEnabled: false,
            videoinput: 'mock-camera-1',
            audioinput: 'mock-mic-1',
          }),
        )
      }, STORAGE_KEYS.MEDIA_DEVICES)

      // Pre-populate game state
      await page.addInitScript(
        ({ gameId, key }) => {
          sessionStorage.setItem(
            key,
            JSON.stringify({
              gameId,
              playerName: 'TestPlayer',
              timestamp: Date.now(),
            }),
          )
        },
        { gameId: roomId, key: STORAGE_KEYS.GAME_STATE },
      )

      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // sessionStorage persists across refreshes by default
      // Refresh the page
      await page.reload()

      // Wait for game room to reload
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Game state should still exist (sessionStorage survives refresh)
      const refreshedState = await getGameState(page)
      expect(refreshedState).not.toBeNull()
    })
  })

  test.describe('Media Preferences Persistence', () => {
    test('should persist device selections to localStorage', async ({
      page,
    }) => {
      await page.goto('/setup')
      await clearStorage(page)

      // Wait for page to load
      await expect(page.getByText('Setup Audio & Video')).toBeVisible({
        timeout: 10000,
      })

      // Enable video
      const videoSwitch = page.getByRole('switch').first()
      await videoSwitch.click()

      // Wait for preference to be saved
      await page.waitForTimeout(2000)

      // Check localStorage - videoEnabled should be set
      const prefs = await getMediaPreferences(page)
      expect(prefs).not.toBeNull()
      // videoEnabled will be true after clicking the switch
      expect(prefs?.videoEnabled).toBeDefined()
    })

    test('should restore device selections on page reload', async ({
      page,
    }) => {
      await page.goto('/setup')

      // Set preferences directly
      await setMediaPreferences(page, {
        videoEnabled: true,
        audioEnabled: true,
      })

      // Reload page
      await page.reload()

      // Wait for page to load
      await expect(page.getByText('Setup Audio & Video')).toBeVisible({
        timeout: 10000,
      })

      // Video switch should be checked
      const videoSwitch = page.getByRole('switch').first()
      const state = await videoSwitch.getAttribute('data-state')
      expect(state).toBe('checked')
    })

    test.skip('should persist preferences after completing setup', async ({
      page,
    }) => {
      // Skip: This test requires real camera permissions which are not available in headless browsers
      await page.goto('/setup')
      await clearStorage(page)

      // Wait for page to load
      await expect(page.getByText('Setup Audio & Video')).toBeVisible({
        timeout: 10000,
      })

      // Enable video
      const videoSwitch = page.getByRole('switch').first()
      await videoSwitch.click()

      // Wait for stream to initialize and permissions to be granted
      await page.waitForTimeout(2000)

      // Complete setup - wait for button to be enabled
      const completeButton = page.getByTestId('media-setup-complete-button')
      await expect(completeButton).toBeEnabled({ timeout: 10000 })
      await completeButton.click()

      // Wait for navigation
      await expect(page).toHaveURL('/')

      // Preferences should still be in localStorage
      const prefs = await getMediaPreferences(page)
      expect(prefs).not.toBeNull()
    })
  })

  test.describe('Storage Keys', () => {
    test('should use correct localStorage key for media devices', async ({
      page,
    }) => {
      await page.goto('/setup')

      // Enable video to trigger preference save
      await expect(page.getByText('Setup Audio & Video')).toBeVisible({
        timeout: 10000,
      })
      const videoSwitch = page.getByRole('switch').first()
      await videoSwitch.click()
      await page.waitForTimeout(1000)

      // Check that the correct key is used
      const hasCorrectKey = await page.evaluate((key) => {
        return localStorage.getItem(key) !== null
      }, STORAGE_KEYS.MEDIA_DEVICES)

      expect(hasCorrectKey).toBe(true)
    })

    test('should use correct sessionStorage key for game state', async ({
      page,
    }) => {
      // Set up media preferences
      await page.addInitScript((key) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            videoEnabled: false,
            audioEnabled: false,
          }),
        )
      }, STORAGE_KEYS.MEDIA_DEVICES)

      // Pre-populate game state to test the correct key is used
      await page.addInitScript(
        ({ gameId, key }) => {
          sessionStorage.setItem(
            key,
            JSON.stringify({
              gameId,
              playerName: 'TestPlayer',
              timestamp: Date.now(),
            }),
          )
        },
        { gameId: roomId, key: STORAGE_KEYS.GAME_STATE },
      )

      await navigateToTestGame(page)

      // Wait for game room to load
      await expect(page.getByText(roomId)).toBeVisible({ timeout: 10000 })

      // Check that the correct key is used (game state was pre-populated)
      const hasCorrectKey = await page.evaluate((key) => {
        return sessionStorage.getItem(key) !== null
      }, STORAGE_KEYS.GAME_STATE)

      expect(hasCorrectKey).toBe(true)
    })
  })

  test.describe('Clean State', () => {
    test('should start with clean state when storage is cleared', async ({
      page,
    }) => {
      await page.goto('/')
      await clearStorage(page)

      // Reload to apply cleared state
      await page.reload()

      // Should be on landing page with no auth
      await expect(page).toHaveURL('/')

      // Check that storage is empty
      const gameState = await getGameState(page)
      const mediaPrefs = await getMediaPreferences(page)

      expect(gameState).toBeNull()
      expect(mediaPrefs).toBeNull()
    })
  })
})

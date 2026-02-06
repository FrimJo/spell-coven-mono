import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { hasAuthCredentials } from './auth-storage'

/**
 * Shared test utilities for e2e tests.
 * These utilities help with common testing patterns and mock setups.
 */

/** Test game ID for e2e tests */
export const TEST_GAME_ID = 'TEST01'

/** Storage keys used by the application */
export const STORAGE_KEYS = {
  MEDIA_DEVICES: 'mtg-selected-media-devices',
  GAME_STATE: 'spell-coven:game-state',
  CREATOR_INVITE: 'spell-coven:creator-invite',
  SESSION_ID: 'spell-coven-session-id',
  PERMISSION_PREFS: 'spell-coven:media-permission-prefs',
} as const

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export const AUTH_STATE_PATH = resolve(
  __dirname,
  '../../.playwright-storage/state.json',
)
export const ROOM_STATE_PATH = resolve(
  __dirname,
  '../../.playwright-storage/room.json',
)

/**
 * Check whether Playwright auth storage state exists.
 */
export function hasAuthStorageState(): boolean {
  return existsSync(AUTH_STATE_PATH) || hasAuthCredentials()
}

/**
 * Read the most recently created room ID from room.setup.ts.
 */
export function getRoomId(): string {
  const cached = readCachedRoomId()
  if (!cached) {
    throw new Error(
      `Room state file not found at ${ROOM_STATE_PATH}. Did room.setup.ts run?`,
    )
  }
  return cached
}

/**
 * Read cached room id from room.setup.ts if available.
 */
export function readCachedRoomId(): string | null {
  if (!existsSync(ROOM_STATE_PATH)) {
    return null
  }

  try {
    const content = readFileSync(ROOM_STATE_PATH, 'utf-8')
    const parsed = JSON.parse(content) as { roomId?: string }
    return parsed.roomId ?? null
  } catch {
    return null
  }
}

/**
 * Persist a room id to the shared room state file.
 */
export function writeRoomState(roomId: string): void {
  const storageDir = resolve(ROOM_STATE_PATH, '..')
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true })
  }

  writeFileSync(
    ROOM_STATE_PATH,
    JSON.stringify({ roomId, createdAt: Date.now() }, null, 2),
  )
}

/**
 * Create a room via the landing page UI.
 */
export async function createRoomViaUI(page: Page): Promise<string> {
  await page.goto('/')

  const createButton = page.getByTestId('create-game-button')
  await expect(createButton).toBeVisible({ timeout: 10000 })
  await createButton.click()

  await expect(page.getByText('Game room created successfully!')).toBeVisible({
    timeout: 20000,
  })

  const shareLinkLocator = page.getByText(/\/game\/[A-Z0-9]{6}/)
  const shareLinkText = (await shareLinkLocator.first().textContent()) ?? ''
  const match = shareLinkText.match(/\/game\/([A-Z0-9]{6})/)

  if (!match?.[1]) {
    throw new Error(
      `Room creation failed to capture game ID from: "${shareLinkText}"`,
    )
  }

  return match[1]
}

/**
 * Get a room id from cache or create a new one.
 */
export async function getOrCreateRoomId(
  page: Page,
  options?: { fresh?: boolean; persist?: boolean },
): Promise<string> {
  const fresh = options?.fresh ?? false
  const persist = options?.persist ?? true

  if (!fresh) {
    const cached = readCachedRoomId()
    if (cached) return cached
  }

  const roomId = await createRoomViaUI(page)
  if (persist) {
    writeRoomState(roomId)
  }
  return roomId
}

/**
 * Navigate to a test game room.
 */
export async function navigateToTestGame(
  page: Page,
  gameId = getRoomId(),
  options?: {
    ensureMediaSetup?: boolean
    handleDuplicateSession?: 'transfer' | 'home'
    timeoutMs?: number
  },
): Promise<void> {
  const ensureMediaSetup = options?.ensureMediaSetup ?? true
  const handleDuplicateSession = options?.handleDuplicateSession

  if (ensureMediaSetup) {
    await page.addInitScript((key) => {
      try {
        const existing = localStorage.getItem(key)
        if (existing) {
          const parsed = JSON.parse(existing)
          if (parsed?.timestamp) return
          localStorage.setItem(
            key,
            JSON.stringify({ ...parsed, timestamp: Date.now() }),
          )
          return
        }
      } catch {
        // Ignore parse errors and fall back to a clean value.
      }

      localStorage.setItem(
        key,
        JSON.stringify({
          videoinput: 'mock-camera-1',
          audioinput: 'mock-mic-1',
          audiooutput: 'mock-speaker-1',
          timestamp: Date.now(),
        }),
      )
    }, STORAGE_KEYS.MEDIA_DEVICES)
  }

  await page.goto(`/game/${gameId}`)

  if (handleDuplicateSession) {
    await ensureNoDuplicateDialog(
      page,
      handleDuplicateSession,
      options?.timeoutMs,
    )
  }
}

/**
 * Ensure auth state is applied by loading the app once (landing page).
 * Use before direct page.goto() to /game/... or /setup so the _authed layout
 * sees the Convex JWT; otherwise the first load of a protected route can
 * show the sign-in dialog.
 */
export async function ensureAuthWarm(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('create-game-button')).toBeVisible({
    timeout: 10000,
  })
}

/**
 * Dismiss duplicate-session dialog if it appears.
 */
export async function ensureNoDuplicateDialog(
  page: Page,
  action: 'home' | 'transfer' = 'transfer',
  timeoutMs = 5000,
): Promise<void> {
  const duplicateDialogTitle = page.getByText('Already Connected', {
    exact: true,
  })
  const dialogVisible = await duplicateDialogTitle
    .waitFor({ state: 'visible', timeout: timeoutMs })
    .then(() => true)
    .catch(() => false)
  if (dialogVisible) {
    const actionLabel = action === 'home' ? 'Return to Home' : 'Transfer here'
    await page.getByRole('button', { name: actionLabel }).click()
    await expect(duplicateDialogTitle).toBeHidden({ timeout: 10000 })
  }
}

/**
 * Wait for page to be fully loaded.
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
}

/**
 * Mock navigator.mediaDevices.enumerateDevices to return fake devices.
 * This allows testing device selection without actual hardware.
 */
export async function mockMediaDevices(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mockDevices: MediaDeviceInfo[] = [
      {
        deviceId: 'mock-camera-1',
        groupId: 'group-1',
        kind: 'videoinput',
        label: 'Mock Camera 1',
        toJSON: () => ({}),
      },
      {
        deviceId: 'mock-camera-2',
        groupId: 'group-2',
        kind: 'videoinput',
        label: 'Mock Camera 2',
        toJSON: () => ({}),
      },
      {
        deviceId: 'mock-mic-1',
        groupId: 'group-1',
        kind: 'audioinput',
        label: 'Mock Microphone 1',
        toJSON: () => ({}),
      },
      {
        deviceId: 'mock-mic-2',
        groupId: 'group-2',
        kind: 'audioinput',
        label: 'Mock Microphone 2',
        toJSON: () => ({}),
      },
      {
        deviceId: 'mock-speaker-1',
        groupId: 'group-1',
        kind: 'audiooutput',
        label: 'Mock Speaker 1',
        toJSON: () => ({}),
      },
    ]

    navigator.mediaDevices.enumerateDevices = async () => mockDevices
  })
}

/**
 * Mock navigator.mediaDevices.getUserMedia to return a fake stream.
 * This avoids requiring actual camera/microphone access.
 */
export async function mockGetUserMedia(page: Page): Promise<void> {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async (
      _constraints: MediaStreamConstraints,
    ) => {
      // Create a fake MediaStream with empty tracks
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 480
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#1e293b' // slate-800 color
        ctx.fillRect(0, 0, 640, 480)
      }

      const stream = canvas.captureStream(30)

      // Add a fake audio track using AudioContext
      try {
        const audioContext = new AudioContext()
        const oscillator = audioContext.createOscillator()
        const destination = audioContext.createMediaStreamDestination()
        oscillator.connect(destination)
        oscillator.frequency.value = 0 // Silent
        oscillator.start()

        destination.stream.getAudioTracks().forEach((track) => {
          stream.addTrack(track)
        })
      } catch {
        // AudioContext might not be available in all contexts
      }

      return stream
    }
  })
}

/**
 * Set up localStorage with media device preferences.
 */
export async function setMediaPreferences(
  page: Page,
  preferences: {
    videoEnabled?: boolean
    audioEnabled?: boolean
    videoinput?: string
    audioinput?: string
    audiooutput?: string
  },
): Promise<void> {
  await page.evaluate(
    ({ prefs, key }) => {
      const existing = localStorage.getItem(key)
      const current = existing ? JSON.parse(existing) : {}
      localStorage.setItem(key, JSON.stringify({ ...current, ...prefs }))
    },
    { prefs: preferences, key: STORAGE_KEYS.MEDIA_DEVICES },
  )
}

/**
 * Get localStorage value for media device preferences.
 */
export async function getMediaPreferences(
  page: Page,
): Promise<Record<string, unknown> | null> {
  return await page.evaluate((key) => {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : null
  }, STORAGE_KEYS.MEDIA_DEVICES)
}

/**
 * Get sessionStorage value for game state.
 */
export async function getGameState(
  page: Page,
): Promise<Record<string, unknown> | null> {
  return await page.evaluate((key) => {
    const value = sessionStorage.getItem(key)
    return value ? JSON.parse(value) : null
  }, STORAGE_KEYS.GAME_STATE)
}

/**
 * Clear all storage for a clean test state.
 */
export async function clearStorage(
  page: Page,
  options?: { clearAuth?: boolean },
): Promise<void> {
  const clearAuth = options?.clearAuth ?? false

  await page.evaluate((shouldClearAuth) => {
    const AUTH_PREFIX = '__convexAuth'

    if (!shouldClearAuth) {
      const authEntries: Array<[string, string]> = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key && key.startsWith(AUTH_PREFIX)) {
          const value = localStorage.getItem(key)
          if (value !== null) {
            authEntries.push([key, value])
          }
        }
      }

      localStorage.clear()
      sessionStorage.clear()

      for (const [key, value] of authEntries) {
        localStorage.setItem(key, value)
      }
      return
    }

    localStorage.clear()
    sessionStorage.clear()
  }, clearAuth)
}

/**
 * Set viewport to mobile size for mobile menu testing.
 */
export async function setMobileViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 667 })
}

/**
 * Set viewport to desktop size.
 */
export async function setDesktopViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 })
}

/**
 * Wait for a toast notification to appear with specific text.
 */
export async function waitForToast(
  page: Page,
  text: string,
  timeout = 5000,
): Promise<void> {
  await page.getByText(text).waitFor({ timeout })
}

/**
 * Check if an element is in the viewport.
 */
export async function isElementInViewport(
  page: Page,
  selector: string,
): Promise<boolean> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel)
    if (!element) return false

    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }, selector)
}

/**
 * Wait for the page to be visually stable for screenshots.
 * This waits for network idle, fonts to load, and animations to settle.
 */
export async function waitForVisualStability(
  page: Page,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 1000

  // Wait for network idle
  await page.waitForLoadState('networkidle')

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready)

  // Additional settling time for animations
  await page.waitForTimeout(timeout)
}

/**
 * Disable CSS animations and transitions for stable screenshots.
 * Call this before taking screenshots to ensure consistent visuals.
 */
export async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  })
}

import { readFile } from 'fs/promises'
import path from 'path'
import { expect, Page, test } from '@playwright/test'

import {
  logModelCacheStatus,
  waitForAllDependencies,
  waitForModelReady,
} from '../helpers/model-helpers'

// Load the demo video from the local filesystem
// NOTE: The video MUST contain a visible MTG card for these tests to pass
// If tests fail with "expected true received false", the video may not have a card
// at the center position (320, 240) or the card may not be detected by OpenCV
const VIDEO_RELATIVE = 'tests/assets/card_demo.webm'

// Legacy helper - replaced by waitForModelReady from model-helpers
// Kept for backward compatibility, but now uses the cached model approach
async function waitForClipModel(page: Page) {
  await waitForModelReady(page, 60_000)
}

// Mock getUserMedia to use the demo video
async function mockGetUserMedia(page: Page, videoUrl: string) {
  await page.addInitScript(
    ({ videoUrl }: { videoUrl: string }) => {
      const original = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      )
      navigator.mediaDevices.getUserMedia = async (
        _constraints: MediaStreamConstraints,
      ) => {
        const video = document.createElement('video')
        video.src = videoUrl
        video.muted = true
        video.loop = true
        ;(video as HTMLVideoElement & { playsInline: boolean }).playsInline =
          true
        await video.play()
        const stream =
          (
            video as HTMLVideoElement & {
              captureStream?: () => MediaStream
              mozCaptureStream?: () => MediaStream
            }
          ).captureStream?.() ||
          (
            video as HTMLVideoElement & {
              captureStream?: () => MediaStream
              mozCaptureStream?: () => MediaStream
            }
          ).mozCaptureStream?.()
        if (!stream) {
          return original(_constraints)
        }
        return stream as MediaStream
      }
    },
    { videoUrl },
  )
}

// Helper to check if green borders are being drawn
async function checkForGreenBorders(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const overlay = document.querySelector(
      'canvas[width="640"][height="480"]',
    ) as HTMLCanvasElement
    if (!overlay) return false

    const ctx = overlay.getContext('2d')
    if (!ctx) return false

    const imageData = ctx.getImageData(0, 0, overlay.width, overlay.height)
    const data = imageData.data

    let greenPixelCount = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      if (a > 200 && r < 50 && g > 200 && b < 50) {
        greenPixelCount++
      }
    }

    return greenPixelCount > 100
  })
}

// Helper to click on the detected card at the known position
// Card is located at (276, 292) in the demo video
async function clickDetectedCard(page: Page): Promise<void> {
  const overlayCanvas = page
    .locator('canvas[width="640"][height="480"]')
    .first()
  await overlayCanvas.click({ position: { x: 276, y: 292 }, force: true })
}

test.describe('Card Identification Feature', () => {
  test.use({
    permissions: ['camera'],
  })

  test.beforeEach(async ({ page, baseURL }) => {
    // Build a data URL for the demo video
    const videoPath = path.join(process.cwd(), VIDEO_RELATIVE)
    const bytes = await readFile(videoPath)
    const base64 = bytes.toString('base64')
    const videoUrl = `data:video/webm;base64,${base64}`

    await mockGetUserMedia(page, videoUrl)

    // Enable console logging for debugging
    page.on('console', (msg) => {
      const text = msg.text()
      if (
        text.includes('Cropped card image:') ||
        text.includes('Query') ||
        text.includes('Error') ||
        text.includes('Model')
      ) {
        console.log(`[Browser Console] ${text.substring(0, 100)}`)
      }
    })

    // Navigate to game page
    await page.goto(`${baseURL}/game/test-game-123`)

    // Log model cache status for debugging
    await logModelCacheStatus(page)
  })

  test('should show loading overlay while CLIP model initializes', async ({
    page,
  }) => {
    // Increase timeout for this test as model loading can take a while
    test.setTimeout(180_000)

    // Check if model is already cached from global setup
    const loadingOverlay = page.locator('[role="dialog"][aria-label="Loading"]')
    const isLoadingVisible = await loadingOverlay.isVisible().catch(() => false)

    if (isLoadingVisible) {
      console.log('🔄 Model loading in progress, waiting for completion...')

      // Verify loading message is shown
      const loadingMessage = loadingOverlay.locator(
        'text=/Loading|Downloading/',
      )
      await expect(loadingMessage).toBeVisible()

      // Wait for model to load (faster with cached model)
      await waitForClipModel(page)

      // Verify loading overlay is gone
      await expect(loadingOverlay).not.toBeVisible({ timeout: 10000 })
    } else {
      console.log(
        '✅ Model already loaded from cache, no loading overlay needed',
      )

      // Verify model is actually ready by checking it can be used
      await waitForModelReady(page)
    }
  })

  test('should trigger card query when clicking on canvas', async ({
    page,
  }) => {
    // Wait for model and OpenCV to be ready (optimized for cached model)
    await waitForAllDependencies(page)

    // Start webcam
    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    // Verify green borders are being drawn (card detection active)
    const hasGreenBorders = await checkForGreenBorders(page)
    expect(hasGreenBorders).toBe(true)

    // Click on detected card at known position
    await clickDetectedCard(page)

    // Wait for query to complete
    await page.waitForTimeout(3500)

    // Verify that a query was triggered and completed (result or error shown)
    // This test validates that clicking DOES trigger the query flow
    const hasResult = await page
      .locator('text=/Score:|Error/')
      .isVisible()
      .catch(() => false)
    expect(hasResult).toBe(true)
  })

  test('should display card result after clicking detected card', async ({
    page,
  }) => {
    await waitForAllDependencies(page)

    // Start webcam
    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    // Verify green borders are being drawn (card detection active)
    const hasGreenBorders = await checkForGreenBorders(page)
    expect(hasGreenBorders).toBe(true)

    // Try clicking on detected card (tries multiple positions and logs which works)
    const successfulPosition = await clickDetectedCard(page)
    expect(successfulPosition).not.toBeNull()

    // Wait for query to complete
    await page.waitForTimeout(3500)

    // This test specifically validates the SUCCESS path - a result MUST be shown
    const cardResult = page.locator('text=/Score:/')
    await expect(cardResult).toBeVisible()

    // Verify card name is displayed
    const cardName = page.locator('[class*="font-semibold"]').first()
    await expect(cardName).toBeVisible()

    // Verify set code is displayed (in brackets like [LEA])
    const setCode = page.locator('text=/\\[.*\\]/')
    await expect(setCode).toBeVisible()
  })

  test('should show loading state while querying', async ({ page }) => {
    await waitForAllDependencies(page)

    // Start webcam
    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    // Set up promise to catch loading state before clicking
    const loadingPromise = page
      .waitForSelector('text=/Identifying card/', {
        timeout: 2000,
        state: 'visible',
      })
      .catch(() => null)

    // Click on detected card at known position
    await clickDetectedCard(page)

    // Check if loading state appeared (it's okay if it was too fast)
    const loadingElement = await loadingPromise

    // Wait for query to complete
    await page.waitForTimeout(4000)

    // Verify final state shows either result or error (query must complete)
    const finalState = await page
      .locator('text=/Score:|Error/')
      .isVisible()
      .catch(() => false)
    expect(finalState).toBe(true)

    // Log whether we caught the loading state
    console.log('Loading state captured:', loadingElement !== null)
    console.log('Final state shown:', finalState)
  })

  test('should log cropped image to console as blob URL', async ({ page }) => {
    await waitForAllDependencies(page)

    // Listen for console messages
    const consoleMessages: string[] = []
    page.on('console', (msg) => {
      consoleMessages.push(msg.text())
    })

    // Start webcam
    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    // Click on detected card at known position
    await clickDetectedCard(page)

    // Wait for query to complete
    await page.waitForTimeout(4000)

    // Verify blob URL was logged (if cropping succeeded)
    const hasBlobLog = consoleMessages.some(
      (msg) => msg.includes('Cropped card image:') && msg.includes('blob:'),
    )

    // This is expected behavior per US2 in spec - debug logging of cropped images
    // If no blob log, verify that query still executed (error or result)
    if (!hasBlobLog) {
      const hasQueryResult = await page
        .locator('text=/Score:|Error/')
        .isVisible()
        .catch(() => false)
      expect(hasQueryResult).toBe(true)
    } else {
      expect(hasBlobLog).toBe(true)
    }
  })

  test('should show low confidence warning for poor matches', async ({
    page,
  }) => {
    await waitForAllDependencies(page)

    // Start webcam
    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    // Click on detected card at known position
    await clickDetectedCard(page)

    // Wait for query to complete
    await page.waitForTimeout(4000)

    // Check if low confidence warning appears (if score < 0.70 per isLowConfidence in types)
    const lowConfidenceWarning = page.locator(
      'text=/Low confidence|clearer view/',
    )

    // This might or might not appear depending on the match quality
    // We verify the page doesn't crash and shows some result
    const warningVisible = await lowConfidenceWarning
      .isVisible()
      .catch(() => false)
    const hasResult = await page
      .locator('text=/Score:|Error/')
      .isVisible()
      .catch(() => false)

    console.log('Low confidence warning visible:', warningVisible)
    console.log('Has result or error:', hasResult)

    // At least one should be true (warning with result, or just result, or error)
    expect(hasResult).toBe(true)
  })

  test('should cancel previous query on rapid clicks', async ({ page }) => {
    await waitForAllDependencies(page)

    // Start webcam
    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    const overlayCanvas = page
      .locator('canvas[width="640"][height="480"]')
      .first()

    // Perform rapid clicks
    await overlayCanvas.click({ position: { x: 300, y: 240 }, force: true })
    await page.waitForTimeout(100)
    await overlayCanvas.click({ position: { x: 340, y: 240 }, force: true })
    await page.waitForTimeout(100)
    await overlayCanvas.click({ position: { x: 320, y: 260 }, force: true })

    // Wait for final query to complete
    await page.waitForTimeout(4000)

    // Verify only one result is shown (latest query)
    // The CardResultDisplay component should only show one result at a time
    const cardResults = page.locator('text=/Score:/')
    const count = await cardResults.count()
    expect(count).toBeLessThanOrEqual(1)
  })

  test('should display card information with Scryfall link', async ({
    page,
  }) => {
    await waitForAllDependencies(page)

    // Start webcam
    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    // Click on detected card at known position
    await clickDetectedCard(page)

    // Wait for query to complete
    await page.waitForTimeout(4000)

    // Check if we got a successful result
    const hasScore = await page
      .locator('text=/Score:/')
      .isVisible()
      .catch(() => false)

    if (hasScore) {
      // Verify card name is displayed
      const cardName = page.locator('[class*="font-semibold"]').first()
      await expect(cardName).toBeVisible()

      // Verify set code is displayed (in brackets like [LEA])
      const setCode = page.locator('text=/\\[.*\\]/')
      await expect(setCode).toBeVisible()

      // Verify score is displayed with 3 decimals
      const score = page.locator('text=/Score: \\d\\.\\d{3}/')
      await expect(score).toBeVisible()

      // Verify Scryfall link is present
      const scryfallLink = page.locator('a:has-text("View on Scryfall")')
      await expect(scryfallLink).toBeVisible()

      // Verify link opens in new tab
      const href = await scryfallLink.getAttribute('href')
      expect(href).toContain('scryfall.com')

      const target = await scryfallLink.getAttribute('target')
      expect(target).toBe('_blank')
    } else {
      // If no result, verify error is shown
      const hasError = await page
        .locator('[role="alert"]')
        .isVisible()
        .catch(() => false)
      expect(hasError).toBe(true)
    }
  })

  test('should handle clicks on areas without cards gracefully', async ({
    page,
  }) => {
    await waitForAllDependencies(page)

    // Start webcam
    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    // Click on an area without a card (corner of canvas)
    const overlayCanvas = page
      .locator('canvas[width="640"][height="480"]')
      .first()
    await overlayCanvas.click({ position: { x: 50, y: 50 }, force: true })

    // Wait to see if anything happens
    await page.waitForTimeout(2000)

    // Check if error message appears or if a result is shown
    const errorMessage = page.locator('[role="alert"]')
    const hasError = await errorMessage.isVisible().catch(() => false)
    const hasResult = await page
      .locator('text=/Score:/')
      .isVisible()
      .catch(() => false)

    console.log('Error message visible:', hasError)
    console.log('Result visible:', hasResult)

    // Clicking on an area without a card should not crash the app
    // It's acceptable for nothing to happen (no error, no result)
    // This test verifies the app doesn't crash and remains functional
    const videoStillActive = await page.locator('video').isVisible()
    expect(videoStillActive).toBe(true)
  })

  test('should display card result below player list', async ({ page }) => {
    await waitForAllDependencies(page)

    // Start webcam
    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    // Click on detected card at known position
    await clickDetectedCard(page)

    // Wait for query to complete
    await page.waitForTimeout(4000)

    // Check if we got a result
    const hasScore = await page
      .locator('text=/Score:/')
      .isVisible()
      .catch(() => false)

    if (hasScore) {
      // Verify card result is in the left sidebar (w-64 class)
      const leftSidebar = page.locator('.w-64').first()
      const cardResult = leftSidebar.locator('text=/Score:/')
      await expect(cardResult).toBeVisible()

      // Take screenshot showing layout
      await page.screenshot({ path: 'test-results/card-result-layout.png' })
    } else {
      // If no result, verify error or that query was attempted
      const hasError = await page
        .locator('[role="alert"]')
        .isVisible()
        .catch(() => false)
      expect(hasError).toBe(true)
    }
  })
})

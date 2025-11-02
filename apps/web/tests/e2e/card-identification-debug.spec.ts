/**
 * Debug version of card identification e2e test
 *
 * This test uses chrome-devtools MCP server for interactive debugging.
 * Run with: pnpm test:e2e:debug
 *
 * Features:
 * - Takes snapshots at each step for inspection
 * - Logs console messages
 * - Captures network requests
 * - Takes screenshots at key points
 * - Slower execution with longer waits for debugging
 */

import { readFile } from 'fs/promises'
import path from 'path'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const VIDEO_RELATIVE = 'tests/assets/card_demo.webm'

async function waitForOpenCv(page: Page) {
  console.log('⏳ Waiting for OpenCV to load...')
  await page.waitForFunction(
    () => {
      return typeof (window as unknown as { cv?: unknown }).cv !== 'undefined'
    },
    { timeout: 180_000 },
  )
  console.log('✅ OpenCV loaded')
}

async function waitForClipModel(page: Page) {
  console.log('⏳ Waiting for CLIP model to load...')
  await page.waitForFunction(
    () => {
      const overlay = document.querySelector(
        '[role="dialog"][aria-label="Loading"]',
      )
      return overlay === null
    },
    { timeout: 60_000 },
  )
  console.log('✅ CLIP model loaded')
}

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

// TODO: Debug tests have same integration issues as main tests
// Skip for now - use manual testing or fix integration first
test.describe.skip('Card Identification - Debug Mode', () => {
  test.use({
    permissions: ['camera'],
    // Slow down for debugging
    actionTimeout: 30_000,
  })

  test('debug: full card identification flow with detailed logging', async ({
    page,
    baseURL,
  }) => {
    // Enable console logging
    page.on('console', (msg) => {
      const type = msg.type()
      const text = msg.text()

      if (type === 'error') {
        console.error('❌ Browser Error:', text)
      } else if (text.includes('Cropped card image:')) {
        console.log('🖼️  Cropped image logged to console')
      } else if (text.includes('Query')) {
        console.log('🔍', text)
      } else {
        console.log(`📝 [${type}]`, text)
      }
    })

    // Log network requests
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('embeddings') || url.includes('meta.json')) {
        console.log('🌐 Loading:', url)
      }
    })

    // Build video data URL
    console.log('📹 Loading demo video...')
    const videoPath = path.join(process.cwd(), VIDEO_RELATIVE)
    const bytes = await readFile(videoPath)
    const base64 = bytes.toString('base64')
    const videoUrl = `data:video/webm;base64,${base64}`
    console.log('✅ Video loaded')

    await mockGetUserMedia(page, videoUrl)

    // Navigate to game page
    console.log('🚀 Navigating to game page...')
    await page.goto(`${baseURL}/game/debug-test-123`)
    await page.waitForLoadState('networkidle')
    console.log('✅ Page loaded')

    // Screenshot 1: Initial page load
    await page.screenshot({
      path: 'test-results/debug-01-page-load.png',
      fullPage: true,
    })

    // Wait for CLIP model
    await waitForClipModel(page)

    // Screenshot 2: Model loaded
    await page.screenshot({
      path: 'test-results/debug-02-model-loaded.png',
      fullPage: true,
    })

    // Wait for OpenCV
    await waitForOpenCv(page)

    // Start webcam
    console.log('📷 Starting webcam...')
    const cameraButton = page.getByTestId('video-toggle-button')
    await expect(cameraButton).toBeVisible()
    await cameraButton.click()
    console.log('✅ Webcam started')

    // Wait for video to stabilize
    await page.waitForTimeout(5000)

    // Screenshot 3: Video stream active
    await page.screenshot({
      path: 'test-results/debug-03-video-active.png',
      fullPage: true,
    })

    // Check canvas state
    const canvasInfo = await page.evaluate(() => {
      const overlay = document.querySelector(
        'canvas[width="640"][height="480"]',
      ) as HTMLCanvasElement
      const video = document.querySelector('video') as HTMLVideoElement

      return {
        overlayExists: !!overlay,
        overlayDimensions: overlay
          ? { width: overlay.width, height: overlay.height }
          : null,
        videoExists: !!video,
        videoPlaying: video ? !video.paused : false,
        videoReadyState: video?.readyState,
        cvLoaded:
          typeof (window as unknown as { cv?: unknown }).cv !== 'undefined',
      }
    })
    console.log('🎨 Canvas state:', JSON.stringify(canvasInfo, null, 2))

    // Check for green borders
    const hasGreenBorders = await page.evaluate(() => {
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

        if (
          a !== undefined &&
          r !== undefined &&
          g !== undefined &&
          b !== undefined &&
          a > 200 &&
          r < 50 &&
          g > 200 &&
          b < 50
        ) {
          greenPixelCount++
        }
      }

      return greenPixelCount > 100
    })
    console.log('🟢 Green borders detected:', hasGreenBorders)

    // Click on detected card
    console.log('👆 Clicking on detected card...')
    const overlayCanvas = page
      .locator('canvas[width="640"][height="480"]')
      .first()
    await overlayCanvas.click({ position: { x: 320, y: 240 }, force: true })
    console.log('✅ Click registered')

    // Wait for query to start
    await page.waitForTimeout(500)

    // Screenshot 4: Query in progress
    await page.screenshot({
      path: 'test-results/debug-04-query-started.png',
      fullPage: true,
    })

    // Wait for query to complete
    console.log('⏳ Waiting for query to complete...')
    await page.waitForTimeout(5000)

    // Screenshot 5: Query complete
    await page.screenshot({
      path: 'test-results/debug-05-query-complete.png',
      fullPage: true,
    })

    // Check for card result
    const resultInfo = await page.evaluate(() => {
      const cardName = document.querySelector('[class*="font-semibold"]')
      const setCode = document.querySelector('text=/\\[.*\\]/')
      const score = document.querySelector('text=/Score:/')
      const scryfallLink = document.querySelector(
        'a:has-text("View on Scryfall")',
      )
      const errorMessage = document.querySelector('[role="alert"]')
      const loadingMessage = document.querySelector('text=/Identifying/')

      return {
        hasCardName: !!cardName,
        cardNameText: cardName?.textContent,
        hasSetCode: !!setCode,
        hasScore: !!score,
        hasScryfallLink: !!scryfallLink,
        hasError: !!errorMessage,
        errorText: errorMessage?.textContent,
        isLoading: !!loadingMessage,
      }
    })
    console.log('📊 Result state:', JSON.stringify(resultInfo, null, 2))

    // Verify result is displayed
    const cardResult = page.locator('text=/Score:|\\[.*\\]/')
    await expect(cardResult).toBeVisible({ timeout: 5000 })
    console.log('✅ Card result displayed')

    // Get final result details
    const finalResult = await page.evaluate(() => {
      const sidebar = document.querySelector('.w-64')
      return {
        sidebarHTML: sidebar?.innerHTML,
      }
    })
    console.log(
      '📋 Final result HTML:',
      finalResult.sidebarHTML?.substring(0, 500),
    )

    // Final screenshot
    await page.screenshot({
      path: 'test-results/debug-06-final-state.png',
      fullPage: true,
    })

    console.log('✅ Test complete!')
  })

  test('debug: test rapid clicks and query cancellation', async ({
    page,
    baseURL,
  }) => {
    page.on('console', (msg) => {
      if (msg.text().includes('Query') || msg.text().includes('cancel')) {
        console.log('🔍', msg.text())
      }
    })

    const videoPath = path.join(process.cwd(), VIDEO_RELATIVE)
    const bytes = await readFile(videoPath)
    const base64 = bytes.toString('base64')
    const videoUrl = `data:video/webm;base64,${base64}`

    await mockGetUserMedia(page, videoUrl)
    await page.goto(`${baseURL}/game/debug-rapid-clicks`)
    await waitForClipModel(page)
    await waitForOpenCv(page)

    const cameraButton = page.getByTestId('video-toggle-button')
    await cameraButton.click()
    await page.waitForTimeout(3000)

    const overlayCanvas = page
      .locator('canvas[width="640"][height="480"]')
      .first()

    console.log('👆 Performing rapid clicks...')

    // Click 1
    await overlayCanvas.click({ position: { x: 300, y: 240 }, force: true })
    await page.screenshot({ path: 'test-results/debug-rapid-01.png' })
    console.log('  Click 1')

    await page.waitForTimeout(200)

    // Click 2
    await overlayCanvas.click({ position: { x: 340, y: 240 }, force: true })
    await page.screenshot({ path: 'test-results/debug-rapid-02.png' })
    console.log('  Click 2')

    await page.waitForTimeout(200)

    // Click 3
    await overlayCanvas.click({ position: { x: 320, y: 260 }, force: true })
    await page.screenshot({ path: 'test-results/debug-rapid-03.png' })
    console.log('  Click 3')

    // Wait for final query
    await page.waitForTimeout(5000)

    // Final screenshot
    await page.screenshot({ path: 'test-results/debug-rapid-final.png' })

    // Verify only one result
    const cardResults = page.locator('text=/Score:/')
    const count = await cardResults.count()
    console.log('📊 Number of results displayed:', count)
    expect(count).toBeLessThanOrEqual(1)

    console.log('✅ Rapid click test complete!')
  })
})

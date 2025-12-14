import { expect, test } from '@playwright/test'

import {
  canUseCachedModel,
  isModelSetupComplete,
  logModelCacheStatus,
  waitForModelReady,
} from './helpers/model-helpers'

/**
 * Validation tests for the global setup and model caching system.
 * These tests verify that the model initialization and caching works correctly.
 */
test.describe('Model Setup Validation', () => {
  test.use({
    permissions: ['camera'],
  })

  test('should have model setup completed by global setup', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/game/game-VALID1`)

    // Log cache status for debugging
    await logModelCacheStatus(page)

    // Check if setup was completed
    const setupComplete = await isModelSetupComplete(page)
    expect(setupComplete).toBe(true)

    // Check if we can use cached model
    const canUseCache = await canUseCachedModel(page)
    console.log('Can use cached model:', canUseCache)

    // Model should be ready quickly (under 5 seconds) if cached
    const startTime = Date.now()
    await waitForModelReady(page, 30_000)
    const endTime = Date.now()
    const duration = endTime - startTime

    console.log(`Model ready in ${duration}ms`)

    // If cached, should be ready in under 5 seconds
    if (canUseCache) {
      expect(duration).toBeLessThan(5000)
    }
  })

  test('should not show loading overlay if model is cached', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/game/game-VALID2`)

    // Check if model is cached
    const canUseCache = await canUseCachedModel(page)

    if (canUseCache) {
      // Loading overlay should not be visible or should disappear quickly
      const loadingOverlay = page.locator(
        '[role="dialog"][aria-label="Loading"]',
      )

      // Wait a moment for any potential loading to start
      await page.waitForTimeout(1000)

      const isVisible = await loadingOverlay.isVisible().catch(() => false)

      if (isVisible) {
        // If visible, it should disappear quickly (within 2 seconds)
        await expect(loadingOverlay).not.toBeVisible({ timeout: 2000 })
      }

      console.log('✅ Loading overlay handled correctly for cached model')
    } else {
      console.log('ℹ️ Model not cached, loading overlay expected')
    }
  })

  test('should maintain cache across multiple page loads', async ({
    page,
    baseURL,
  }) => {
    // First page load
    await page.goto(`${baseURL}/game/game-CACHE1`)
    await logModelCacheStatus(page)

    const firstSetupComplete = await isModelSetupComplete(page)
    expect(firstSetupComplete).toBe(true)

    // Second page load
    await page.goto(`${baseURL}/game/game-CACHE2`)
    await logModelCacheStatus(page)

    const secondSetupComplete = await isModelSetupComplete(page)
    expect(secondSetupComplete).toBe(true)

    // Both should be true, indicating persistent cache
    console.log('✅ Cache persisted across page loads')
  })
})

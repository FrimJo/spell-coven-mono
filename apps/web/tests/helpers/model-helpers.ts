import { Page } from '@playwright/test'

/**
 * Helper functions for managing model state in Playwright tests.
 * These functions work with the cached model initialized by global-setup.ts
 */

/**
 * Check if the model was initialized by global setup
 */
export async function isModelSetupComplete(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const setupComplete = localStorage.getItem('playwright-model-setup-complete')
    return setupComplete === 'true'
  })
}

/**
 * Get the timestamp when model setup was completed
 */
export async function getModelSetupTimestamp(page: Page): Promise<number | null> {
  return await page.evaluate(() => {
    const timestamp = localStorage.getItem('playwright-model-setup-timestamp')
    return timestamp ? parseInt(timestamp, 10) : null
  })
}

/**
 * Wait for the model to be ready (either from cache or fresh load).
 * This is much faster than the original waitForClipModel when using cached model.
 */
export async function waitForModelReady(page: Page, timeout = 30_000): Promise<void> {
  const setupComplete = await isModelSetupComplete(page)
  
  if (setupComplete) {
    console.log('✅ Model already initialized by global setup, checking if still ready...')
    
    // Quick check - if no loading overlay is visible, model is ready
    const hasLoadingOverlay = await page.locator('[role="dialog"][aria-label="Loading"]').isVisible().catch(() => false)
    
    if (!hasLoadingOverlay) {
      console.log('🚀 Model ready from cache!')
      return
    }
  }
  
  console.log('⏳ Waiting for model to be ready...')
  
  // Wait for loading overlay to disappear
  await page.waitForFunction(
    () => {
      const overlay = document.querySelector('[role="dialog"][aria-label="Loading"]')
      return overlay === null
    },
    { timeout }
  )
  
  console.log('✅ Model is ready!')
}

/**
 * Enhanced OpenCV readiness check with better error handling
 */
export async function waitForOpenCv(page: Page, timeout = 30_000): Promise<void> {
  console.log('⏳ Waiting for OpenCV to be ready...')
  
  await page.waitForFunction(
    () => {
      return typeof (window as unknown as { cv?: unknown }).cv !== 'undefined'
    },
    { timeout }
  )
  
  console.log('✅ OpenCV is ready!')
}

/**
 * Combined helper that waits for both model and OpenCV to be ready
 */
export async function waitForAllDependencies(page: Page): Promise<void> {
  console.log('🔄 Waiting for all dependencies (Model + OpenCV)...')
  
  await Promise.all([
    waitForModelReady(page),
    waitForOpenCv(page)
  ])
  
  console.log('🎉 All dependencies ready!')
}

/**
 * Check if the current test can use the cached model
 */
export async function canUseCachedModel(page: Page): Promise<boolean> {
  const setupComplete = await isModelSetupComplete(page)
  const timestamp = await getModelSetupTimestamp(page)
  
  if (!setupComplete || !timestamp) {
    return false
  }
  
  // Check if setup was recent (within last hour)
  const hourAgo = Date.now() - (60 * 60 * 1000)
  return timestamp > hourAgo
}

/**
 * Log model cache status for debugging
 */
export async function logModelCacheStatus(page: Page): Promise<void> {
  const setupComplete = await isModelSetupComplete(page)
  const timestamp = await getModelSetupTimestamp(page)
  const canUseCache = await canUseCachedModel(page)
  
  console.log('📊 Model Cache Status:', {
    setupComplete,
    timestamp: timestamp ? new Date(timestamp).toISOString() : null,
    canUseCache,
    age: timestamp ? `${Math.round((Date.now() - timestamp) / 1000)}s ago` : null
  })
}

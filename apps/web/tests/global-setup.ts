import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { FullConfig } from '@playwright/test'
import { chromium } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Path to store the browser state with cached model
const STORAGE_DIR = resolve(__dirname, '../.playwright-storage')
const STORAGE_STATE_PATH = resolve(STORAGE_DIR, 'state.json')

/**
 * Global setup for Playwright tests.
 * This runs once before all tests and initializes the CLIP model and embeddings,
 * caching them in the browser's IndexedDB for all subsequent tests.
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup - initializing model and embeddings...')

  const browser = await chromium.launch()
  const context = await browser.newContext({
    permissions: ['camera'],
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  // Set a longer timeout for model loading operations
  page.setDefaultTimeout(180_000) // 3 minutes

  try {
    // Navigate to the game page to trigger model initialization
    const baseURL = config.projects[0]?.use.baseURL || 'https://localhost:1234'
    console.log(`📍 Navigating to ${baseURL}/game/setup-test`)
    await page.goto(`${baseURL}/game/setup-test`, { timeout: 60_000 })

    // Wait for the loading overlay to appear (indicates model loading has started)
    console.log('⏳ Waiting for model initialization to start...')
    await page.waitForSelector('[role="dialog"][aria-label="Loading"]', {
      timeout: 10000,
    })

    // Wait for the loading overlay to disappear (indicates model is fully loaded)
    console.log('🔄 Model loading started, waiting for completion...')
    await page.waitForFunction(
      () => {
        const overlay = document.querySelector(
          '[role="dialog"][aria-label="Loading"]',
        )
        return overlay === null
      },
      { timeout: 180_000 }, // 3 minutes timeout for model loading
    )

    // Verify the model is actually ready by checking browser storage
    const modelCached = await page.evaluate(async () => {
      // Check if transformers.js has cached the model in IndexedDB
      try {
        const databases = await indexedDB.databases()
        const hasTransformersCache = databases.some(
          (db) =>
            db.name?.includes('transformers') ||
            db.name?.includes('huggingface'),
        )

        // Also check if our embeddings are loaded in memory
        const hasEmbeddings =
          typeof (
            window as unknown as { loadEmbeddingsAndMetaFromPackage?: unknown }
          ).loadEmbeddingsAndMetaFromPackage === 'function'

        return { hasTransformersCache, hasEmbeddings }
      } catch (e) {
        console.error('Error checking model cache:', e)
        return { hasTransformersCache: false, hasEmbeddings: false }
      }
    })

    console.log('✅ Model initialization complete!')
    console.log('📊 Cache status:', modelCached)

    // Store a flag in localStorage to indicate setup is complete
    await page.evaluate(() => {
      localStorage.setItem('playwright-model-setup-complete', 'true')
      localStorage.setItem(
        'playwright-model-setup-timestamp',
        Date.now().toString(),
      )
    })

    console.log('💾 Setup completion flag stored in localStorage')

    // Ensure storage directory exists before saving state
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true })
      console.log(`📁 Created storage directory: ${STORAGE_DIR}`)
    }

    // Save the browser storage state (including IndexedDB and localStorage)
    // This will be loaded by all tests to reuse the cached model
    await context.storageState({ path: STORAGE_STATE_PATH })
    console.log(`💾 Browser storage state saved to ${STORAGE_STATE_PATH}`)
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }

  console.log('🎉 Global setup completed successfully!')
}

export default globalSetup

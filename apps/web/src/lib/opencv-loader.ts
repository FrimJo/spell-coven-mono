/**
 * OpenCV.js Lazy Loader
 *
 * Loads OpenCV.js on-demand from npm package to avoid impacting initial bundle size.
 * The WASM file is ~9.7MB and is cached in the browser after first load.
 *
 * @module opencv-loader
 */

import type { CV } from '@techstark/opencv-js'

let cachedCv: CV | null = null

/**
 * Lazy-load OpenCV.js from npm package
 *
 * This function:
 * 1. Checks if OpenCV is already loaded (returns cached promise)
 * 2. Dynamically imports OpenCV.js from npm package
 * 3. Waits for the cv object to be initialized
 * 4. Caches the promise for subsequent calls
 *
 * @returns Promise that resolves to the cv object
 * @throws Error if OpenCV.js fails to load
 *
 * @example
 * ```typescript
 * const cv = await loadOpenCV()
 * const mat = new cv.Mat()
 * ```
 */
export async function loadOpenCV(): Promise<CV> {
  // Return cached open cv if already loading/loaded
  if (cachedCv) {
    return cachedCv
  }

  console.log('[OpenCV] Starting lazy load from npm package...')

  try {
    // Dynamic import to keep it lazy-loaded
    const cv = await import('@techstark/opencv-js').then(
      (module) => module.default,
    )
    cachedCv = cv // Cache the cv object for isOpenCVLoaded() and getOpenCVVersion()
    console.log('[OpenCV] Runtime initialized successfully')
    console.log('[OpenCV] Build info:', cv.getBuildInformation())
    return cv
  } catch (error) {
    console.error('[OpenCV] Failed to load:', error)
    cachedCv = null // Reset so retry is possible
    throw new Error('Failed to load OpenCV.js from npm package')
  }
}

/**
 * Check if OpenCV is currently loaded
 *
 * @returns true if OpenCV is loaded and ready
 */
export function isOpenCVLoaded(cv = cachedCv): cv is CV {
  return cv !== null && cv.Mat !== undefined
}

/**
 * Get OpenCV version string
 *
 * @returns OpenCV version or null if not loaded
 */
export function getOpenCVVersion(): string | null {
  if (!isOpenCVLoaded(cachedCv)) {
    return null
  }

  try {
    // Extract version from build info
    const buildInfo = cachedCv.getBuildInformation()
    const versionMatch = buildInfo.match(/Version control:\s+(\d+\.\d+\.\d+)/)
    return versionMatch ? versionMatch[1] : 'unknown'
  } catch {
    return 'unknown'
  }
}

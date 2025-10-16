/**
 * Helper to enable edge refinement with OpenCV
 * 
 * Usage:
 * import { enableEdgeRefinement } from '@/lib/enable-edge-refinement'
 * await enableEdgeRefinement()
 */

import { loadOpenCV, isOpenCVLoaded } from './card-edge-refiner'

/**
 * Enable edge refinement by loading OpenCV
 * Safe to call multiple times (won't reload if already loaded)
 * 
 * @returns Promise that resolves when OpenCV is ready
 * @throws Error if OpenCV fails to load
 */
export async function enableEdgeRefinement(): Promise<void> {
  if (isOpenCVLoaded()) {
    return
  }


  try {
    await loadOpenCV()
  } catch (err) {
    console.error('❌ [EdgeRefinement] Failed to load OpenCV:', err)
    console.error('⚠️  Edge refinement will be disabled')
    console.error('💡 Check your internet connection and try again')
    throw err
  }
}

/**
 * Check if edge refinement is available
 * @returns true if OpenCV is loaded and ready
 */
export function isEdgeRefinementAvailable(): boolean {
  return isOpenCVLoaded()
}

/**
 * Get edge refinement status message
 * @returns Human-readable status string
 */
export function getEdgeRefinementStatus(): string {
  if (isOpenCVLoaded()) {
    return '✅ Edge refinement enabled (OpenCV loaded)'
  } else {
    return '⚠️  Edge refinement disabled (OpenCV not loaded)'
  }
}

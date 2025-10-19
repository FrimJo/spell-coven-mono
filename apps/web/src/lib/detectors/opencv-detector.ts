/**
 * OpenCV-based card detector implementation
 *
 * Uses edge detection (Canny) and contour finding to detect rectangular cards.
 * This is the original detection method before DETR.
 *
 * Advantages:
 * - Fast (~50-100ms per frame)
 * - Small footprint (no ML model to download)
 * - Works offline immediately
 *
 * Disadvantages:
 * - Sensitive to lighting conditions
 * - Requires clear edges
 * - More false positives
 *
 * @module detectors/opencv-detector
 */

import type { CV, InputArray, Mat, MatVector } from '@techstark/opencv-js'

import type {
  CardDetector,
  DetectionOutput,
  DetectorConfig,
  DetectorStatus,
} from './types'

// OpenCV.js minimal type definitions
declare global {
  interface Window {
    cv: CV
    __cvReadyPromise?: Promise<void>
  }
}

/**
 * OpenCV detector configuration
 */
export interface OpenCVConfig extends DetectorConfig {
  /** Minimum card area in pixels */
  minCardArea?: number

  /** Canny edge detection low threshold */
  cannyLowThreshold?: number

  /** Canny edge detection high threshold */
  cannyHighThreshold?: number

  /** Gaussian blur kernel size */
  blurKernelSize?: number

  /** Contour approximation epsilon factor */
  approxEpsilon?: number
}

/**
 * OpenCV detector implementation
 */
export class OpenCVDetector implements CardDetector {
  private status: DetectorStatus = 'uninitialized'
  private config: OpenCVConfig

  // OpenCV matrices (reused for performance)
  private src: Mat | null = null
  private gray: InputArray | null = null
  private blurred: InputArray | null = null
  private edges: InputArray | null = null
  private contours: MatVector | null = null
  private hierarchy: Mat | null = null

  constructor(config: OpenCVConfig) {
    this.config = {
      minCardArea: 2000, // Lower threshold for smaller/distant cards
      cannyLowThreshold: 30, // More sensitive edge detection
      cannyHighThreshold: 100,
      blurKernelSize: 3, // Less blur to preserve edges
      approxEpsilon: 0.02,
      ...config,
    }
  }

  getStatus(): DetectorStatus {
    return this.status
  }

  async initialize(): Promise<void> {
    if (this.status === 'ready') {
      return
    }

    this.status = 'loading'
    this.setStatus('Loading OpenCV...')

    try {
      // Load OpenCV.js if not already loaded
      await this.ensureOpenCVLoaded()

      this.status = 'ready'
      this.setStatus('OpenCV ready')
    } catch (err) {
      this.status = 'error'
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown error loading OpenCV'
      this.setStatus(`Failed to load OpenCV: ${errorMsg}`)
      throw err
    }
  }

  async detect(): Promise<DetectionOutput> {
    // OpenCV is now click-only mode - return empty for continuous detection
    // Actual detection happens in webcam.ts cropCardAtClick()
    return {
      cards: [],
      inferenceTimeMs: 0,
      rawDetectionCount: 0,
    }
  }

  dispose(): void {
    // Clean up OpenCV matrices
    if (this.src) this.src.delete()
    if (this.gray) this.gray.delete()
    if (this.blurred) this.blurred.delete()
    if (this.edges) this.edges.delete()
    if (this.contours) this.contours.delete()
    if (this.hierarchy) this.hierarchy.delete()

    this.src = null
    this.gray = null
    this.blurred = null
    this.edges = null
    this.contours = null
    this.hierarchy = null

    this.status = 'uninitialized'
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private setStatus(msg: string) {
    this.config.onProgress?.(msg)
  }

  private async ensureOpenCVLoaded(): Promise<void> {
    // Return if already loaded
    if (window.cv && window.cv.Mat) {
      return
    }

    // Return existing promise if loading
    if (window.__cvReadyPromise) {
      return window.__cvReadyPromise
    }

    // Create new loading promise
    window.__cvReadyPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://docs.opencv.org/4.5.2/opencv.js'
      script.async = true

      script.onerror = () => {
        reject(new Error('Failed to load OpenCV.js'))
      }

      // OpenCV.js sets cv.onRuntimeInitialized when ready
      const checkReady = () => {
        if (window.cv && window.cv.Mat) {
          this.setStatus('OpenCV loaded')
          resolve()
        } else {
          setTimeout(checkReady, 100)
        }
      }

      script.onload = () => {
        this.setStatus('OpenCV script loaded, initializing...')
        checkReady()
      }

      document.head.appendChild(script)
    })

    return window.__cvReadyPromise
  }
}

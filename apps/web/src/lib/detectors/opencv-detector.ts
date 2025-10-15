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

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  CardDetector,
  DetectorConfig,
  DetectorStatus,
  DetectionOutput,
  Point,
} from './types'

declare global {
  interface Window {
    cv: any
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
  private src: any = null
  private gray: any = null
  private blurred: any = null
  private edged: any = null
  private contours: any = null
  private hierarchy: any = null

  constructor(config: OpenCVConfig) {
    this.config = {
      minCardArea: 4000, // Match working version
      cannyLowThreshold: 75,
      cannyHighThreshold: 200,
      blurKernelSize: 5,
      approxEpsilon: 0.02,
      ...config,
    }
  }

  getStatus(): DetectorStatus {
    return this.status
  }

  async initialize(): Promise<void> {
    if (this.status === 'ready') {
      console.log('[OpenCVDetector] Already initialized')
      return
    }

    this.status = 'loading'
    this.setStatus('Loading OpenCV...')

    try {
      // Load OpenCV.js if not already loaded
      await this.ensureOpenCVLoaded()
      
      this.status = 'ready'
      this.setStatus('OpenCV ready')
      console.log('[OpenCVDetector] Initialized successfully')
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
    if (this.edged) this.edged.delete()
    if (this.contours) this.contours.delete()
    if (this.hierarchy) this.hierarchy.delete()

    this.src = null
    this.gray = null
    this.blurred = null
    this.edged = null
    this.contours = null
    this.hierarchy = null
    
    this.status = 'uninitialized'
    console.log('[OpenCVDetector] Disposed')
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private setStatus(msg: string) {
    console.log(`[OpenCVDetector] ${msg}`)
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

  private initializeMatrices(width: number, height: number): void {
    const cv = window.cv
    this.src = new cv.Mat(height, width, cv.CV_8UC4)
    this.gray = new cv.Mat()
    this.blurred = new cv.Mat()
    this.edged = new cv.Mat()
    this.contours = new cv.MatVector()
    this.hierarchy = new cv.Mat()
  }

  /**
   * Order points in clockwise order: TL, TR, BR, BL
   */
  private calculateAngles(pts: Point[]): number[] {
    // Calculate interior angles of the quadrilateral
    const angles: number[] = []
    for (let i = 0; i < 4; i++) {
      const p1 = pts[i]
      const p2 = pts[(i + 1) % 4]
      const p3 = pts[(i + 2) % 4]
      
      // Vectors from p2 to p1 and p2 to p3
      const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }
      
      // Calculate angle using dot product
      const dot = v1.x * v2.x + v1.y * v2.y
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
      const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
      
      const cosAngle = dot / (mag1 * mag2)
      const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI)
      angles.push(angle)
    }
    return angles
  }

  private orderPoints(pts: Point[]): Point[] {
    // Sort by x coordinate
    pts.sort((a, b) => a.x - b.x)
    
    // Split into left and right
    const leftMost = pts.slice(0, 2)
    const rightMost = pts.slice(2, 4)
    
    // Sort left by y (top first)
    leftMost.sort((a, b) => a.y - b.y)
    
    // Sort right by y (top first)
    rightMost.sort((a, b) => a.y - b.y)
    
    // Return in order: TL, TR, BR, BL
    return [leftMost[0], rightMost[0], rightMost[1], leftMost[1]]
  }
}

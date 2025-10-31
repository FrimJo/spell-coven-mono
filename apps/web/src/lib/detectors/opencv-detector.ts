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
} from './types.js'

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
  private clickPoint: { x: number; y: number } | null = null

  // OpenCV matrices (reused for performance)
  private src: Mat | null = null
  private gray: InputArray | null = null
  private blurred: InputArray | null = null
  private edges: InputArray | null = null
  private contours: MatVector | null = null
  private hierarchy: Mat | null = null

  constructor(config: OpenCVConfig) {
    this.config = {
      minCardArea: 200, // Very low threshold - even small/distant cards
      cannyLowThreshold: 10, // Very sensitive edge detection
      cannyHighThreshold: 50,
      blurKernelSize: 3, // Less blur to preserve edges
      approxEpsilon: 0.03, // Slightly more lenient polygon approximation
      ...config,
    }
  }

  getStatus(): DetectorStatus {
    return this.status
  }

  setClickPoint(point: { x: number; y: number }): void {
    this.clickPoint = point
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

  async detect(canvas: HTMLCanvasElement): Promise<DetectionOutput> {
    const startTime = performance.now()

    try {
      if (!window.cv) {
        return {
          cards: [],
          inferenceTimeMs: 0,
          rawDetectionCount: 0,
        }
      }

      const cv = window.cv

      // Convert canvas to OpenCV Mat
      this.src = cv.imread(canvas)
      if (!this.src) {
        return {
          cards: [],
          inferenceTimeMs: performance.now() - startTime,
          rawDetectionCount: 0,
        }
      }

      // Convert to grayscale
      this.gray = new cv.Mat()
      cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY)

      // Apply Gaussian blur to reduce noise
      this.blurred = new cv.Mat()
      const blurSize = new cv.Size(
        this.config.blurKernelSize || 3,
        this.config.blurKernelSize || 3,
      )
      cv.GaussianBlur(this.gray, this.blurred, blurSize, 0)

      // Apply Canny edge detection
      this.edges = new cv.Mat()
      cv.Canny(
        this.blurred,
        this.edges,
        this.config.cannyLowThreshold || 10,
        this.config.cannyHighThreshold || 50,
      )

      // Enhance edges with morphological operations
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
      cv.dilate(this.edges, this.edges, kernel, new cv.Point(-1, -1), 2)
      cv.erode(this.edges, this.edges, kernel, new cv.Point(-1, -1), 1)
      kernel.delete()

      console.log('[OpenCV] Edge detection complete')

      // Find contours
      this.contours = new cv.MatVector()
      this.hierarchy = new cv.Mat()
      cv.findContours(
        this.edges,
        this.contours,
        this.hierarchy,
        cv.RETR_TREE,
        cv.CHAIN_APPROX_SIMPLE,
      )

      console.log('[OpenCV] Contours found:', this.contours.size())
      if (this.contours.size() === 0) {
        console.log(
          '[OpenCV] No contours found - edge detection may have failed',
        )
      }

      // Process contours to find card-like rectangles
      const rawDetections: Array<{
        box: { xmin: number; ymin: number; xmax: number; ymax: number }
        score: number
        polygon: Array<{ x: number; y: number }>
      }> = []

      for (let i = 0; i < this.contours.size(); i++) {
        const contour = this.contours.get(i)
        if (!contour) continue

        const area = cv.contourArea(contour)

        // Filter by minimum area
        if (area < (this.config.minCardArea || 500)) {
          console.log(
            `[OpenCV] Contour ${i}: area=${area.toFixed(0)} < min=${this.config.minCardArea || 500}`,
          )
          continue
        }

        // Approximate contour to polygon
        const epsilon =
          (this.config.approxEpsilon || 0.02) * cv.arcLength(contour, true)
        const approx = new cv.Mat()
        cv.approxPolyDP(contour, approx, epsilon, true)

        // Check if it's a quadrilateral (4 points)
        if (approx.rows === 4) {
          // Extract corner points
          const points: Array<{ x: number; y: number }> = []
          for (let j = 0; j < 4; j++) {
            const x = approx.data32S[j * 2]
            const y = approx.data32S[j * 2 + 1]
            points.push({ x, y })
          }

          // Calculate bounding box
          const xs = points.map((p) => p.x)
          const ys = points.map((p) => p.y)
          const xmin = Math.min(...xs)
          const xmax = Math.max(...xs)
          const ymin = Math.min(...ys)
          const ymax = Math.max(...ys)

          // Normalize coordinates to [0, 1]
          const normalizedBox = {
            xmin: xmin / canvas.width,
            ymin: ymin / canvas.height,
            xmax: xmax / canvas.width,
            ymax: ymax / canvas.height,
          }

          // Accept all quadrilaterals - aspect ratio is unreliable for rotated/angled cards
          // Score based on percentage of canvas area
          const canvasArea = canvas.width * canvas.height
          const percentageOfCanvas = (area / canvasArea) * 100
          // Any quadrilateral > 0.1% of canvas gets score 1.0
          const score = Math.min(percentageOfCanvas / 0.1, 1.0)
          console.log(
            `[OpenCV] Contour ${i}: area=${area.toFixed(0)}, %canvas=${percentageOfCanvas.toFixed(3)}, score=${score.toFixed(3)}, points=${points.length}`,
          )

          rawDetections.push({
            box: normalizedBox,
            score,
            polygon: points,
          })
        }

        approx.delete()
      }

      console.log(
        `[OpenCV] Raw detections: ${rawDetections.length}, filtered by area and quadrilateral shape`,
      )

      // Filter by confidence threshold (very low - accept any quadrilateral)
      console.log(
        `[OpenCV] Filtering ${rawDetections.length} detections with threshold=${this.config.confidenceThreshold || 0.01}`,
      )
      let cards = rawDetections
        .filter((d) => d.score >= (this.config.confidenceThreshold || 0.01))
        .map((d) => ({
          box: d.box,
          score: d.score,
          polygon: d.polygon,
        }))

      // If click point provided, prioritize detections near it
      if (this.clickPoint && cards.length > 0) {
        // Calculate distance from click point to each detection's center
        const cardsWithDistance = cards.map((card) => {
          const centerX = ((card.box.xmin + card.box.xmax) / 2) * canvas.width
          const centerY = ((card.box.ymin + card.box.ymax) / 2) * canvas.height
          const dx = centerX - this.clickPoint!.x
          const dy = centerY - this.clickPoint!.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          return { card, distance }
        })

        // Sort by distance (closest first)
        cardsWithDistance.sort((a, b) => a.distance - b.distance)
        cards = cardsWithDistance.map((c) => c.card)
      }

      // Clear click point after use
      this.clickPoint = null

      const inferenceTime = performance.now() - startTime

      return {
        cards,
        inferenceTimeMs: inferenceTime,
        rawDetectionCount: rawDetections.length,
      }
    } catch (err) {
      console.error('[OpenCV] Detection error:', err)
      return {
        cards: [],
        inferenceTimeMs: performance.now() - startTime,
        rawDetectionCount: 0,
      }
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

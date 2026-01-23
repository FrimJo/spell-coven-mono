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

  /** Starting ROI size in pixels (square) */
  roiStartSize?: number

  /** ROI expansion multiplier per pass */
  roiGrowFactor?: number

  /** Maximum ROI expansion passes */
  roiMaxPasses?: number

  /** Expected aspect ratio for MTG cards (height / width) */
  aspectRatio?: number

  /** Allowed aspect ratio tolerance */
  aspectRatioTolerance?: number

  /** Minimum edge support ratio required */
  edgeSupportThreshold?: number
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
      roiStartSize: 300,
      roiGrowFactor: 1.45,
      roiMaxPasses: 6,
      aspectRatio: 1.397,
      aspectRatioTolerance: 0.35,
      edgeSupportThreshold: 0.4,
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

      const rawDetections = this.runAdaptiveDetection(canvas, cv)

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
        const clickPoint = this.clickPoint
        // Calculate distance from click point to each detection's center
        const cardsWithDistance = cards.map((card) => {
          const centerX = ((card.box.xmin + card.box.xmax) / 2) * canvas.width
          const centerY = ((card.box.ymin + card.box.ymax) / 2) * canvas.height
          const dx = centerX - clickPoint.x
          const dy = centerY - clickPoint.y
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

  private runAdaptiveDetection(
    canvas: HTMLCanvasElement,
    cv: CV,
  ): Array<{
    box: { xmin: number; ymin: number; xmax: number; ymax: number }
    score: number
    polygon: Array<{ x: number; y: number }>
  }> {
    const clickPoint = this.clickPoint
    const roiPasses: Array<{ x: number; y: number; size: number }> = []
    if (clickPoint) {
      const maxSize = Math.max(canvas.width, canvas.height)
      let size = Math.min(this.config.roiStartSize || 300, maxSize)
      for (let i = 0; i < (this.config.roiMaxPasses || 6); i++) {
        roiPasses.push({ x: clickPoint.x, y: clickPoint.y, size })
        size = Math.min(size * (this.config.roiGrowFactor || 1.45), maxSize)
      }
    } else {
      roiPasses.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: Math.max(canvas.width, canvas.height),
      })
    }

    for (const roi of roiPasses) {
      const detections = this.detectInRoi(canvas, cv, roi, clickPoint)
      if (detections.length > 0) {
        return detections
      }
    }

    return []
  }

  private detectInRoi(
    canvas: HTMLCanvasElement,
    cv: CV,
    roi: { x: number; y: number; size: number },
    clickPoint: { x: number; y: number } | null,
  ): Array<{
    box: { xmin: number; ymin: number; xmax: number; ymax: number }
    score: number
    polygon: Array<{ x: number; y: number }>
  }> {
    const half = roi.size / 2
    const roiX = Math.max(0, Math.round(roi.x - half))
    const roiY = Math.max(0, Math.round(roi.y - half))
    const roiWidth = Math.min(canvas.width - roiX, Math.round(roi.size))
    const roiHeight = Math.min(canvas.height - roiY, Math.round(roi.size))

    const regionCanvas = document.createElement('canvas')
    regionCanvas.width = roiWidth
    regionCanvas.height = roiHeight
    const regionCtx = regionCanvas.getContext('2d', {
      willReadFrequently: true,
    })
    if (!regionCtx) {
      return []
    }
    regionCtx.drawImage(
      canvas,
      roiX,
      roiY,
      roiWidth,
      roiHeight,
      0,
      0,
      roiWidth,
      roiHeight,
    )

    this.src = cv.imread(regionCanvas)
    if (!this.src) {
      return []
    }

    this.gray = new cv.Mat()
    cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY)

    this.blurred = new cv.Mat()
    const blurSize = new cv.Size(
      this.config.blurKernelSize || 3,
      this.config.blurKernelSize || 3,
    )
    cv.GaussianBlur(this.gray, this.blurred, blurSize, 0)

    this.edges = new cv.Mat()
    cv.Canny(
      this.blurred,
      this.edges,
      this.config.cannyLowThreshold || 10,
      this.config.cannyHighThreshold || 50,
    )

    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
    cv.dilate(this.edges, this.edges, kernel, new cv.Point(-1, -1), 2)
    cv.erode(this.edges, this.edges, kernel, new cv.Point(-1, -1), 1)
    kernel.delete()

    this.contours = new cv.MatVector()
    this.hierarchy = new cv.Mat()
    cv.findContours(
      this.edges,
      this.contours,
      this.hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    )

    const detections: Array<{
      box: { xmin: number; ymin: number; xmax: number; ymax: number }
      score: number
      polygon: Array<{ x: number; y: number }>
    }> = []

    const roiArea = roiWidth * roiHeight
    const expectedRatio = this.config.aspectRatio || 1.397

    if (this.contours.size() === 0) {
      this.cleanupDetectionMats()
      return []
    }

    for (let i = 0; i < this.contours.size(); i++) {
      const contour = this.contours.get(i)
      if (!contour) continue

      const area = cv.contourArea(contour)
      if (area < (this.config.minCardArea || 500)) {
        continue
      }

      if (clickPoint) {
        const clickInRoi = new cv.Point(
          clickPoint.x - roiX,
          clickPoint.y - roiY,
        )
        const distance = cv.pointPolygonTest(contour, clickInRoi, false)
        if (distance < 0) {
          continue
        }
      }

      let points: Array<{ x: number; y: number }> = []
      const rect = cv.minAreaRect(contour)
      const rectWidth = rect.size.width
      const rectHeight = rect.size.height
      const rectRatio =
        rectWidth > 0 && rectHeight > 0
          ? Math.max(rectWidth, rectHeight) / Math.min(rectWidth, rectHeight)
          : 0
      const epsilon =
        (this.config.approxEpsilon || 0.02) * cv.arcLength(contour, true)
      const approx = new cv.Mat()
      cv.approxPolyDP(contour, approx, epsilon, true)

      if (approx.rows === 4) {
        for (let j = 0; j < 4; j++) {
          const x = approx.data32S[j * 2]
          const y = approx.data32S[j * 2 + 1]
          if (x !== undefined && y !== undefined) {
            points.push({ x, y })
          }
        }
      } else {
        const vertices = cv.RotatedRect.points(rect)
        points = vertices.map((pt: { x: number; y: number }) => ({
          x: pt.x,
          y: pt.y,
        }))
      }

      approx.delete()

      if (points.length !== 4) {
        continue
      }

      const ratio = rectRatio || this.calculateAspectRatio(points)
      if (
        Math.abs(ratio - expectedRatio) >
        (this.config.aspectRatioTolerance || 0.35)
      ) {
        continue
      }

      if (!this.edges) {
        continue
      }
      const supportScore = this.calculateEdgeSupport(
        this.edges as Mat,
        points,
      )
      if (supportScore < (this.config.edgeSupportThreshold || 0.4)) {
        continue
      }

      const areaScore = Math.min(area / roiArea, 1)
      const ratioScore = Math.max(
        0,
        1 - Math.abs(ratio - expectedRatio) / expectedRatio,
      )
      const score = areaScore * 1.6 + ratioScore * 0.8 + supportScore * 1.2

      const translatedPoints = points.map((point) => ({
        x: point.x + roiX,
        y: point.y + roiY,
      }))

      const xs = translatedPoints.map((p) => p.x)
      const ys = translatedPoints.map((p) => p.y)
      const xmin = Math.min(...xs)
      const xmax = Math.max(...xs)
      const ymin = Math.min(...ys)
      const ymax = Math.max(...ys)

      detections.push({
        box: {
          xmin: xmin / canvas.width,
          ymin: ymin / canvas.height,
          xmax: xmax / canvas.width,
          ymax: ymax / canvas.height,
        },
        score,
        polygon: translatedPoints,
      })
    }

    const sortedDetections = detections.sort((a, b) => b.score - a.score)
    this.cleanupDetectionMats()
    return sortedDetections
  }

  private cleanupDetectionMats(): void {
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
  }

  private calculateAspectRatio(points: Array<{ x: number; y: number }>): number {
    const [p0, p1, p2, p3] = points
    const width = Math.hypot(p1.x - p0.x, p1.y - p0.y)
    const height = Math.hypot(p3.x - p0.x, p3.y - p0.y)
    if (width === 0) {
      return 0
    }
    const ratio = height / width
    return ratio >= 1 ? ratio : 1 / ratio
  }

  private calculateEdgeSupport(
    edges: Mat,
    points: Array<{ x: number; y: number }>,
  ): number {
    const samplesPerEdge = 20
    let hits = 0
    let total = 0

    for (let i = 0; i < points.length; i++) {
      const start = points[i]
      const end = points[(i + 1) % points.length]
      if (!start || !end) continue
      for (let s = 0; s <= samplesPerEdge; s++) {
        const t = s / samplesPerEdge
        const x = Math.round(start.x + (end.x - start.x) * t)
        const y = Math.round(start.y + (end.y - start.y) * t)
        if (x < 0 || y < 0 || x >= edges.cols || y >= edges.rows) {
          continue
        }
        total += 1
        const value = edges.ucharPtr(y, x)[0]
        if (value && value > 0) {
          hits += 1
        }
      }
    }

    if (total === 0) {
      return 0
    }
    return hits / total
  }

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

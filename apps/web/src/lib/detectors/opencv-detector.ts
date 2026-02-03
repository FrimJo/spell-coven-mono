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
  CardQuad,
  DetectionOutput,
  DetectorConfig,
  DetectorStatus,
  Point,
} from './types.js'
import { orderQuadPoints } from './geometry/contours.js'
import { warpCardToCanonical } from './geometry/perspective.js'

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
  minCardArea: number

  /** Canny edge detection low threshold */
  cannyLowThreshold: number

  /** Canny edge detection high threshold */
  cannyHighThreshold: number

  /** Gaussian blur kernel size */
  blurKernelSize: number

  /** Contour approximation epsilon factor */
  approxEpsilon: number

  /** Starting ROI size in pixels (square) */
  roiStartSize: number

  /** ROI expansion multiplier per pass */
  roiGrowFactor: number

  /** Maximum ROI expansion passes */
  roiMaxPasses: number

  /** Expected aspect ratio for MTG cards (height / width) */
  aspectRatio: number

  /** Allowed aspect ratio tolerance */
  aspectRatioTolerance: number

  /** Minimum edge support ratio required */
  edgeSupportThreshold: number

  /** Minimum detection quality score to stop ROI expansion */
  roiQualityThreshold: number

  /** Minimum ratio of valid edge samples required (0-1) */
  minValidEdgeSampleRatio: number

  /** Scoring weights for detection quality */
  scoreWeights: {
    area: number
    aspectRatio: number
    edgeSupport: number
  }
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

  constructor(config: Partial<OpenCVConfig> & DetectorConfig) {
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
      roiQualityThreshold: 2.0, // Minimum quality score to stop ROI expansion
      minValidEdgeSampleRatio: 0.5, // At least 50% of edge samples must be in bounds
      scoreWeights: {
        area: 1.6,
        aspectRatio: 0.8,
        edgeSupport: 1.2,
      },
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
      let filteredDetections = rawDetections.filter(
        (d) => d.score >= (this.config.confidenceThreshold || 0.01),
      )

      // If click point provided, prioritize detections near it
      if (this.clickPoint && filteredDetections.length > 0) {
        const clickPoint = this.clickPoint
        // Calculate distance from click point to each detection's center
        const detectionsWithDistance = filteredDetections.map((detection) => {
          const centerX =
            ((detection.box.xmin + detection.box.xmax) / 2) * canvas.width
          const centerY =
            ((detection.box.ymin + detection.box.ymax) / 2) * canvas.height
          const dx = centerX - clickPoint.x
          const dy = centerY - clickPoint.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          return { detection, distance }
        })

        // Sort by distance (closest first)
        detectionsWithDistance.sort((a, b) => a.distance - b.distance)
        filteredDetections = detectionsWithDistance.map((c) => c.detection)
      }

      // Clear click point after use
      this.clickPoint = null

      // Apply perspective warp to each detection using the polygon
      const cards = await Promise.all(
        filteredDetections.map(async (d) => {
          // Convert polygon to CardQuad
          const quad =
            d.polygon.length === 4
              ? orderQuadPoints(d.polygon as Point[])
              : null

          // DEBUG: Log the quad detection
          this.logQuadDebug(canvas, quad, d.polygon)

          // Apply perspective warp
          let warpedCanvas: HTMLCanvasElement | undefined
          if (quad) {
            try {
              warpedCanvas = await warpCardToCanonical(canvas, quad)
              console.log('[OpenCV] Perspective warp successful:', {
                width: warpedCanvas.width,
                height: warpedCanvas.height,
              })
            } catch (warpError) {
              console.error('[OpenCV] Perspective warp failed:', warpError)
            }
          }

          // Use ordered quad points for polygon (TL, TR, BR, BL order)
          // This matches the Stage 2 debug visualization
          const orderedPolygon = quad
            ? [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft]
            : d.polygon

          return {
            box: d.box,
            score: d.score,
            polygon: orderedPolygon.map((p) => ({
              x: p.x / canvas.width,
              y: p.y / canvas.height,
            })),
            warpedCanvas,
          }
        }),
      )

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

  /**
   * Log debug visualization of the detected quad
   */
  private logQuadDebug(
    canvas: HTMLCanvasElement,
    quad: CardQuad | null,
    polygon: Array<{ x: number; y: number }>,
  ): void {
    if (!quad) return

    const debugCanvas = document.createElement('canvas')
    debugCanvas.width = canvas.width
    debugCanvas.height = canvas.height
    const debugCtx = debugCanvas.getContext('2d', { willReadFrequently: true })
    if (!debugCtx) return

    debugCtx.drawImage(canvas, 0, 0)

    // Draw the quad corners and edges
    debugCtx.strokeStyle = '#00ff00'
    debugCtx.lineWidth = 3
    debugCtx.beginPath()
    debugCtx.moveTo(quad.topLeft.x, quad.topLeft.y)
    debugCtx.lineTo(quad.topRight.x, quad.topRight.y)
    debugCtx.lineTo(quad.bottomRight.x, quad.bottomRight.y)
    debugCtx.lineTo(quad.bottomLeft.x, quad.bottomLeft.y)
    debugCtx.closePath()
    debugCtx.stroke()

    // Draw corner circles with labels
    debugCtx.fillStyle = '#ff0000'
    const drawCorner = (x: number, y: number, label: string) => {
      debugCtx.beginPath()
      debugCtx.arc(x, y, 8, 0, 2 * Math.PI)
      debugCtx.fill()
      debugCtx.fillStyle = '#ffffff'
      debugCtx.font = '14px monospace'
      debugCtx.fillText(label, x + 12, y + 5)
      debugCtx.fillStyle = '#ff0000'
    }
    drawCorner(quad.topLeft.x, quad.topLeft.y, 'TL')
    drawCorner(quad.topRight.x, quad.topRight.y, 'TR')
    drawCorner(quad.bottomRight.x, quad.bottomRight.y, 'BR')
    drawCorner(quad.bottomLeft.x, quad.bottomLeft.y, 'BL')

    // Log the quad visualization
    debugCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        console.groupCollapsed(
          '%c[DEBUG STAGE 2] OpenCV quad detection (GREEN=edges, RED=corners)',
          'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px;',
        )
        console.log(
          '%c ',
          `background: url(${url}) no-repeat; background-size: contain; padding: 150px;`,
        )
        console.log('Blob URL (copy this):', url)
        console.log('Quad:', quad)
        console.log('Raw polygon:', polygon)
        console.groupEnd()
      }
    }, 'image/png')
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
      let size = Math.min(this.config.roiStartSize, maxSize)
      for (let i = 0; i < this.config.roiMaxPasses; i++) {
        roiPasses.push({ x: clickPoint.x, y: clickPoint.y, size })
        size = Math.min(size * this.config.roiGrowFactor, maxSize)
      }
    } else {
      roiPasses.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: Math.max(canvas.width, canvas.height),
      })
    }

    console.log(
      `[OpenCV] Running adaptive detection with ${roiPasses.length} ROI passes`,
    )

    for (let passIdx = 0; passIdx < roiPasses.length; passIdx++) {
      const roi = roiPasses[passIdx]
      if (!roi) continue

      const passStartTime = performance.now()

      console.log(
        `[OpenCV] ROI pass ${passIdx + 1}/${roiPasses.length}: center=(${roi.x.toFixed(0)}, ${roi.y.toFixed(0)}), size=${roi.size.toFixed(0)}`,
      )

      const detections = this.detectInRoi(canvas, cv, roi, clickPoint)

      const passTime = performance.now() - passStartTime
      console.log(
        `[OpenCV] ROI pass ${passIdx + 1} completed in ${passTime.toFixed(1)}ms: ${detections.length} detections`,
      )

      if (detections.length > 0) {
        const bestScore = detections[0]?.score || 0
        console.log(
          `[OpenCV] Best detection score: ${bestScore.toFixed(3)}, quality threshold: ${this.config.roiQualityThreshold}`,
        )

        // Stop if we found a high-quality detection
        if (bestScore >= this.config.roiQualityThreshold) {
          console.log(
            `[OpenCV] Quality threshold met, stopping ROI expansion at pass ${passIdx + 1}`,
          )
          return detections
        }

        // Continue expanding if quality is below threshold
        console.log(
          `[OpenCV] Quality below threshold, continuing ROI expansion...`,
        )
      }
    }

    // Return best detections from all passes
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

    // Find contours
    // Using RETR_EXTERNAL instead of RETR_TREE to only find outermost contours.
    // This prevents detecting internal features (text, symbols, mana costs) as separate cards
    // and reduces false positives from complex card artwork.
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
    const expectedRatio = this.config.aspectRatio

    if (this.contours.size() === 0) {
      console.log(`[OpenCV] No contours found in ROI`)
      this.cleanupDetectionMats()
      return []
    }

    console.log(`[OpenCV] Processing ${this.contours.size()} contours in ROI`)

    for (let i = 0; i < this.contours.size(); i++) {
      const contour = this.contours.get(i)
      if (!contour) continue

      const area = cv.contourArea(contour)
      if (area < this.config.minCardArea) {
        console.log(
          `[OpenCV] Contour ${i}: area=${area.toFixed(0)} < minCardArea=${this.config.minCardArea}, skipping`,
        )
        continue
      }

      if (clickPoint) {
        const clickInRoi = new cv.Point(
          clickPoint.x - roiX,
          clickPoint.y - roiY,
        )
        const distance = cv.pointPolygonTest(contour, clickInRoi, false)
        if (distance < 0) {
          console.log(
            `[OpenCV] Contour ${i}: click point not inside contour, skipping`,
          )
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
      const epsilon = this.config.approxEpsilon * cv.arcLength(contour, true)
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
        console.log(
          `[OpenCV] Contour ${i}: points.length=${points.length} !== 4, skipping`,
        )
        continue
      }

      const ratio = rectRatio || this.calculateAspectRatio(points)
      const ratioDiff = Math.abs(ratio - expectedRatio)
      if (ratioDiff > this.config.aspectRatioTolerance) {
        console.log(
          `[OpenCV] Contour ${i}: aspect ratio=${ratio.toFixed(3)}, expected=${expectedRatio.toFixed(3)}, diff=${ratioDiff.toFixed(3)} > tolerance=${this.config.aspectRatioTolerance}, skipping`,
        )
        continue
      }

      if (!this.edges) {
        continue
      }
      const { supportScore, validSampleRatio } = this.calculateEdgeSupport(
        this.edges,
        points,
      )
      if (validSampleRatio < this.config.minValidEdgeSampleRatio) {
        console.log(
          `[OpenCV] Contour ${i}: validSampleRatio=${validSampleRatio.toFixed(3)} < minValidEdgeSampleRatio=${this.config.minValidEdgeSampleRatio}, skipping`,
        )
        continue
      }
      if (supportScore < this.config.edgeSupportThreshold) {
        console.log(
          `[OpenCV] Contour ${i}: edgeSupport=${supportScore.toFixed(3)} < threshold=${this.config.edgeSupportThreshold}, skipping`,
        )
        continue
      }

      const areaScore = Math.min(area / roiArea, 1)
      const ratioScore = Math.max(0, 1 - ratioDiff / expectedRatio)
      const score =
        areaScore * this.config.scoreWeights.area +
        ratioScore * this.config.scoreWeights.aspectRatio +
        supportScore * this.config.scoreWeights.edgeSupport

      console.log(
        `[OpenCV] Contour ${i}: ACCEPTED - area=${area.toFixed(0)}, ratio=${ratio.toFixed(3)}, edgeSupport=${supportScore.toFixed(3)}, score=${score.toFixed(3)}`,
      )

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

  private calculateAspectRatio(
    points: Array<{ x: number; y: number }>,
  ): number {
    if (points.length !== 4) {
      return 0
    }

    // Calculate all 4 edge lengths to handle arbitrary point ordering
    const edges: number[] = []
    for (let i = 0; i < 4; i++) {
      const p1 = points[i]
      const p2 = points[(i + 1) % 4]
      if (!p1 || !p2) {
        return 0
      }
      const length = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      edges.push(length)
    }

    // Sort edges to get the two longest (opposite sides)
    edges.sort((a, b) => b - a)
    const longestEdge = edges[0] || 0
    const secondLongestEdge = edges[1] || 0

    // Avoid division by zero
    if (secondLongestEdge === 0) {
      return 0
    }

    // For a rectangle, opposite sides are equal, so longest/second-longest gives aspect ratio
    // Ensure ratio is always >= 1 (height/width convention)
    const ratio = longestEdge / secondLongestEdge
    return ratio >= 1 ? ratio : 1 / ratio
  }

  private calculateEdgeSupport(
    edges: InputArray,
    points: Array<{ x: number; y: number }>,
  ): { supportScore: number; validSampleRatio: number } {
    const samplesPerEdge = 20
    let hits = 0
    let total = 0
    let validSamples = 0

    for (let i = 0; i < points.length; i++) {
      const start = points[i]
      const end = points[(i + 1) % points.length]
      if (!start || !end) continue
      for (let s = 0; s <= samplesPerEdge; s++) {
        const t = s / samplesPerEdge
        const x = Math.round(start.x + (end.x - start.x) * t)
        const y = Math.round(start.y + (end.y - start.y) * t)
        total += 1
        if (x < 0 || y < 0 || x >= edges.cols || y >= edges.rows) {
          continue
        }
        validSamples += 1
        const value = edges.ucharPtr(y, x)[0]
        if (value && value > 0) {
          hits += 1
        }
      }
    }

    if (total === 0) {
      return { supportScore: 0, validSampleRatio: 0 }
    }

    const validSampleRatio = validSamples / total

    // Calculate support score only from valid samples
    const supportScore = validSamples > 0 ? hits / validSamples : 0

    return { supportScore, validSampleRatio }
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

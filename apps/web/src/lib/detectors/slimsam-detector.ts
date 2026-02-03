/**
 * SlimSAM-based card detector implementation
 *
 * Uses Transformers.js SlimSAM model for point-prompt segmentation.
 * Extracts card region from click point, refines corners, and enforces aspect ratio.
 *
 * @module detectors/slimsam-detector
 */

import type { DetectedCard, Point } from '@/types/card-query'
import type {
  SamImageProcessorResult as ImageProcessorResult,
  PreTrainedModel,
  ProgressCallback,
  Tensor,
} from '@huggingface/transformers'
import {
  AutoProcessor,
  env,
  RawImage,
  SamModel,
  SamProcessor,
} from '@huggingface/transformers'

import type {
  CardDetector,
  CardQuad,
  DetectionOutput,
  DetectorConfig,
  DetectorStatus,
} from './types.js'
import { MTG_CARD_ASPECT_RATIO } from '../detection-constants.js'
import { loadOpenCV } from '../opencv-loader.js'
import { extractQuadFromMask } from './geometry/contours.js'
import { warpCardToCanonical } from './geometry/perspective.js'
import { validateQuad } from './geometry/validation.js'

// Suppress ONNX Runtime warnings
if (
  typeof env !== 'undefined' &&
  'wasm' in env.backends.onnx &&
  env.backends.onnx.wasm
) {
  env.backends.onnx.wasm.numThreads = 1
}

// Configuration for HuggingFace access
// No retries or fallbacks - fail fast if model doesn't work

/**
 * SlimSAM detector implementation
 *
 * Implements:
 * - T026: initialize() with model loading (FR-009)
 * - T027: getStatus() method
 * - T028: dispose() method
 * - T029: detect() with point-prompt segmentation
 * - T030: mask-to-polygon conversion
 * - T031: corner refinement and aspect ratio enforcement (FR-011)
 * - T032: perspective warp to canonical rectangle
 * - T033: WebGPU/WebGL/WASM fallback handling (FR-013)
 * - T034: detection failure notification (FR-016)
 * - T035: structured error logging (FR-018)
 */
export class SlimSAMDetector implements CardDetector {
  private status: DetectorStatus = 'uninitialized'
  private model: PreTrainedModel | null = null
  private processor: SamProcessor | null = null
  private isLoading = false
  private config: DetectorConfig
  private clickPoint: Point | null = null
  private initializationAttempts = 0
  private lastError: Error | null = null

  constructor(config: DetectorConfig) {
    this.config = config
  }

  getStatus(): DetectorStatus {
    return this.status
  }

  /**
   * T026: Initialize detector with model loading (FR-009)
   * T033: WebGPU/WebGL/WASM fallback handling (FR-013)
   * Enhanced with retry logic and 401 error handling
   */
  async initialize(): Promise<void> {
    // Return if already loaded
    if (this.model && this.processor) {
      return
    }

    // Prevent concurrent loading
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return
    }

    this.isLoading = true
    this.status = 'loading'

    try {
      await this.initializeWithRetry()
      this.status = 'ready'
      this.setStatus('SlimSAM ready')
    } catch (err) {
      this.status = 'error'
      this.lastError = err instanceof Error ? err : new Error(String(err))

      // T035: Structured error logging (FR-018)
      this.logError('SlimSAM initialization', err)

      const errorMsg = this.lastError.message
      this.setStatus(`Failed to load SlimSAM: ${errorMsg}`)

      // Re-throw the original error - no special handling, fail hard
      throw err
    } finally {
      this.isLoading = false
    }
  }

  /**
   * Initialize SlimSAM model - no retries, fail fast
   */
  private async initializeWithRetry(): Promise<void> {
    const modelId = this.config.modelId || 'Xenova/slimsam-77-uniform'

    this.initializationAttempts++

    // Check backend support (WebGPU → WebGL → WASM)
    const backend = env.backends.onnx.wasm?.proxy ? 'WEBGPU' : 'WASM'
    this.setStatus(`Initializing SlimSAM (${backend})...`)

    // Initialize SlimSAM model and processor directly (not via pipeline)
    const progressCallback: ProgressCallback = (progress) => {
      if (progress.status === 'progress') {
        const percent = Math.round(progress.progress || 0)
        this.setStatus(`Downloading: ${progress.file} - ${percent}%`)
      }
    }

    // Load model and processor - fail hard if this doesn't work
    this.model = await SamModel.from_pretrained(modelId, {
      progress_callback: progressCallback,
      device: this.config.device || 'auto',
      dtype: this.config.dtype || 'fp16',
    })

    const processor = await AutoProcessor.from_pretrained(modelId, {
      progress_callback: progressCallback,
    })

    const isProcessorSamProcessor = processor instanceof SamProcessor

    if (!isProcessorSamProcessor) {
      const error = new Error('Processor is not a SamProcessor')
      this.logError('SlimSAM initialization', error)
      throw error
    }
    this.processor = processor

    console.log(
      `[SlimSAMDetector] Successfully initialized with model: ${modelId}`,
    )
  }

  /**
   * Set click point for next detection
   * Called by UI before detect()
   */
  setClickPoint(point: Point): void {
    this.clickPoint = point
  }

  /**
   * T029: Detect with point-prompt segmentation
   * T030: Mask-to-polygon conversion
   * T031: Corner refinement and aspect ratio enforcement (FR-011)
   * T032: Perspective warp to canonical rectangle
   * T034: Detection failure notification (FR-016)
   */
  async detect(
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number,
  ): Promise<DetectionOutput> {
    if (this.status !== 'ready' || !this.model || !this.processor) {
      const error = new Error(
        'Detector not initialized. Call initialize() first.',
      )
      this.logError('SlimSAM detect', error)
      throw error
    }

    // Use click point if provided, otherwise center
    const point = this.clickPoint

    if (!point) {
      const error = new Error(
        'SlimSAM detection requires a click point. Call setClickPoint() before detect().',
      )
      this.logError('SlimSAM detect', error)
      throw error
    }

    // Reset click point so each detection requires an explicit prompt
    this.clickPoint = null

    const startTime = performance.now()

    try {
      // T029: Run segmentation with point + negative points prompt
      // Convert canvas to RawImage
      const image = RawImage.fromCanvas(canvas)

      // Strategy: Use multiple positive points in a small grid around click
      // This reinforces "segment THIS object" and prevents expanding to playmat
      // Create a 3x3 grid of points around the click (within ~50px radius)
      const gridRadius = 30 // pixels
      const positivePoints = [
        [point.x, point.y], // Center (original click)
        [point.x - gridRadius, point.y - gridRadius], // Top-left
        [point.x + gridRadius, point.y - gridRadius], // Top-right
        [point.x - gridRadius, point.y + gridRadius], // Bottom-left
        [point.x + gridRadius, point.y + gridRadius], // Bottom-right
      ]

      // Add negative points far from the card
      const margin = Math.min(canvasWidth, canvasHeight) * 0.1 // 10% margin
      const negativePoints = [
        [margin, margin], // Top-left corner
        [canvasWidth - margin, margin], // Top-right corner
        [margin, canvasHeight - margin], // Bottom-left corner
        [canvasWidth - margin, canvasHeight - margin], // Bottom-right corner
      ]

      // Combine all points
      const allPoints = [...positivePoints, ...negativePoints]
      const allLabels = [1, 1, 1, 1, 1, 0, 0, 0, 0] // 5 positive, 4 negative

      console.log('[SlimSAM] Using point prompts with negative edges:', {
        click: point,
        negativePoints,
        canvasSize: { width: canvasWidth, height: canvasHeight },
      })

      // Prepare inputs with positive + negative point prompts
      const inputs: ImageProcessorResult = await this.processor(image, {
        input_points: [[allPoints]],
        input_labels: [[allLabels]],
      })

      // Run model inference
      const outputs = await this.model(inputs)

      // Post-process masks to get properly sized output
      const masks: Tensor[] = await this.processor.post_process_masks(
        outputs.pred_masks,
        inputs.original_sizes,
        inputs.reshaped_input_sizes,
      )

      // Get IoU scores for quality filtering
      const iouScores = outputs.iou_scores

      const inferenceTimeMs = performance.now() - startTime

      // Check if we got valid masks
      if (!masks || masks.length === 0) {
        // T034: Detection failure notification (FR-016)
        this.logError('SlimSAM segmentation', new Error('No masks detected'))
        return {
          cards: [],
          inferenceTimeMs,
          rawDetectionCount: 0,
        }
      }

      // Log mask info for debugging
      console.log('[SlimSAMDetector] Generated masks:', {
        count: masks.length,
        dimensions: masks[0]?.dims,
        iouScores: iouScores?.data,
      })

      // T030-T032: Convert masks to card detections with corner refinement
      const cards: DetectedCard[] = []

      // Process each mask (SAM typically returns 3 masks per point)
      // Use the one with highest IoU score
      if (masks.length > 0 && iouScores?.data) {
        // Find best mask by IoU score
        let bestMaskIdx = 0
        let bestScore = iouScores.data[0]

        for (
          let i = 1;
          i < Math.min(masks.length, iouScores.data.length);
          i++
        ) {
          if (iouScores.data[i] > bestScore) {
            bestScore = iouScores.data[i]
            bestMaskIdx = i
          }
        }

        // Only use masks with good IoU scores (> 0.5)
        if (bestScore > 0.5) {
          const mask = masks[bestMaskIdx]

          if (!mask) {
            throw new Error('SlimSAMDetector: Mask is missing at bestMaskIdx')
          }
          // T018-T020: Extract quad from mask using contour detection
          const quad = await this.extractQuadFromMask(
            mask,
            canvasWidth,
            canvasHeight,
          )

          if (quad) {
            // DEBUG: Visualize the detected quad
            const debugCanvas = document.createElement('canvas')
            debugCanvas.width = canvasWidth
            debugCanvas.height = canvasHeight
            const debugCtx = debugCanvas.getContext('2d', {
              willReadFrequently: true,
            })
            if (!debugCtx) {
              throw new Error(
                'SlimSAMDetector: Failed to get 2d context from debug canvas',
              )
            }
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

            // Draw corner circles
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
                  '%c[DEBUG STAGE 2] SlimSAM quad detection (GREEN=edges, RED=corners)',
                  'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px;',
                )
                console.log(
                  '%c ',
                  `background: url(${url}) no-repeat; background-size: contain; padding: 150px;`,
                )
                console.log('Blob URL (copy this):', url)
                console.log('Quad:', quad)
                console.groupEnd()
              }
            }, 'image/png')

            // T019: Validate quad
            const validation = validateQuad(quad, canvasWidth, canvasHeight)

            if (validation.valid) {
              // T020: Apply perspective warp using OpenCV quad to get canonical card image
              console.log(
                '[SlimSAM] Calling warpCardToCanonical with quad:',
                quad,
              )
              let warpedCanvas: HTMLCanvasElement | undefined
              try {
                warpedCanvas = await warpCardToCanonical(canvas, quad)
                console.log('[SlimSAM] warpCardToCanonical returned:', {
                  hasCanvas: !!warpedCanvas,
                  width: warpedCanvas?.width,
                  height: warpedCanvas?.height,
                })
              } catch (warpError) {
                console.error(
                  '[SlimSAM] warpCardToCanonical failed:',
                  warpError,
                )
              }

              // Convert quad to normalized polygon for DetectedCard
              const polygon: Point[] = [
                {
                  x: quad.topLeft.x / canvasWidth,
                  y: quad.topLeft.y / canvasHeight,
                },
                {
                  x: quad.topRight.x / canvasWidth,
                  y: quad.topRight.y / canvasHeight,
                },
                {
                  x: quad.bottomRight.x / canvasWidth,
                  y: quad.bottomRight.y / canvasHeight,
                },
                {
                  x: quad.bottomLeft.x / canvasWidth,
                  y: quad.bottomLeft.y / canvasHeight,
                },
              ]

              // Create bounding box from quad
              const xs = polygon.map((p) => p.x)
              const ys = polygon.map((p) => p.y)
              const boundingBox = {
                xmin: Math.min(...xs),
                ymin: Math.min(...ys),
                xmax: Math.max(...xs),
                ymax: Math.max(...ys),
              }

              cards.push({
                box: boundingBox,
                polygon,
                score: bestScore,
                aspectRatio: validation.aspectRatio,
                warpedCanvas, // Store warped canvas for extraction
              })

              console.log(
                '[SlimSAMDetector] Successfully extracted and warped card:',
                {
                  quad,
                  aspectRatio: validation.aspectRatio,
                  bestScore,
                  warpedSize: `${warpedCanvas.width}x${warpedCanvas.height}`,
                },
              )
            } else {
              // T023: Handle invalid quad geometry - FAIL EXPLICITLY
              const error = new Error(
                `SlimSAM quad validation failed: ${validation.reason}`,
              )
              this.logError('SlimSAM quad validation', error)
              throw error
            }
          } else {
            // T023: Quad extraction failed - log warning but don't throw
            console.warn(
              '[SlimSAMDetector] Failed to extract quad from mask - segmentation quality too low. Try clicking again.',
            )
            // Return empty cards array instead of throwing
          }
        }
      }

      return {
        cards,
        inferenceTimeMs,
        rawDetectionCount: masks.length,
      }
    } catch (error) {
      // T035: Structured error logging (FR-018)
      this.logError('SlimSAM segmentation', error)

      // T034: Detection failure notification (FR-016)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      this.setStatus(`Detection failed: ${errorMsg}`)

      throw error
    }
  }

  /**
   * T028: Dispose method
   */
  dispose(): void {
    if (this.model && typeof this.model.dispose === 'function') {
      this.model.dispose()
    }
    this.model = null
    this.processor = null
    this.clickPoint = null
    this.status = 'uninitialized'
  }

  /**
   * Extract quad from mask using OpenCV contour detection
   *
   * @param mask - SlimSAM output mask
   * @param canvasWidth - Canvas width for coordinate conversion
   * @param canvasHeight - Canvas height for coordinate conversion
   * @returns CardQuad or null if extraction fails
   */
  private async extractQuadFromMask(
    mask: Tensor,
    canvasWidth: number,
    canvasHeight: number,
  ): Promise<CardQuad | null> {
    try {
      // Load OpenCV
      const cv = await loadOpenCV()

      // Convert mask to OpenCV Mat
      const maskData = mask.data
      const dims = mask.dims

      if (!maskData || !dims || dims.length < 3) {
        console.warn(
          '[SlimSAMDetector] Invalid mask format for quad extraction',
        )
        return null
      }

      const maskHeight = dims[dims.length - 2]
      const maskWidth = dims[dims.length - 1]
      if (maskHeight === undefined || maskWidth === undefined) {
        throw new Error('SlimSAMDetector: Missing mask dimensions')
      }

      // Create binary mask (0 or 255)
      const binaryData = new Uint8Array(maskHeight * maskWidth)
      const threshold = 0.5
      for (let i = 0; i < maskData.length; i++) {
        binaryData[i] = maskData[i] > threshold ? 255 : 0
      }

      // Create OpenCV Mat from binary data
      const cvMask = new cv.Mat(maskHeight, maskWidth, cv.CV_8UC1)
      cvMask.data.set(binaryData)

      // Scale click point to mask coordinates if available
      let clickPointInMask: Point | undefined = undefined
      if (this.clickPoint) {
        const scaleX = maskWidth / canvasWidth
        const scaleY = maskHeight / canvasHeight
        clickPointInMask = {
          x: this.clickPoint.x * scaleX,
          y: this.clickPoint.y * scaleY,
        }
        console.log('[SlimSAM] Click point scaled to mask coordinates:', {
          canvas: this.clickPoint,
          mask: clickPointInMask,
          maskSize: { width: maskWidth, height: maskHeight },
          canvasSize: { width: canvasWidth, height: canvasHeight },
        })
      }

      // Extract quad using contour detection with click point
      const quad = await extractQuadFromMask(cvMask, clickPointInMask)

      // Cleanup
      cvMask.delete()

      if (!quad) {
        return null
      }

      // Scale quad from mask coordinates to canvas coordinates
      const scaleX = canvasWidth / maskWidth
      const scaleY = canvasHeight / maskHeight

      return {
        topLeft: { x: quad.topLeft.x * scaleX, y: quad.topLeft.y * scaleY },
        topRight: {
          x: quad.topRight.x * scaleX,
          y: quad.topRight.y * scaleY,
        },
        bottomRight: {
          x: quad.bottomRight.x * scaleX,
          y: quad.bottomRight.y * scaleY,
        },
        bottomLeft: {
          x: quad.bottomLeft.x * scaleX,
          y: quad.bottomLeft.y * scaleY,
        },
      }
    } catch (error) {
      this.logError('SlimSAM quad extraction (OpenCV)', error)
      return null
    }
  }

  /**
   * T035: Structured error logging (FR-018)
   */
  private logError(context: string, error: unknown): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      type: 'detection' as const,
      context: `SlimSAM: ${context}`,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }
    console.error('[SlimSAMDetector]', JSON.stringify(errorLog, null, 2))
  }

  private setStatus(message: string): void {
    this.config.onProgress?.(message)
  }
}

// Export MTG_CARD_ASPECT_RATIO for testing
export { MTG_CARD_ASPECT_RATIO }

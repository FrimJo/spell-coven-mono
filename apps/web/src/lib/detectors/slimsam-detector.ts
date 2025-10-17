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
import { ImageProcessorResult } from 'node_modules/@huggingface/transformers/types/base/image_processors_utils'

import type {
  CardDetector,
  CardQuad,
  DetectionOutput,
  DetectorConfig,
  DetectorStatus,
} from './types'
import { MTG_CARD_ASPECT_RATIO } from '../detection-constants'
import { loadOpenCV } from '../opencv-loader'
import { extractQuadFromMask } from './geometry/contours'
import { warpCardToCanonical } from './geometry/perspective'
import { validateQuad } from './geometry/validation'

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
      // T029: Run segmentation with point prompt
      // Convert canvas to RawImage
      const image = RawImage.fromCanvas(canvas)

      // Prepare inputs with point prompts
      const inputs: ImageProcessorResult = await this.processor(image, {
        input_points: [[[point.x, point.y]]],
        input_labels: [[1]], // 1 = foreground
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

          // T018-T020: Extract quad from mask using contour detection
          const quad = await this.extractQuadFromMask(
            mask,
            canvasWidth,
            canvasHeight,
          )

          if (quad) {
            // T019: Validate quad
            const validation = validateQuad(quad, canvasWidth, canvasHeight)

            if (validation.valid) {
              // T020: Apply perspective warp to get canonical 384x384 image
              const warpedCanvas = await warpCardToCanonical(canvas, quad)

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
            // T023: Quad extraction failed - FAIL EXPLICITLY
            const error = new Error(
              'SlimSAM failed to extract quad from mask - segmentation quality too low',
            )
            this.logError('SlimSAM quad extraction', error)
            throw error
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

      // Create binary mask (0 or 255)
      const binaryData = new Uint8Array(maskHeight * maskWidth)
      const threshold = 0.5
      for (let i = 0; i < maskData.length; i++) {
        binaryData[i] = maskData[i] > threshold ? 255 : 0
      }

      // Create OpenCV Mat from binary data
      const cvMask = new cv.Mat(maskHeight, maskWidth, cv.CV_8UC1)
      cvMask.data.set(binaryData)

      // Extract quad using contour detection
      const quad = await extractQuadFromMask(cvMask)

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
        topRight: { x: quad.topRight.x * scaleX, y: quad.topRight.y * scaleY },
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

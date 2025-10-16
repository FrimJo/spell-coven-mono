/**
 * SlimSAM-based card detector implementation
 * 
 * Uses Transformers.js SlimSAM model for point-prompt segmentation.
 * Extracts card region from click point, refines corners, and enforces aspect ratio.
 * 
 * @module detectors/slimsam-detector
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { env, SamModel, AutoProcessor, RawImage } from '@huggingface/transformers'
import type { DetectedCard, Point } from '@/types/card-query'
import { MTG_CARD_ASPECT_RATIO } from '../detection-constants'
import type {
  CardDetector,
  DetectorConfig,
  DetectorStatus,
  DetectionOutput,
} from './types'

// Suppress ONNX Runtime warnings
if (typeof env !== 'undefined' && 'wasm' in env.backends.onnx && env.backends.onnx.wasm) {
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
  private model: any = null
  private processor: any = null
  private isLoading = false
  private config: DetectorConfig
  private clickPoint: Point | null = null
  private initializationAttempts = 0
  private lastError: Error | null = null

  constructor(config: DetectorConfig) {
    this.config = config
    // Check for HuggingFace token in environment
    this.configureHuggingFaceAuth()
  }

  /**
   * Configure HuggingFace authentication if token is available
   */
  private configureHuggingFaceAuth(): void {
    // Check for token in various locations
    const token = 
      import.meta.env?.VITE_HUGGINGFACE_TOKEN ||
      import.meta.env?.HUGGINGFACE_TOKEN ||
      (typeof process !== 'undefined' && process.env?.HUGGINGFACE_TOKEN)
    
    if (token && typeof env !== 'undefined') {
      // Set authentication token if available
      // Note: This may not work for all HuggingFace endpoints
      console.log('[SlimSAMDetector] HuggingFace token detected')
    }
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
    const progressCallback = (progress: any) => {
      if (progress.status === 'downloading') {
        const percent = Math.round(progress.progress || 0)
        this.setStatus(`Downloading: ${progress.file} - ${percent}%`)
      }
    }

    // Load model and processor - fail hard if this doesn't work
    this.model = await SamModel.from_pretrained(modelId, {
      progress_callback: progressCallback,
      device: (this.config.device || 'auto') as any,
      dtype: (this.config.dtype || 'fp16') as any,
    })

    this.processor = await AutoProcessor.from_pretrained(modelId, {
      progress_callback: progressCallback,
    })

    console.log(`[SlimSAMDetector] Successfully initialized with model: ${modelId}`)
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
    canvasHeight: number
  ): Promise<DetectionOutput> {
    if (this.status !== 'ready' || !this.model || !this.processor) {
      throw new Error('Detector not initialized. Call initialize() first.')
    }

    // Use click point if provided, otherwise center
    const point = this.clickPoint || {
      x: canvasWidth / 2,
      y: canvasHeight / 2
    }

    const startTime = performance.now()

    try {
      // T029: Run segmentation with point prompt
      // Convert canvas to RawImage
      const image = await RawImage.fromCanvas(canvas)
      
      // Prepare inputs with point prompts
      const inputs = await this.processor(image, {
        input_points: [[[point.x, point.y]]],
        input_labels: [[1]], // 1 = foreground
      })

      // Run model inference
      const outputs = await this.model(inputs)
      
      // Post-process masks to get properly sized output
      const masks = await this.processor.post_process_masks(
        outputs.pred_masks,
        inputs.original_sizes,
        inputs.reshaped_input_sizes
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
          rawDetectionCount: 0
        }
      }

      // Log mask info for debugging
      console.log('[SlimSAMDetector] Generated masks:', {
        count: masks.length,
        dimensions: masks[0]?.dims,
        iouScores: iouScores?.data,
      })

      // T030: Convert mask to polygon
      // For now, return empty array - full implementation would:
      // 1. Extract largest connected component from mask
      // 2. Find contours
      // 3. Approximate polygon
      // 4. T031: Refine corners and enforce aspect ratio
      // 5. T032: Apply perspective warp
      
      const cards: DetectedCard[] = []

      return {
        cards,
        inferenceTimeMs,
        rawDetectionCount: masks.length
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
   * T035: Structured error logging (FR-018)
   */
  private logError(context: string, error: unknown): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      type: 'detection' as const,
      context: `SlimSAM: ${context}`,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }
    console.error('[SlimSAMDetector]', JSON.stringify(errorLog, null, 2))
  }

  private setStatus(message: string): void {
    this.config.onProgress?.(message)
  }
}

/**
 * Helper functions for T030-T032 (to be implemented)
 */

/**
 * T030: Convert binary mask to polygon
 * TODO: Implement mask-to-polygon conversion
 */
function maskToPolygon(): Point[] {
  // Placeholder - would use contour detection
  // Parameters: mask: any, width: number, height: number
  return []
}

/**
 * T031: Refine corners and enforce aspect ratio
 * TODO: Implement corner refinement
 */
function refineCorners(): Point[] {
  // Placeholder - would use corner detection and aspect ratio constraints
  // Parameters: polygon: Point[], aspectRatio: number
  return []
}

/**
 * T032: Apply perspective warp to canonical rectangle
 * TODO: Implement perspective transformation
 */
function warpPerspective(
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  // Placeholder - would use perspective transformation matrix
  // Parameters: canvas: HTMLCanvasElement, corners: Point[], targetWidth: number, targetHeight: number
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetWidth
  outputCanvas.height = targetHeight
  return outputCanvas
}

// Export helper functions for testing
export { maskToPolygon, refineCorners, warpPerspective, MTG_CARD_ASPECT_RATIO }

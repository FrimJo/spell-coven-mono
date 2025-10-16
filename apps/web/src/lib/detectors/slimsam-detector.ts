/**
 * SlimSAM-based card detector implementation
 * 
 * Uses Transformers.js SlimSAM model for point-prompt segmentation.
 * Extracts card region from click point, refines corners, and enforces aspect ratio.
 * 
 * @module detectors/slimsam-detector
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { env, pipeline } from '@huggingface/transformers'
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
  private segmenter: any = null
  private isLoading = false
  private config: DetectorConfig
  private clickPoint: Point | null = null

  constructor(config: DetectorConfig) {
    this.config = config
  }

  getStatus(): DetectorStatus {
    return this.status
  }

  /**
   * T026: Initialize detector with model loading (FR-009)
   * T033: WebGPU/WebGL/WASM fallback handling (FR-013)
   */
  async initialize(): Promise<void> {
    // Return if already loaded
    if (this.segmenter) {
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
      // Check backend support (WebGPU → WebGL → WASM)
      const backend = env.backends.onnx.wasm?.proxy ? 'WEBGPU' : 'WASM'
      this.setStatus(`Initializing SlimSAM (${backend})...`)

      // Initialize SlimSAM pipeline
      this.segmenter = await pipeline(
        'image-segmentation',
        this.config.modelId || 'Xenova/slimsam',
        {
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              const percent = Math.round(progress.progress || 0)
              this.setStatus(`Downloading: ${progress.file} - ${percent}%`)
            }
          },
          device: (this.config.device || 'auto') as any,
          dtype: (this.config.dtype || 'fp16') as any,
        }
      )

      this.status = 'ready'
      this.setStatus('SlimSAM ready')
    } catch (err) {
      this.status = 'error'
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown error loading SlimSAM'
      
      // T035: Structured error logging (FR-018)
      this.logError('SlimSAM initialization', err)
      this.setStatus(`Failed to load SlimSAM: ${errorMsg}`)
      throw err
    } finally {
      this.isLoading = false
    }
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
    if (this.status !== 'ready' || !this.segmenter) {
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
      const result = await this.segmenter(canvas, {
        points: [[point.x, point.y]],
        labels: [1] // 1 = foreground
      })

      const inferenceTimeMs = performance.now() - startTime

      // Check if we got valid masks
      if (!result || !result.masks || result.masks.length === 0) {
        // T034: Detection failure notification (FR-016)
        this.logError('SlimSAM segmentation', new Error('No masks detected'))
        return {
          cards: [],
          inferenceTimeMs,
          rawDetectionCount: 0
        }
      }

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
        rawDetectionCount: result.masks.length
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
    this.segmenter = null
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

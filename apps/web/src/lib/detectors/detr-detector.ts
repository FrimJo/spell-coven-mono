/**
 * DETR-based card detector implementation
 *
 * Uses Transformers.js DETR model for object detection.
 * Filters detections by confidence, aspect ratio, and object class.
 *
 * @module detectors/detr-detector
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { DetectedCard, DetectionResult, Point } from '@/types/card-query'
import { env, pipeline } from '@huggingface/transformers'

import type {
  CardDetector,
  DetectionOutput,
  DetectorConfig,
  DetectorStatus,
} from './types'
import {
  ASPECT_RATIO_TOLERANCE,
  MIN_CARD_AREA,
  MTG_CARD_ASPECT_RATIO,
} from '../detection-constants'

// Suppress ONNX Runtime warnings
if (
  typeof env !== 'undefined' &&
  'wasm' in env.backends.onnx &&
  env.backends.onnx.wasm
) {
  env.backends.onnx.wasm.numThreads = 1
}

/**
 * DETR detector implementation
 */
export class DETRDetector implements CardDetector {
  private status: DetectorStatus = 'uninitialized'
  private detector: any = null
  private isLoading = false
  private config: DetectorConfig

  constructor(config: DetectorConfig) {
    this.config = config
  }

  getStatus(): DetectorStatus {
    return this.status
  }

  async initialize(): Promise<void> {
    // Return if already loaded
    if (this.detector) {
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
      // Check GPU support
      const _gpuSupport = env.backends.onnx.wasm?.proxy ? 'WEBGPU' : 'WASM'
      void _gpuSupport // Used for debugging

      this.setStatus('Loading detection model...')

      // Initialize DETR pipeline
      this.detector = await pipeline('object-detection', this.config.modelId, {
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            const percent = Math.round(progress.progress || 0)
            this.setStatus(`Downloading: ${progress.file} - ${percent}%`)
          }
        },
        device: (this.config.device || 'auto') as any,
        dtype: (this.config.dtype || 'fp32') as any,
      })

      this.status = 'ready'
      this.setStatus('Detection ready')
    } catch (err) {
      this.status = 'error'
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown error loading detector'
      this.setStatus(`Failed to load detection model: ${errorMsg}`)
      throw err
    } finally {
      this.isLoading = false
    }
  }

  async detect(
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number,
  ): Promise<DetectionOutput> {
    if (!this.detector || this.status !== 'ready') {
      throw new Error('Detector not initialized')
    }

    const startTime = performance.now()

    // Run detection
    const detections: DetectionResult[] = await this.detector(canvas, {
      threshold: this.config.confidenceThreshold,
      percentage: true,
    })

    // Filter and convert to DetectedCard format
    const cards = this.filterCardDetections(
      detections,
      canvasWidth,
      canvasHeight,
    )

    const inferenceTimeMs = performance.now() - startTime

    return {
      cards,
      inferenceTimeMs,
      rawDetectionCount: detections.length,
    }
  }

  dispose(): void {
    this.detector = null
    this.status = 'uninitialized'
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private setStatus(msg: string) {
    this.config.onProgress?.(msg)
  }

  private boundingBoxToPolygon(
    box: { xmin: number; ymin: number; xmax: number; ymax: number },
    canvasWidth: number,
    canvasHeight: number,
  ): Point[] {
    const xmin = box.xmin * canvasWidth
    const ymin = box.ymin * canvasHeight
    const xmax = box.xmax * canvasWidth
    const ymax = box.ymax * canvasHeight

    return [
      { x: xmin, y: ymin }, // Top-left
      { x: xmax, y: ymin }, // Top-right
      { x: xmax, y: ymax }, // Bottom-right
      { x: xmin, y: ymax }, // Bottom-left
    ]
  }

  private filterCardDetections(
    detections: DetectionResult[],
    canvasWidth: number,
    canvasHeight: number,
  ): DetectedCard[] {
    return detections
      .filter((det) => {
        // Filter by confidence threshold
        if (det.score < this.config.confidenceThreshold) return false

        // REJECT known non-card objects by label
        const rejectLabels = [
          'person',
          'face',
          'head',
          'hand',
          'laptop',
          'tv',
          'monitor',
          'keyboard',
          'mouse',
        ]
        if (rejectLabels.includes(det.label.toLowerCase())) {
          return false
        }

        // Special handling for cell phone - only accept if portrait orientation
        if (det.label.toLowerCase() === 'cell phone') {
          return true
        }

        // Calculate dimensions
        const width = det.box.xmax - det.box.xmin
        const height = det.box.ymax - det.box.ymin
        const area = width * height

        // Filter by minimum area
        if (area < MIN_CARD_AREA) return false

        // Calculate aspect ratio
        const aspectRatio = width / height
        const minAR = MTG_CARD_ASPECT_RATIO * (1 - ASPECT_RATIO_TOLERANCE)
        const maxAR = MTG_CARD_ASPECT_RATIO * (1 + ASPECT_RATIO_TOLERANCE)

        // Accept if aspect ratio matches (portrait or landscape)
        if (aspectRatio >= minAR && aspectRatio <= maxAR) return true
        if (1 / aspectRatio >= minAR && 1 / aspectRatio <= maxAR) return true

        return false
      })
      .map((det) => ({
        box: det.box,
        score: det.score,
        aspectRatio:
          (det.box.xmax - det.box.xmin) / (det.box.ymax - det.box.ymin),
        polygon: this.boundingBoxToPolygon(det.box, canvasWidth, canvasHeight),
      }))
  }
}

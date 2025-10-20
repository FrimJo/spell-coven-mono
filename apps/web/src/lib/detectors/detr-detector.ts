/**
 * DETR-based card detector implementation
 *
 * Uses Transformers.js DETR model for object detection.
 * Accepts all detections - user clicks to select specific region.
 *
 * @module detectors/detr-detector
 */

import type { DetectedCard, DetectionResult, Point } from '@/types/card-query'
import { env, pipeline } from '@huggingface/transformers'

import type {
  CardDetector,
  DetectionOutput,
  DetectorConfig,
  DetectorStatus,
} from './types'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any --  Using any to avoid "union type too complex" error
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
        progress_callback: (progress) => {
          if (progress.status === 'progress') {
            const percent = Math.round(progress.progress || 0)
            this.setStatus(`Downloading: ${progress.file} - ${percent}%`)
          }
        },
        device: this.config.device ?? 'auto',
        dtype: this.config.dtype ?? 'fp32',
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

    // Run detection with very low threshold to see everything
    const detections: DetectionResult[] = await this.detector(canvas, {
      threshold: this.config.confidenceThreshold,
      percentage: true,
    })

    // Filter and convert to DetectedCard format
    const { cards } = this.filterCardDetections(
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
  ): { cards: DetectedCard[]; filterReasons: Record<string, string[]> } {
    const cards: DetectedCard[] = []
    const filterReasons: Record<string, string[]> = {}

    for (const detection of detections) {
      const { box, score } = detection

      // Filter by confidence
      if (score < 0.5) continue

      // Convert to DetectedCard
      const card: DetectedCard = {
        box,
        score,
        polygon: this.boundingBoxToPolygon(box, canvasWidth, canvasHeight),
      }

      cards.push(card)
    }

    return { cards, filterReasons }
  }
}

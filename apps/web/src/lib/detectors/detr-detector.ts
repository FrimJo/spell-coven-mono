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

    // Log the frame DETR is analyzing
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        console.log('[DETR] Frame being analyzed:', {
          url,
          dimensions: `${canvas.width}x${canvas.height}`,
          blob,
          message: 'Right-click the URL above and "Open in new tab" to see what DETR sees',
        })
      }
    }, 'image/png')

    // Run detection with very low threshold to see everything
    const detections: DetectionResult[] = await this.detector(canvas, {
      threshold: this.config.confidenceThreshold,
      percentage: true,
    })

    // Log all raw DETR detections for debugging
    console.log('[DETR] All raw detections (threshold=' + this.config.confidenceThreshold + '):', {
      count: detections.length,
      detections: detections
        .sort((a, b) => b.score - a.score) // Sort by confidence descending
        .map((det) => ({
          label: det.label,
          score: det.score.toFixed(3),
          box: {
            xmin: det.box.xmin.toFixed(3),
            ymin: det.box.ymin.toFixed(3),
            xmax: det.box.xmax.toFixed(3),
            ymax: det.box.ymax.toFixed(3),
          },
          width: ((det.box.xmax - det.box.xmin) * canvasWidth).toFixed(1),
          height: ((det.box.ymax - det.box.ymin) * canvasHeight).toFixed(1),
          aspectRatio: (
            (det.box.xmax - det.box.xmin) /
            (det.box.ymax - det.box.ymin)
          ).toFixed(2),
          centerX: (((det.box.xmin + det.box.xmax) / 2) * canvasWidth).toFixed(1),
          centerY: (((det.box.ymin + det.box.ymax) / 2) * canvasHeight).toFixed(1),
        })),
    })

    // Filter and convert to DetectedCard format
    const { cards, filterReasons } = this.filterCardDetections(
      detections,
      canvasWidth,
      canvasHeight,
    )

    console.log('[DETR] Filtered cards:', {
      count: cards.length,
      filtered: cards.map((card) => ({
        score: card.score.toFixed(3),
        aspectRatio: card.aspectRatio.toFixed(2),
      })),
    })

    // Log rejected detections
    if (Object.keys(filterReasons).length > 0) {
      console.log('[DETR] Rejected detections:', filterReasons)
    }

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
    const filterReasons: Record<string, string[]> = {}

    // Accept ALL detections - no filtering
    // User will click on the specific region they want to extract
    const cards = detections.map((det) => {
      // Log if this is a "cell phone" detection (DETR often classifies cards as phones)
      if (det.label.toLowerCase() === 'cell phone') {
        console.log('[DETR] Found "cell phone" detection (likely a card):', {
          score: det.score.toFixed(3),
          box: det.box,
          centerX: (((det.box.xmin + det.box.xmax) / 2) * canvasWidth).toFixed(1),
          centerY: (((det.box.ymin + det.box.ymax) / 2) * canvasHeight).toFixed(1),
        })
      }

      return {
        box: det.box,
        score: det.score,
        aspectRatio:
          (det.box.xmax - det.box.xmin) / (det.box.ymax - det.box.ymin),
        polygon: this.boundingBoxToPolygon(det.box, canvasWidth, canvasHeight),
      }
    })

    console.log('[DETR] Accepting all detections (no filtering):', {
      total: cards.length,
      cellPhones: detections.filter(d => d.label.toLowerCase() === 'cell phone').length,
    })

    return { cards, filterReasons }
  }
}

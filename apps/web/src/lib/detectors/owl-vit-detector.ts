/**
 * OWL-ViT-based card detector implementation
 *
 * Zero-shot object detection using text prompts.
 * Uses Transformers.js for browser-based inference.
 *
 * OWL-ViT advantages:
 * - Zero-shot detection with text prompts ("Magic: The Gathering card")
 * - Better at detecting specific object types
 * - Can be fine-tuned with custom prompts
 *
 * @module detectors/owl-vit-detector
 */

import type { DetectedCard, Point } from '@/types/card-query'
import { pipeline } from '@huggingface/transformers'

import type {
  CardDetector,
  DetectionOutput,
  DetectorConfig,
  DetectorStatus,
} from './types.js'

/**
 * OWL-ViT detector configuration
 */
export interface OWLViTConfig
  extends Omit<
    DetectorConfig,
    'modelId' | 'confidenceThreshold' | 'detectionIntervalMs'
  > {
  /** Text prompts for detection (e.g., ["Magic card", "trading card"]) */
  prompts?: string[]
  /** Model ID to use (default: 'Xenova/owlvit-base-patch32') */
  modelId?: string
  /** Confidence threshold (default: 0.15) */
  confidenceThreshold?: number
  /** Detection interval in milliseconds (default: 500) */
  detectionIntervalMs?: number
}

interface OWLViTDetection {
  score: number
  label: string
  box: {
    xmin: number
    ymin: number
    xmax: number
    ymax: number
  }
}

/**
 * OWL-ViT detector implementation
 */
export class OWLViTDetector implements CardDetector {
  private status: DetectorStatus = 'uninitialized'
  private config: OWLViTConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any --  Using any to avoid "union type too complex" error
  private detector: any = null

  constructor(config: OWLViTConfig = {}) {
    this.config = {
      modelId: 'Xenova/owlvit-base-patch32',
      prompts: ['a playing card', 'card'],
      confidenceThreshold: 0.05, // Lower threshold to catch more detections
      detectionIntervalMs: 500,
      ...config,
    }
  }

  getStatus(): DetectorStatus {
    return this.status
  }

  private setStatus(status: DetectorStatus, message?: string): void {
    this.status = status
    if (message) {
      // Message logging removed
    }
  }

  async initialize(): Promise<void> {
    try {
      this.setStatus('loading', 'Loading OWL-ViT model...')

      if (!this.config.modelId) {
        throw new Error('OWL-ViT detector: modelId is required in config')
      }
      // Load zero-shot object detection pipeline
      this.detector = await pipeline(
        'zero-shot-object-detection',
        this.config.modelId,
        {
          progress_callback: (progress) => {
            if (progress.status === 'progress') {
              // Progress logging removed
            }
          },
        },
      )

      this.setStatus('ready', 'OWL-ViT model loaded successfully')
    } catch (error) {
      this.setStatus('error', `Failed to load model: ${error}`)
      throw error
    }
  }

  async detect(
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number,
  ): Promise<DetectionOutput> {
    if (!this.detector || this.status !== 'ready') {
      throw new Error('OWL-ViT detector not initialized')
    }

    const startTime = performance.now()

    if (!this.config.prompts) {
      throw new Error('OWL-ViT detector: prompts are required in config')
    }
    // Run zero-shot detection with text prompts
    const inferenceStart = performance.now()
    const detections: OWLViTDetection[] = await this.detector(
      canvas,
      this.config.prompts,
      {
        threshold: this.config.confidenceThreshold,
        percentage: true, // Return coordinates as percentages
      },
    )
    const inferenceMs = performance.now() - inferenceStart

    // Filter and convert to DetectedCard format
    const filterStart = performance.now()
    const cards = this.filterAndConvert(detections, canvasWidth, canvasHeight)
    const filterMs = performance.now() - filterStart

    const totalMs = performance.now() - startTime

    console.log('[OWL-ViT] Detection timing:', {
      inference: `${inferenceMs.toFixed(0)}ms`,
      filter: `${filterMs.toFixed(0)}ms`,
      total: `${totalMs.toFixed(0)}ms`,
      rawDetectionCount: detections.length,
      filteredCardCount: cards.length,
    })

    // Log raw detections for debugging
    if (detections.length > 0) {
      console.log('[OWL-ViT] Raw detections (top 5):', detections.slice(0, 5))
      console.log(
        '[OWL-ViT] All detection scores:',
        detections.map((d) => ({ label: d.label, score: d.score })),
      )
    } else {
      console.warn('[OWL-ViT] ⚠️ No detections found!', {
        prompts: this.config.prompts,
        threshold: this.config.confidenceThreshold,
        model: this.config.modelId,
      })
      console.log(
        '[OWL-ViT] 💡 Tiny model may have accuracy issues. Consider using base model with fp16 for 20-30% speedup instead.',
      )
    }

    return {
      cards,
      inferenceTimeMs: totalMs,
      rawDetectionCount: detections.length,
    }
  }

  private filterAndConvert(
    detections: OWLViTDetection[],
    canvasWidth: number,
    canvasHeight: number,
  ): DetectedCard[] {
    const cards: DetectedCard[] = []

    for (const detection of detections) {
      const { box, score } = detection

      // Calculate aspect ratio
      const width = box.xmax - box.xmin
      const height = box.ymax - box.ymin
      const aspectRatio = width / height

      // Accept ALL detections - no filtering
      // User will click on the specific region they want to extract

      // Create polygon from bounding box
      const polygon: Point[] = [
        { x: box.xmin * canvasWidth, y: box.ymin * canvasHeight }, // Top-left
        { x: box.xmax * canvasWidth, y: box.ymin * canvasHeight }, // Top-right
        { x: box.xmax * canvasWidth, y: box.ymax * canvasHeight }, // Bottom-right
        { x: box.xmin * canvasWidth, y: box.ymax * canvasHeight }, // Bottom-left
      ]

      cards.push({
        box: {
          xmin: box.xmin,
          ymin: box.ymin,
          xmax: box.xmax,
          ymax: box.ymax,
        },
        score,
        aspectRatio,
        polygon,
      })
    }

    return cards
  }

  dispose(): void {
    this.detector = null
    this.status = 'uninitialized'
  }
}

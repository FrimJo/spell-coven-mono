/**
 * YOLOv8-based card detector implementation
 *
 * Uses YOLOv8 model (via ONNX Runtime) for fast and accurate card detection.
 * Specifically designed for playing card detection on various backgrounds.
 *
 * @module detectors/yolov8-detector
 */

import type { DetectedCard } from '@/types/card-query'
import * as ort from 'onnxruntime-web'

import type {
  CardDetector,
  DetectionOutput,
  DetectorConfig,
  DetectorStatus,
} from './types'

/**
 * YOLOv8 detector configuration
 */
export interface YOLOv8Config extends DetectorConfig {
  /** Path to ONNX model file */
  modelPath?: string
  /** Input size for model (default: 640) */
  inputSize?: number
  /** IoU threshold for NMS (default: 0.45) */
  iouThreshold?: number
  /** Score threshold for detections (default: 0.25) */
  scoreThreshold?: number
}

/**
 * YOLOv8 detector implementation
 */
export class YOLOv8Detector implements CardDetector {
  private status: DetectorStatus = 'uninitialized'
  private config: YOLOv8Config
  private session: ort.InferenceSession | null = null

  constructor(config: YOLOv8Config) {
    this.config = {
      modelPath: '/models/yolov8n-cards.onnx',
      inputSize: 640,
      iouThreshold: 0.45,
      scoreThreshold: 0.25,
      ...config,
    }
  }

  getStatus(): DetectorStatus {
    return this.status
  }

  async initialize(): Promise<void> {
    try {
      this.status = 'loading'
      console.log('[YOLOv8] Loading model from:', this.config.modelPath)

      // Load ONNX model
      this.session = await ort.InferenceSession.create(
        this.config.modelPath!,
        {
          executionProviders: ['wasm'],
        },
      )

      this.status = 'ready'
      console.log('[YOLOv8] Model loaded successfully')
    } catch (error) {
      this.status = 'error'
      console.error('[YOLOv8] Failed to load model:', error)
      throw error
    }
  }

  async detect(
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number,
  ): Promise<DetectionOutput> {
    if (this.status !== 'ready' || !this.session) {
      throw new Error('YOLOv8 detector not initialized')
    }

    const startTime = performance.now()

    try {
      // Prepare input
      const input = this.prepareInput(canvas)

      // Run inference
      const outputs = await this.session.run({
        images: input,
      })

      // Process output
      const rawOutput = outputs['output0'].data as Float32Array
      const cards = this.processOutput(
        rawOutput,
        canvasWidth,
        canvasHeight,
      )

      const inferenceTimeMs = performance.now() - startTime

      console.log('[YOLOv8] Detection complete:', {
        cards: cards.length,
        inferenceTimeMs: Math.round(inferenceTimeMs),
      })

      return {
        cards,
        inferenceTimeMs,
        rawDetectionCount: cards.length,
      }
    } catch (error) {
      console.error('[YOLOv8] Detection failed:', error)
      throw error
    }
  }

  /**
   * Prepare canvas input for YOLOv8 model
   * Resizes to 640x640 and converts to RGB float32 array
   */
  private prepareInput(sourceCanvas: HTMLCanvasElement): ort.Tensor {
    const inputSize = this.config.inputSize!

    // Create temporary canvas for resizing
    const canvas = document.createElement('canvas')
    canvas.width = inputSize
    canvas.height = inputSize
    const ctx = canvas.getContext('2d')!

    // Draw and resize image
    ctx.drawImage(sourceCanvas, 0, 0, inputSize, inputSize)

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, inputSize, inputSize)
    const { data } = imageData

    // Convert to RGB float32 array (normalized to 0-1)
    const red: number[] = []
    const green: number[] = []
    const blue: number[] = []

    for (let i = 0; i < data.length; i += 4) {
      red.push(data[i] / 255)
      green.push(data[i + 1] / 255)
      blue.push(data[i + 2] / 255)
    }

    // Concatenate RGB channels
    const input = Float32Array.from([...red, ...green, ...blue])

    // Create tensor with shape [1, 3, 640, 640]
    return new ort.Tensor('float32', input, [1, 3, inputSize, inputSize])
  }

  /**
   * Process YOLOv8 output to detected cards
   * Output format: [batch, 84, 8400] where 84 = 4 bbox coords + 80 class scores
   */
  private processOutput(
    output: Float32Array,
    canvasWidth: number,
    canvasHeight: number,
  ): DetectedCard[] {
    const inputSize = this.config.inputSize!
    const scoreThreshold = this.config.scoreThreshold!

    // YOLOv8 output shape: [1, 84, 8400]
    // 84 = [x, y, w, h, ...80 class scores]
    const numDetections = 8400
    const numClasses = 80

    const detections: Array<{
      box: { xmin: number; ymin: number; xmax: number; ymax: number }
      score: number
      classId: number
    }> = []

    // Parse detections
    for (let i = 0; i < numDetections; i++) {
      // Get bbox coordinates
      const x = output[i]
      const y = output[numDetections + i]
      const w = output[2 * numDetections + i]
      const h = output[3 * numDetections + i]

      // Get class scores (skip first 4 bbox values)
      let maxScore = 0
      let maxClassId = 0

      for (let c = 0; c < numClasses; c++) {
        const score = output[(4 + c) * numDetections + i]
        if (score > maxScore) {
          maxScore = score
          maxClassId = c
        }
      }

      // Filter by score threshold
      if (maxScore < scoreThreshold) {
        continue
      }

      // Convert from center format to corner format
      // Scale from 640x640 to canvas size
      const scaleX = canvasWidth / inputSize
      const scaleY = canvasHeight / inputSize

      const xmin = ((x - w / 2) * scaleX) / canvasWidth
      const ymin = ((y - h / 2) * scaleY) / canvasHeight
      const xmax = ((x + w / 2) * scaleX) / canvasWidth
      const ymax = ((y + h / 2) * scaleY) / canvasHeight

      detections.push({
        box: { xmin, ymin, xmax, ymax },
        score: maxScore,
        classId: maxClassId,
      })
    }

    // Apply NMS
    const nmsDetections = this.applyNMS(detections)

    // Convert to DetectedCard format
    return nmsDetections.map((det) => ({
      box: det.box,
      score: det.score,
      polygon: [
        { x: det.box.xmin, y: det.box.ymin },
        { x: det.box.xmax, y: det.box.ymin },
        { x: det.box.xmax, y: det.box.ymax },
        { x: det.box.xmin, y: det.box.ymax },
      ],
    }))
  }

  /**
   * Apply Non-Maximum Suppression to remove overlapping detections
   */
  private applyNMS(
    detections: Array<{
      box: { xmin: number; ymin: number; xmax: number; ymax: number }
      score: number
      classId: number
    }>,
  ): Array<{
    box: { xmin: number; ymin: number; xmax: number; ymax: number }
    score: number
    classId: number
  }> {
    const iouThreshold = this.config.iouThreshold!

    // Sort by score descending
    detections.sort((a, b) => b.score - a.score)

    const keep: typeof detections = []

    while (detections.length > 0) {
      const current = detections.shift()!
      keep.push(current)

      // Remove detections with high IoU
      detections = detections.filter((det) => {
        const iou = this.calculateIoU(current.box, det.box)
        return iou < iouThreshold
      })
    }

    return keep
  }

  /**
   * Calculate Intersection over Union between two boxes
   */
  private calculateIoU(
    box1: { xmin: number; ymin: number; xmax: number; ymax: number },
    box2: { xmin: number; ymin: number; xmax: number; ymax: number },
  ): number {
    const xmin = Math.max(box1.xmin, box2.xmin)
    const ymin = Math.max(box1.ymin, box2.ymin)
    const xmax = Math.min(box1.xmax, box2.xmax)
    const ymax = Math.min(box1.ymax, box2.ymax)

    const intersection = Math.max(0, xmax - xmin) * Math.max(0, ymax - ymin)

    const area1 = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin)
    const area2 = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin)

    const union = area1 + area2 - intersection

    return intersection / union
  }

  dispose(): void {
    this.session = null
    this.status = 'uninitialized'
  }
}

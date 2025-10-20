/**
 * Detector factory for creating card detection instances
 *
 * Provides a centralized way to create and configure different
 * detector implementations (DETR, OWL-ViT, etc.)
 *
 * @module detectors/factory
 */

import type { CardDetector, DetectorConfig, DetectorType } from './types'
import {
  CONFIDENCE_THRESHOLD,
  DETECTION_INTERVAL_MS,
  DETR_MODEL_ID,
} from '../detection-constants'
import { DETRDetector } from './detr-detector'
import { OpenCVDetector } from './opencv-detector'
import { OWLViTDetector } from './owl-vit-detector'
import { SlimSAMDetector } from './slimsam-detector'
import { YOLOv8Detector } from './yolov8-detector'

/**
 * Default configurations for each detector type
 */
const DEFAULT_CONFIGS: Record<DetectorType, Partial<DetectorConfig>> = {
  opencv: {
    modelId: '', // OpenCV doesn't use a model
    confidenceThreshold: 0, // OpenCV doesn't use confidence
    detectionIntervalMs: DETECTION_INTERVAL_MS,
    // OpenCV is now click-only mode - no continuous detection
  },
  detr: {
    modelId: DETR_MODEL_ID,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    detectionIntervalMs: DETECTION_INTERVAL_MS,
    device: 'auto',
    dtype: 'fp32',
  },
  'owl-vit': {
    modelId: 'Xenova/owlvit-base-patch32',
    confidenceThreshold: 0.01, // Extremely low threshold to catch all possible detections
    detectionIntervalMs: DETECTION_INTERVAL_MS,
    device: 'auto',
    dtype: 'fp16',
  },
  slimsam: {
    modelId: 'Xenova/slimsam-77-uniform',
    confidenceThreshold: 0.5,
    detectionIntervalMs: DETECTION_INTERVAL_MS,
    device: 'auto',
    dtype: 'fp16',
  },
  yolov8: {
    modelId: '/models/yolov8n-cards.onnx',
    confidenceThreshold: 0.25,
    detectionIntervalMs: DETECTION_INTERVAL_MS,
  },
}

/**
 * Create a card detector instance
 *
 * @param type Type of detector to create
 * @param config Optional configuration overrides
 * @returns Configured detector instance
 *
 * @example
 * ```ts
 * // Create DETR detector with defaults
 * const detector = createDetector('detr')
 *
 * // Create DETR detector with custom config
 * const detector = createDetector('detr', {
 *   confidenceThreshold: 0.6,
 * })
 *
 * // Create OWL-ViT detector (when implemented)
 * const detector = createDetector('owl-vit', {
 *   prompts: ['Magic card', 'trading card']
 * })
 * ```
 */
export function createDetector(
  type: DetectorType,
  config?: Partial<DetectorConfig>,
): CardDetector {
  // Merge default config with user overrides
  const defaultConfig = DEFAULT_CONFIGS[type]
  const finalConfig: DetectorConfig = {
    modelId: config?.modelId || defaultConfig.modelId || '',
    confidenceThreshold:
      config?.confidenceThreshold ?? defaultConfig.confidenceThreshold ?? 0.5,
    detectionIntervalMs:
      config?.detectionIntervalMs ?? defaultConfig.detectionIntervalMs ?? 500,
    onProgress: config?.onProgress,
    device: config?.device || defaultConfig.device,
    dtype: config?.dtype || defaultConfig.dtype,
  }

  // Create detector instance based on type
  switch (type) {
    case 'opencv':
      // OpenCV is click-only mode - returns empty detections for continuous detection
      return new OpenCVDetector(finalConfig)

    case 'detr':
      return new DETRDetector(finalConfig)

    case 'owl-vit':
      // OWL-ViT needs special handling for prompts
      // Try simple, generic prompts that might match better
      return new OWLViTDetector({
        ...finalConfig,
      })

    case 'slimsam':
      return new SlimSAMDetector(finalConfig)

    case 'yolov8':
      return new YOLOv8Detector(finalConfig)

    default:
      throw new Error(`Unknown detector type: ${type}`)
  }
}

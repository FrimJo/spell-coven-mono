/**
 * Detector factory for creating card detection instances
 * 
 * Provides a centralized way to create and configure different
 * detector implementations (DETR, OWL-ViT, etc.)
 * 
 * @module detectors/factory
 */

import { DETR_MODEL_ID, CONFIDENCE_THRESHOLD, DETECTION_INTERVAL_MS } from '../detection-constants'
import { ACTIVE_DETECTOR } from '../detector-config'
import { OpenCVDetector } from './opencv-detector'
import { DETRDetector } from './detr-detector'
import { OWLViTDetector } from './owl-vit-detector'
import type { CardDetector, DetectorType, DetectorConfig } from './types'

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
    confidenceThreshold: 0.3, // OWL-ViT typically needs lower threshold
    detectionIntervalMs: DETECTION_INTERVAL_MS,
    device: 'auto',
    dtype: 'fp32',
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
 *   onProgress: (msg) => console.log(msg)
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
  config?: Partial<DetectorConfig>
): CardDetector {
  // Merge default config with user overrides
  const defaultConfig = DEFAULT_CONFIGS[type]
  const finalConfig: DetectorConfig = {
    modelId: config?.modelId || defaultConfig.modelId || '',
    confidenceThreshold: config?.confidenceThreshold ?? defaultConfig.confidenceThreshold ?? 0.5,
    detectionIntervalMs: config?.detectionIntervalMs ?? defaultConfig.detectionIntervalMs ?? 500,
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
      return new OWLViTDetector(finalConfig)
    
    default:
      throw new Error(`Unknown detector type: ${type}`)
  }
}

/**
 * Get the current default detector type
 * 
 * This can be changed in detector-config.ts to switch the default detector.
 */
export function getDefaultDetectorType(): DetectorType {
  return ACTIVE_DETECTOR
}

/**
 * Create a detector with default settings
 * 
 * @param onProgress Optional progress callback
 * @returns Detector instance with default configuration
 */
export function createDefaultDetector(
  onProgress?: (msg: string) => void
): CardDetector {
  const type = getDefaultDetectorType()
  return createDetector(type, { onProgress })
}

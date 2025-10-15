/**
 * Detector configuration
 * 
 * Central place to configure which detector to use.
 * Change ACTIVE_DETECTOR to switch between detection models.
 * 
 * @module detector-config
 */

import type { DetectorType } from './detectors'

/**
 * Active detector type
 * 
 * Change this value to switch between detectors:
 * - 'opencv': OpenCV edge detection (fast, no model download, lighting-sensitive)
 * - 'detr': DETR ResNet-50 (current default, ML-based, robust)
 * - 'owl-vit': OWL-ViT zero-shot detector (not yet implemented)
 */
export const ACTIVE_DETECTOR: DetectorType = 'detr'

/**
 * Detector-specific configuration overrides
 * 
 * Customize settings for each detector type.
 * These override the default values from the factory.
 */
export const DETECTOR_OVERRIDES = {
  opencv: {
    // Uncomment to customize OpenCV settings
    // minCardArea: 4000,
    // cannyLowThreshold: 75,
    // cannyHighThreshold: 200,
  },
  detr: {
    // Uncomment to customize DETR settings
    // confidenceThreshold: 0.6,
    // device: 'webgpu',
  },
  'owl-vit': {
    // Uncomment to customize OWL-ViT settings
    // confidenceThreshold: 0.3,
    // prompts: ['Magic: The Gathering card', 'trading card'],
  },
} as const

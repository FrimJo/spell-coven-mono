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

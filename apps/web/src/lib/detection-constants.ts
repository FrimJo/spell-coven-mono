/**
 * Detection constants for DETR-based card detection
 *
 * These constants configure the DETR object detection system for
 * MTG card recognition in webcam streams.
 *
 * @module detection-constants
 */

/**
 * DETR model identifier from Hugging Face
 */
export const DETR_MODEL_ID = 'Xenova/detr-resnet-50'

/**
 * Minimum confidence threshold for DETR detections
 * Detections below this score are filtered out
 */
export const CONFIDENCE_THRESHOLD = 0.5

/**
 * MTG card aspect ratio (width/height)
 * Standard MTG card dimensions: 63mm x 88mm (2.5" x 3.5")
 */
export const MTG_CARD_ASPECT_RATIO = 63 / 88 // ≈ 0.716

/**
 * Tolerance for aspect ratio matching (±15%)
 * Allows for perspective distortion when cards are at angles
 * Tighter tolerance to exclude faces (AR ~0.82)
 */
export const ASPECT_RATIO_TOLERANCE = 0.15

/**
 * Detection inference interval (milliseconds)
 * Set to 500ms (2 FPS detection) - video stream runs independently at 30 FPS
 */
export const DETECTION_INTERVAL_MS = 500

/**
 * Minimum card area (percentage of frame)
 * Filters out very small detections that are likely noise
 */
export const MIN_CARD_AREA = 0.01 // 1% of frame

/**
 * Cropped card dimensions (pixels) - Must match CLIP model expectations
 * These dimensions are required by the card identification pipeline
 */
export const CROPPED_CARD_WIDTH = 446
export const CROPPED_CARD_HEIGHT = 620

/**
 * Computed aspect ratio range for validation
 */
export const MIN_ASPECT_RATIO =
  MTG_CARD_ASPECT_RATIO * (1 - ASPECT_RATIO_TOLERANCE) // 0.573
export const MAX_ASPECT_RATIO =
  MTG_CARD_ASPECT_RATIO * (1 + ASPECT_RATIO_TOLERANCE) // 0.859

/**
 * Validates if an aspect ratio matches MTG card proportions
 */
export function isValidCardAspectRatio(aspectRatio: number): boolean {
  return aspectRatio >= MIN_ASPECT_RATIO && aspectRatio <= MAX_ASPECT_RATIO
}

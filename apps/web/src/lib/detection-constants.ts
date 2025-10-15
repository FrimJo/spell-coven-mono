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
 * Tolerance for aspect ratio matching (±20%)
 * Allows for perspective distortion when cards are at angles
 */
export const ASPECT_RATIO_TOLERANCE = 0.2

/**
 * Detection inference interval (milliseconds)
 * DETR runs at 2 FPS (every 500ms) to balance responsiveness and performance
 */
export const DETECTION_INTERVAL_MS = 500

/**
 * Minimum card area (percentage of frame)
 * Filters out very small detections that are likely noise
 */
export const MIN_CARD_AREA = 0.01 // 1% of frame

/**
 * Cropped card dimensions (pixels)
 * Output size for perspective-corrected card images
 * These dimensions maintain MTG card aspect ratio for CLIP identification
 */
export const CROPPED_CARD_WIDTH = 315
export const CROPPED_CARD_HEIGHT = 440

/**
 * Computed aspect ratio range for validation
 */
export const MIN_ASPECT_RATIO = MTG_CARD_ASPECT_RATIO * (1 - ASPECT_RATIO_TOLERANCE) // 0.573
export const MAX_ASPECT_RATIO = MTG_CARD_ASPECT_RATIO * (1 + ASPECT_RATIO_TOLERANCE) // 0.859

/**
 * Validates if an aspect ratio matches MTG card proportions
 */
export function isValidCardAspectRatio(aspectRatio: number): boolean {
  return aspectRatio >= MIN_ASPECT_RATIO && aspectRatio <= MAX_ASPECT_RATIO
}

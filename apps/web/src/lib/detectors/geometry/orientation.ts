/**
 * Card orientation detection and correction
 *
 * MTG cards can be detected in any of 4 orientations (0°, 90°, 180°, 270°).
 * This module provides utilities to:
 * - Detect card orientation
 * - Rotate cards to upright position
 * - Generate multiple orientation candidates for search
 *
 * @module detectors/geometry/orientation
 */

/**
 * Rotate a canvas by 90-degree increments
 *
 * @param sourceCanvas - Source canvas to rotate
 * @param rotations - Number of 90° clockwise rotations (0-3)
 * @returns New canvas with rotated image
 */
export function rotateCanvas90(
  sourceCanvas: HTMLCanvasElement,
  rotations: number,
): HTMLCanvasElement {
  const normalized = ((rotations % 4) + 4) % 4 // Normalize to 0-3

  if (normalized === 0) {
    // No rotation needed, return copy
    const canvas = document.createElement('canvas')
    canvas.width = sourceCanvas.width
    canvas.height = sourceCanvas.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      throw new Error('rotateCanvas90: Failed to get 2d context from canvas')
    }
    ctx.drawImage(sourceCanvas, 0, 0)
    return canvas
  }

  // For 90° and 270° rotations, swap width/height
  const swapDimensions = normalized === 1 || normalized === 3
  const width = swapDimensions ? sourceCanvas.height : sourceCanvas.width
  const height = swapDimensions ? sourceCanvas.width : sourceCanvas.height

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('rotateCanvas90: Failed to get 2d context from canvas')
  }

  // Move to center, rotate, move back
  ctx.translate(width / 2, height / 2)
  ctx.rotate((normalized * Math.PI) / 2)
  ctx.translate(-sourceCanvas.width / 2, -sourceCanvas.height / 2)
  ctx.drawImage(sourceCanvas, 0, 0)

  return canvas
}

/**
 * Generate all 4 possible orientations of a card
 *
 * Useful for embedding search when card orientation is unknown.
 * Returns array of [0°, 90°, 180°, 270°] rotations.
 *
 * @param sourceCanvas - Source canvas to rotate
 * @returns Array of 4 canvases, one for each orientation
 */
export function generateOrientationCandidates(
  sourceCanvas: HTMLCanvasElement,
): HTMLCanvasElement[] {
  return [
    rotateCanvas90(sourceCanvas, 0), // 0° (original)
    rotateCanvas90(sourceCanvas, 1), // 90° clockwise
    rotateCanvas90(sourceCanvas, 2), // 180°
    rotateCanvas90(sourceCanvas, 3), // 270° clockwise (90° counter-clockwise)
  ]
}

/**
 * Detect card orientation using aspect ratio heuristic
 *
 * MTG cards have aspect ratio ~0.716 (63mm / 88mm).
 * If width > height, card is likely rotated 90° or 270°.
 *
 * This is a simple heuristic - for better accuracy, use embedding search
 * with all 4 orientations and pick the best match.
 *
 * @param canvas - Canvas containing the card
 * @returns Estimated number of 90° clockwise rotations needed to make upright (0-3)
 */
export function detectCardOrientation(canvas: HTMLCanvasElement): number {
  const aspectRatio = canvas.width / canvas.height
  const MTG_ASPECT_RATIO = 63 / 88 // ~0.716

  // If aspect ratio is close to MTG ratio, assume upright
  if (Math.abs(aspectRatio - MTG_ASPECT_RATIO) < 0.2) {
    return 0 // Already upright
  }

  // If width > height (landscape), card is rotated 90° or 270°
  // We can't distinguish between these without content analysis
  // Return 1 (90° clockwise) as default
  if (aspectRatio > 1) {
    return 1 // Rotate 90° clockwise to make portrait
  }

  // If very tall (height >> width), might be upside down
  if (aspectRatio < 0.5) {
    return 2 // Rotate 180°
  }

  return 0 // Default to no rotation
}

/**
 * Ensure card is in portrait orientation (height > width)
 *
 * Simple utility to rotate landscape cards to portrait.
 * Does not detect if card is upside down.
 *
 * @param sourceCanvas - Source canvas
 * @returns Canvas in portrait orientation
 */
export function ensurePortraitOrientation(
  sourceCanvas: HTMLCanvasElement,
): HTMLCanvasElement {
  if (sourceCanvas.width > sourceCanvas.height) {
    // Landscape - rotate 90° clockwise
    return rotateCanvas90(sourceCanvas, 1)
  }
  return sourceCanvas
}

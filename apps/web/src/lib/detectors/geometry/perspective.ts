/**
 * Perspective transformation utilities
 *
 * Functions for correcting perspective distortion:
 * - Homography matrix computation
 * - Perspective warping to canonical rectangle
 *
 * @module detectors/geometry/perspective
 */

import type { CardQuad } from '../types.js'
import { loadOpenCV } from '../../opencv-loader.js'
import { CANONICAL_CARD_SIZE } from '../types.js'

/**
 * Compute homography matrix from source quad to destination rectangle
 *
 * @param sourceQuad - Detected card corners in source image
 * @param destWidth - Destination width (default: 384)
 * @param destHeight - Destination height (default: 384)
 * @returns Homography matrix (3×3) as Float32Array
 */
export async function computeHomography(
  sourceQuad: CardQuad,
  destWidth: number = CANONICAL_CARD_SIZE.width,
  destHeight: number = CANONICAL_CARD_SIZE.height,
): Promise<Float32Array> {
  const cv = await loadOpenCV()

  // Define source points (detected quad corners)
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    sourceQuad.topLeft.x,
    sourceQuad.topLeft.y,
    sourceQuad.topRight.x,
    sourceQuad.topRight.y,
    sourceQuad.bottomRight.x,
    sourceQuad.bottomRight.y,
    sourceQuad.bottomLeft.x,
    sourceQuad.bottomLeft.y,
  ])

  // Define destination points (canonical rectangle)
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0, // top-left
    destWidth,
    0, // top-right
    destWidth,
    destHeight, // bottom-right
    0,
    destHeight, // bottom-left
  ])

  try {
    // Compute perspective transform matrix
    const M = cv.getPerspectiveTransform(srcPoints, dstPoints)

    // Extract matrix data
    const matrixData = new Float32Array(9)
    for (let i = 0; i < 9; i++) {
      matrixData[i] = M.data64F[i]!
    }

    // Cleanup
    M.delete()

    return matrixData
  } finally {
    srcPoints.delete()
    dstPoints.delete()
  }
}

/**
 * Apply perspective warp to produce canonical card image with proper aspect ratio
 *
 * Matches Python preprocessing:
 * 1. Warp card to maintain MTG aspect ratio (63:88)
 * 2. Pad to square with black borders
 * 3. Resize to target size (336×336)
 *
 * @param sourceCanvas - Source canvas containing the card
 * @param quad - Detected card corners
 * @param targetSize - Final square output size (default: 336)
 * @returns Canvas with warped and padded card image
 */
export async function warpPerspective(
  sourceCanvas: HTMLCanvasElement,
  quad: CardQuad,
  targetSize: number = CANONICAL_CARD_SIZE.width,
): Promise<HTMLCanvasElement> {
  const cv = await loadOpenCV()

  // MTG card aspect ratio: 63mm × 88mm (width:height)
  const MTG_ASPECT_RATIO = 63 / 88 // ≈ 0.716

  // Calculate card dimensions that fill the target size while maintaining aspect ratio
  // The card should fill the height, with padding on the sides
  const cardHeight = targetSize
  const cardWidth = Math.round(cardHeight * MTG_ASPECT_RATIO)

  // Compute homography matrix for the card dimensions
  const matrixData = await computeHomography(quad, cardWidth, cardHeight)

  // Create transformation matrix
  const M = cv.matFromArray(3, 3, cv.CV_64F, Array.from(matrixData))

  // Read source image
  const src = cv.imread(sourceCanvas)
  const warped = new cv.Mat()
  const warpSize = new cv.Size(cardWidth, cardHeight)

  try {
    // Apply perspective transformation to get card with correct aspect ratio
    // The homography maps the quad corners to (0,0), (width,0), (width,height), (0,height)
    // This should make the card fill the entire output canvas
    cv.warpPerspective(
      src,
      warped,
      M,
      warpSize,
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(0, 0, 0, 255),
    )

    // Create square canvas with black background (matching Python preprocessing)
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = targetSize
    outputCanvas.height = targetSize
    const ctx = outputCanvas.getContext('2d')!

    // Fill with black
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, targetSize, targetSize)

    // Create temporary canvas for the warped card
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = cardWidth
    tempCanvas.height = cardHeight
    cv.imshow(tempCanvas, warped)

    // Log the perspective-warped card (before padding to square)
    // Warped card output ready

    // Center the card in the square canvas
    const pasteX = Math.floor((targetSize - cardWidth) / 2)
    const pasteY = Math.floor((targetSize - cardHeight) / 2)
    ctx.drawImage(tempCanvas, pasteX, pasteY)

    return outputCanvas
  } finally {
    // Cleanup
    M.delete()
    src.delete()
    warped.delete()
  }
}

/**
 * Quick perspective warp without separate homography computation
 *
 * Convenience function that combines homography computation and warping
 *
 * @param sourceCanvas - Source canvas containing the card
 * @param quad - Detected card corners
 * @returns Canvas with warped card (aspect ratio preserved) padded to 336×336 square
 */
export async function warpCardToCanonical(
  sourceCanvas: HTMLCanvasElement,
  quad: CardQuad,
): Promise<HTMLCanvasElement> {
  return warpPerspective(sourceCanvas, quad, CANONICAL_CARD_SIZE.width)
}

/**
 * Validate homography matrix
 *
 * Checks if the matrix is invertible (determinant ≠ 0)
 *
 * @param matrix - 3×3 homography matrix as Float32Array (9 elements)
 * @returns true if matrix is valid
 */
export function isValidHomography(matrix: Float32Array): boolean {
  if (matrix.length !== 9) {
    return false
  }

  // Check all elements are finite
  for (let i = 0; i < 9; i++) {
    const val = matrix[i]
    if (val === undefined || !isFinite(val)) {
      return false
    }
  }

  // Calculate determinant of 3×3 matrix
  // | a b c |
  // | d e f |
  // | g h i |
  // det = a(ei - fh) - b(di - fg) + c(dh - eg)

  const [a, b, c, d, e, f, g, h, i] = matrix

  if (
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    e === undefined ||
    f === undefined ||
    g === undefined ||
    h === undefined ||
    i === undefined
  ) {
    return false
  }

  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)

  // Matrix is invertible if determinant is non-zero
  // Use small epsilon for floating point comparison
  return Math.abs(det) > 1e-10
}

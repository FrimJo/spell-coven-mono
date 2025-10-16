/**
 * Perspective transformation utilities
 *
 * Functions for correcting perspective distortion:
 * - Homography matrix computation
 * - Perspective warping to canonical rectangle
 *
 * @module detectors/geometry/perspective
 */

import type { CardQuad } from '../types'
import { loadOpenCV } from '../../opencv-loader'
import { CANONICAL_CARD_SIZE } from '../types'

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
      matrixData[i] = M.data64F[i]
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
 * Apply perspective warp to produce canonical 384×384 card image
 *
 * @param sourceCanvas - Source canvas containing the card
 * @param quad - Detected card corners
 * @param destWidth - Output width (default: 384)
 * @param destHeight - Output height (default: 384)
 * @returns Canvas with warped card image
 */
export async function warpPerspective(
  sourceCanvas: HTMLCanvasElement,
  quad: CardQuad,
  destWidth: number = CANONICAL_CARD_SIZE.width,
  destHeight: number = CANONICAL_CARD_SIZE.height,
): Promise<HTMLCanvasElement> {
  const cv = await loadOpenCV()

  // Compute homography matrix
  const matrixData = await computeHomography(quad, destWidth, destHeight)

  // Create transformation matrix
  const M = cv.matFromArray(3, 3, cv.CV_64F, Array.from(matrixData))

  // Read source image
  const src = cv.imread(sourceCanvas)
  const dst = new cv.Mat()
  const dsize = new cv.Size(destWidth, destHeight)

  try {
    // Apply perspective transformation
    cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT)

    // Create output canvas
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = destWidth
    outputCanvas.height = destHeight

    // Write result to canvas
    cv.imshow(outputCanvas, dst)

    console.log(
      `[Perspective] Warped card to ${destWidth}×${destHeight} canonical view`,
    )

    return outputCanvas
  } finally {
    // Cleanup
    M.delete()
    src.delete()
    dst.delete()
  }
}

/**
 * Quick perspective warp without separate homography computation
 *
 * Convenience function that combines homography computation and warping
 *
 * @param sourceCanvas - Source canvas containing the card
 * @param quad - Detected card corners
 * @returns Canvas with warped 384×384 card image
 */
export async function warpCardToCanonical(
  sourceCanvas: HTMLCanvasElement,
  quad: CardQuad,
): Promise<HTMLCanvasElement> {
  return warpPerspective(
    sourceCanvas,
    quad,
    CANONICAL_CARD_SIZE.width,
    CANONICAL_CARD_SIZE.height,
  )
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
    if (!isFinite(matrix[i])) {
      return false
    }
  }

  // Calculate determinant of 3×3 matrix
  // | a b c |
  // | d e f |
  // | g h i |
  // det = a(ei - fh) - b(di - fg) + c(dh - eg)

  const [a, b, c, d, e, f, g, h, i] = matrix

  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)

  // Matrix is invertible if determinant is non-zero
  // Use small epsilon for floating point comparison
  return Math.abs(det) > 1e-10
}

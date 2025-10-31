/**
 * Sharpness calculation utilities
 *
 * Functions for measuring image sharpness using Laplacian variance.
 * Higher variance indicates sharper edges and better image quality.
 *
 * @module detectors/geometry/sharpness
 */

import { loadOpenCV } from '../../opencv-loader.js'

/**
 * Calculate sharpness score using Laplacian variance
 *
 * The Laplacian operator detects edges by computing second derivatives.
 * Variance of the Laplacian response indicates edge strength:
 * - High variance = sharp edges = good focus
 * - Low variance = blurry edges = poor focus
 *
 * This is a fast and reliable metric for real-time sharpness assessment.
 * Typical computation time: 5-10ms for 720p frame
 *
 * @param canvas - Canvas containing the image to analyze
 * @returns Sharpness score (higher = sharper)
 */
export async function calculateSharpness(
  canvas: HTMLCanvasElement,
): Promise<number> {
  const cv = await loadOpenCV()

  // Read image from canvas
  const src = cv.imread(canvas)
  const gray = new cv.Mat()
  const laplacian = new cv.Mat()

  try {
    // Convert to grayscale for faster processing
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // Apply Laplacian operator
    // ksize=1 uses 3x3 Sobel kernels (fastest)
    cv.Laplacian(gray, laplacian, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT)

    // Calculate variance of Laplacian
    const mean = new cv.Mat()
    const stddev = new cv.Mat()
    cv.meanStdDev(laplacian, mean, stddev)

    // Variance = stddev^2
    const variance = Math.pow(stddev.data64F[0], 2)

    // Cleanup
    mean.delete()
    stddev.delete()

    return variance
  } finally {
    // Cleanup
    src.delete()
    gray.delete()
    laplacian.delete()
  }
}

/**
 * Calculate sharpness for a region of interest
 *
 * @param canvas - Canvas containing the image
 * @param x - ROI top-left X coordinate
 * @param y - ROI top-left Y coordinate
 * @param width - ROI width
 * @param height - ROI height
 * @returns Sharpness score for the ROI
 */
export async function calculateSharpnessROI(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<number> {
  const cv = await loadOpenCV()

  // Read full image
  const src = cv.imread(canvas)

  try {
    // Extract ROI
    const rect = new cv.Rect(x, y, width, height)
    const roi = src.roi(rect)

    // Create temporary canvas for ROI
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    cv.imshow(tempCanvas, roi)

    // Calculate sharpness on ROI
    const sharpness = await calculateSharpness(tempCanvas)

    // Cleanup
    roi.delete()

    return sharpness
  } finally {
    src.delete()
  }
}

/**
 * Compare sharpness of two images
 *
 * @param canvas1 - First canvas
 * @param canvas2 - Second canvas
 * @returns Positive if canvas1 is sharper, negative if canvas2 is sharper, 0 if equal
 */
export async function compareSharpness(
  canvas1: HTMLCanvasElement,
  canvas2: HTMLCanvasElement,
): Promise<number> {
  const [sharpness1, sharpness2] = await Promise.all([
    calculateSharpness(canvas1),
    calculateSharpness(canvas2),
  ])

  return sharpness1 - sharpness2
}

/**
 * Check if an image meets minimum sharpness threshold
 *
 * @param canvas - Canvas to check
 * @param threshold - Minimum sharpness score (default: 100)
 * @returns true if image is sharp enough
 */
export async function isSharpEnough(
  canvas: HTMLCanvasElement,
  threshold: number = 100,
): Promise<boolean> {
  const sharpness = await calculateSharpness(canvas)
  return sharpness >= threshold
}

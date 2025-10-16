/**
 * Contour detection and polygon approximation
 *
 * Functions for extracting card quadrilaterals from binary masks:
 * - Contour detection using OpenCV.js
 * - Polygon approximation to quadrilateral
 * - Corner point ordering
 *
 * @module detectors/geometry/contours
 */

import type { CardQuad, Point } from '../types'
import { loadOpenCV } from '../../opencv-loader'

/**
 * Extract contours from a binary mask
 *
 * @param mask - OpenCV Mat containing binary mask (0 or 255)
 * @returns Array of contours (each contour is an array of points)
 */
export async function maskToContours(mask: any): Promise<any[]> {
  const cv = await loadOpenCV()

  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    // Find external contours with simple approximation
    cv.findContours(
      mask,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    )

    // Convert to array
    const result: any[] = []
    for (let i = 0; i < contours.size(); i++) {
      result.push(contours.get(i))
    }

    return result
  } finally {
    // Cleanup
    hierarchy.delete()
    // Note: Don't delete individual contours yet, caller needs them
  }
}

/**
 * Find the largest contour by area
 *
 * @param contours - Array of OpenCV contours
 * @returns Largest contour or null if array is empty
 */
export async function findLargestContour(contours: any[]): Promise<any | null> {
  if (contours.length === 0) {
    return null
  }

  const cv = await loadOpenCV()

  let maxArea = 0
  let largestContour: any | null = null

  for (const contour of contours) {
    const area = cv.contourArea(contour)
    if (area > maxArea) {
      maxArea = area
      largestContour = contour
    }
  }

  return largestContour
}

/**
 * Approximate a contour to a quadrilateral using Douglas-Peucker algorithm
 *
 * @param contour - OpenCV contour to approximate
 * @param epsilon - Approximation accuracy (default: 2% of perimeter)
 * @returns Approximated polygon or null if not a quadrilateral
 */
export async function approximateToQuad(
  contour: any,
  epsilon: number = 0.02,
): Promise<Point[] | null> {
  const cv = await loadOpenCV()

  // Calculate perimeter
  const perimeter = cv.arcLength(contour, true)

  // Approximate polygon
  const approx = new cv.Mat()
  const epsilonValue = epsilon * perimeter

  try {
    cv.approxPolyDP(contour, approx, epsilonValue, true)

    // Check if we got a quadrilateral (4 points)
    if (approx.rows !== 4) {
      console.warn(
        `[Contours] Polygon approximation resulted in ${approx.rows} points, expected 4`,
      )
      return null
    }

    // Extract points
    const points: Point[] = []
    for (let i = 0; i < 4; i++) {
      points.push({
        x: approx.data32S[i * 2],
        y: approx.data32S[i * 2 + 1],
      })
    }

    return points
  } finally {
    approx.delete()
  }
}

/**
 * Order quad points in consistent order: top-left, top-right, bottom-right, bottom-left
 *
 * Algorithm:
 * 1. Find centroid of the 4 points
 * 2. Sort by angle from centroid
 * 3. Identify top-left as the point with smallest x+y sum
 * 4. Order remaining points clockwise
 *
 * @param points - Array of 4 corner points (any order)
 * @returns Ordered CardQuad
 */
export function orderQuadPoints(points: Point[]): CardQuad {
  if (points.length !== 4) {
    throw new Error(`Expected 4 points, got ${points.length}`)
  }

  // Calculate centroid
  const centroid = {
    x: points.reduce((sum, p) => sum + p.x, 0) / 4,
    y: points.reduce((sum, p) => sum + p.y, 0) / 4,
  }

  // Sort points by angle from centroid (clockwise from top)
  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x)
    const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x)
    return angleA - angleB
  })

  // Find top-left point (smallest x + y sum)
  let topLeftIdx = 0
  let minSum = sorted[0].x + sorted[0].y

  for (let i = 1; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y
    if (sum < minSum) {
      minSum = sum
      topLeftIdx = i
    }
  }

  // Reorder starting from top-left, going clockwise
  const ordered: Point[] = []
  for (let i = 0; i < 4; i++) {
    ordered.push(sorted[(topLeftIdx + i) % 4])
  }

  return {
    topLeft: ordered[0],
    topRight: ordered[1],
    bottomRight: ordered[2],
    bottomLeft: ordered[3],
  }
}

/**
 * Extract card quad from binary mask
 *
 * Complete pipeline:
 * 1. Find contours in mask
 * 2. Select largest contour
 * 3. Approximate to quadrilateral
 * 4. Order points consistently
 *
 * @param mask - OpenCV Mat containing binary mask
 * @param epsilon - Polygon approximation accuracy (default: 0.02)
 * @returns Ordered CardQuad or null if extraction fails
 */
export async function extractQuadFromMask(
  mask: any,
  epsilon: number = 0.02,
): Promise<CardQuad | null> {
  try {
    // Find all contours
    const contours = await maskToContours(mask)

    if (contours.length === 0) {
      console.warn('[Contours] No contours found in mask')
      return null
    }

    // Get largest contour (should be the card)
    const largestContour = await findLargestContour(contours)

    if (!largestContour) {
      console.warn('[Contours] No valid contour found')
      // Cleanup
      for (const contour of contours) {
        contour.delete()
      }
      return null
    }

    // Approximate to quad
    const points = await approximateToQuad(largestContour, epsilon)

    // Cleanup contours
    for (const contour of contours) {
      contour.delete()
    }

    if (!points) {
      console.warn('[Contours] Failed to approximate contour to quadrilateral')
      return null
    }

    // Order points consistently
    const quad = orderQuadPoints(points)

    console.log('[Contours] Successfully extracted quad:', quad)

    return quad
  } catch (error) {
    console.error('[Contours] Error extracting quad from mask:', error)
    return null
  }
}

/**
 * Convert normalized mask coordinates to pixel coordinates
 *
 * @param quad - Quad with normalized coordinates (0-1)
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @returns Quad with pixel coordinates
 */
export function denormalizeQuad(
  quad: CardQuad,
  width: number,
  height: number,
): CardQuad {
  return {
    topLeft: { x: quad.topLeft.x * width, y: quad.topLeft.y * height },
    topRight: { x: quad.topRight.x * width, y: quad.topRight.y * height },
    bottomRight: {
      x: quad.bottomRight.x * width,
      y: quad.bottomRight.y * height,
    },
    bottomLeft: { x: quad.bottomLeft.x * width, y: quad.bottomLeft.y * height },
  }
}

/**
 * Convert pixel coordinates to normalized coordinates (0-1)
 *
 * @param quad - Quad with pixel coordinates
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @returns Quad with normalized coordinates
 */
export function normalizeQuad(
  quad: CardQuad,
  width: number,
  height: number,
): CardQuad {
  return {
    topLeft: { x: quad.topLeft.x / width, y: quad.topLeft.y / height },
    topRight: { x: quad.topRight.x / width, y: quad.topRight.y / height },
    bottomRight: {
      x: quad.bottomRight.x / width,
      y: quad.bottomRight.y / height,
    },
    bottomLeft: { x: quad.bottomLeft.x / width, y: quad.bottomLeft.y / height },
  }
}

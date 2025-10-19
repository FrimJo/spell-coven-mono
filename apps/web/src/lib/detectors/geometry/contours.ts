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

import type { Mat } from '@techstark/opencv-js'

import type { CardQuad, Point } from '../types'
import { loadOpenCV } from '../../opencv-loader'

/**
 * Extract contours from a binary mask
 *
 * @param mask - OpenCV Mat containing binary mask (0 or 255)
 * @returns Array of contours (each contour is an array of points)
 */
export async function maskToContours(mask: Mat): Promise<Mat[]> {
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
    const result: Mat[] = []
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
export async function findLargestContour(contours: Mat[]): Promise<Mat | null> {
  if (contours.length === 0) {
    return null
  }

  const cv = await loadOpenCV()

  let maxArea = 0
  let largestContour: Mat | null = null

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
 * Find the smallest contour containing a specific point
 * This is useful for finding the card when the mask includes larger objects (like a playmat)
 *
 * @param contours - Array of OpenCV contours
 * @param point - Point that should be inside the contour
 * @param minArea - Minimum contour area to consider (filters out noise)
 * @returns Smallest contour containing the point, or null if none found
 */
export async function findSmallestContourContainingPoint(
  contours: Mat[],
  point: Point,
  minArea: number = 1000,
): Promise<Mat | null> {
  if (contours.length === 0) {
    return null
  }

  const cv = await loadOpenCV()
  const cvPoint = new cv.Point(point.x, point.y)

  let minArea_found = Infinity
  let smallestContour: Mat | null = null

  const contoursContainingPoint: Array<{ contour: Mat; area: number }> = []
  
  for (const contour of contours) {
    const area = cv.contourArea(contour)
    
    // Skip contours that are too small (noise)
    if (area < minArea) {
      continue
    }
    
    // Check if point is inside this contour
    const distance = cv.pointPolygonTest(contour, cvPoint, false)
    
    // distance >= 0 means point is inside or on the contour
    if (distance >= 0) {
      contoursContainingPoint.push({ contour, area })
      if (area < minArea_found) {
        minArea_found = area
        smallestContour = contour
      }
    }
  }

  console.log('[Contours] Found smallest contour containing click point:', {
    point,
    totalContours: contours.length,
    contoursContainingPoint: contoursContainingPoint.length,
    areas: contoursContainingPoint.map(c => Math.round(c.area)).sort((a, b) => a - b),
    selectedArea: minArea_found === Infinity ? 'none' : Math.round(minArea_found),
  })

  return smallestContour
}

/**
 * Approximate a contour to a quadrilateral using Douglas-Peucker algorithm
 *
 * @param contour - OpenCV contour to approximate
 * @param epsilon - Approximation accuracy (default: 2% of perimeter)
 * @returns Approximated polygon or null if not a quadrilateral
 */
export async function approximateToQuad(
  contour: Mat,
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
 * Extract quadrilateral from binary mask
 *
 * Workflow:
 * 1. Find contours in mask
 * 2. Get smallest contour containing the click point (assumed to be the card)
 * 3. Approximate contour to quadrilateral
 * 4. Order points consistently (top-left, top-right, bottom-right, bottom-left)
 *
 * @param mask - OpenCV Mat containing binary mask
 * @param clickPoint - Optional click point to find the contour containing it
 * @param epsilon - Initial polygon approximation accuracy (default: 0.02)
 * @returns Ordered CardQuad or null if extraction fails
 */
export async function extractQuadFromMask(
  mask: Mat,
  clickPoint?: Point,
  epsilon: number = 0.02,
): Promise<CardQuad | null> {
  const cv = await loadOpenCV()
  
  try {
    // When we have a click point, skip erosion to preserve separate contours
    // Erosion can merge the card with the playmat
    let contoursSource: Mat
    if (clickPoint) {
      // Use original mask to preserve distinct contours
      contoursSource = mask
      console.log('[Contours] Using original mask (no erosion) to preserve card/playmat separation')
    } else {
      // Apply morphological erosion to tighten mask around card edges
      // This helps remove loose boundaries and background noise
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
      const erodedMask = new cv.Mat()
      cv.erode(mask, erodedMask, kernel, new cv.Point(-1, -1), 2) // 2 iterations
      kernel.delete()
      contoursSource = erodedMask
    }
    
    // Find all contours
    const contours = await maskToContours(contoursSource)
    
    // Clean up eroded mask if we created one
    if (contoursSource !== mask) {
      contoursSource.delete()
    }

    if (contours.length === 0) {
      console.warn('[Contours] No contours found in mask')
      return null
    }

    // Get the appropriate contour based on whether we have a click point
    let targetContour: Mat | null = null
    
    if (clickPoint) {
      // Find smallest contour containing the click point (more precise for cards on playmats)
      targetContour = await findSmallestContourContainingPoint(contours, clickPoint)
      
      if (!targetContour) {
        console.warn('[Contours] No contour found containing click point, falling back to largest')
        targetContour = await findLargestContour(contours)
      }
    } else {
      // No click point provided, use largest contour
      targetContour = await findLargestContour(contours)
    }

    if (!targetContour) {
      console.warn('[Contours] No valid contour found')
      // Cleanup
      for (const contour of contours) {
        contour.delete()
      }
      return null
    }

    // Try multiple epsilon values if initial approximation fails
    // Start with provided epsilon, then try progressively higher values
    // Higher epsilon = more aggressive simplification
    const epsilonValues = [epsilon, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10, 0.12]
    let points: Point[] | null = null

    for (const eps of epsilonValues) {
      points = await approximateToQuad(targetContour, eps)
      if (points) {
        if (eps !== epsilon) {
          console.log(
            `[Contours] Quad approximation succeeded with epsilon=${eps} (initial=${epsilon})`,
          )
        }
        break
      }
    }

    // Cleanup contours
    for (const contour of contours) {
      contour.delete()
    }

    if (!points) {
      console.warn(
        '[Contours] Failed to approximate contour to quadrilateral after trying multiple epsilon values',
      )
      return null
    }

    // Order points consistently
    const quad = orderQuadPoints(points)

    console.log('[Contours] Successfully extracted quad:', {
      topLeft: quad.topLeft,
      topRight: quad.topRight,
      bottomRight: quad.bottomRight,
      bottomLeft: quad.bottomLeft,
      width: Math.round(quad.topRight.x - quad.topLeft.x),
      height: Math.round(quad.bottomLeft.y - quad.topLeft.y),
    })

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

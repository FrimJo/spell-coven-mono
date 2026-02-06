/* eslint-disable @typescript-eslint/no-non-null-assertion */
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

import type { CardQuad, Point } from '../types.js'
import { loadOpenCV } from '../../opencv-loader.js'

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

  // Found smallest contour containing click point
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
      return null
    }

    // Extract points
    const points: Point[] = []
    for (let i = 0; i < 4; i++) {
      const x = approx.data32S[i * 2]
      const y = approx.data32S[i * 2 + 1]
      if (x === undefined || y === undefined) {
        throw new Error(
          `approximateToQuad: Missing coordinate data at index ${i}`,
        )
      }
      points.push({ x, y })
    }

    return points
  } finally {
    approx.delete()
  }
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Order quad points for MTG card: ensures output is portrait orientation (taller than wide)
 *
 * Algorithm:
 * 1. Find all 6 pairwise distances between the 4 points
 * 2. The two longest distances are the diagonals
 * 3. The 4 shorter distances are the edges
 * 4. Group adjacent points (connected by edges) to find opposite corner pairs
 * 5. Use edge lengths to determine which edges are width (short) vs height (long)
 * 6. Assign corners so the output is portrait orientation
 *
 * @param points - Array of 4 corner points (any order)
 * @returns Ordered CardQuad where topLeft-topRight is a SHORT edge (card width)
 */
export function orderQuadPoints(points: Point[]): CardQuad {
  if (points.length !== 4) {
    throw new Error(`Expected 4 points, got ${points.length}`)
  }

  const [p0, p1, p2, p3] = points
  if (!p0 || !p1 || !p2 || !p3) {
    throw new Error('orderQuadPoints: Missing points')
  }

  // Calculate all 6 pairwise distances
  const distances: Array<{ i: number; j: number; dist: number }> = []
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const pi = points[i]!
      const pj = points[j]!
      distances.push({ i, j, dist: distance(pi, pj) })
    }
  }

  // Sort by distance descending - the two longest are diagonals
  distances.sort((a, b) => b.dist - a.dist)

  // The 4 shortest are edges (indices 2,3,4,5 after sorting)
  const edges = distances.slice(2)

  // Build adjacency: which points are connected by edges
  const adjacent: Map<number, number[]> = new Map()
  for (let i = 0; i < 4; i++) adjacent.set(i, [])

  for (const edge of edges) {
    adjacent.get(edge.i)!.push(edge.j)
    adjacent.get(edge.j)!.push(edge.i)
  }

  // Start from point 0, traverse the quad to get ordered points
  const ordered: number[] = [0]
  const visited = new Set<number>([0])

  while (ordered.length < 4) {
    const current = ordered[ordered.length - 1]!
    const neighbors = adjacent.get(current)!
    const next = neighbors.find((n) => !visited.has(n))
    if (next === undefined) break
    ordered.push(next)
    visited.add(next)
  }

  if (ordered.length !== 4) {
    throw new Error('orderQuadPoints: Could not traverse quad')
  }

  // Now we have points in order around the quad (either CW or CCW)
  // Get the actual points
  const q0 = points[ordered[0]!]!
  const q1 = points[ordered[1]!]!
  const q2 = points[ordered[2]!]!
  const q3 = points[ordered[3]!]!

  // Calculate edge lengths in traversal order
  const len01 = distance(q0, q1)
  const len12 = distance(q1, q2)
  const len23 = distance(q2, q3)
  const len30 = distance(q3, q0)

  // Opposite edges: (q0-q1, q2-q3) and (q1-q2, q3-q0)
  const avgLen01_23 = (len01 + len23) / 2
  const avgLen12_30 = (len12 + len30) / 2

  // Determine which edges are the "width" (shorter) edges
  // These should become top and bottom in output

  let topLeft: Point, topRight: Point, bottomRight: Point, bottomLeft: Point

  // In traversal order q0 -> q1 -> q2 -> q3 -> q0:
  // - q0-q1 and q2-q3 are opposite edges
  // - q1-q2 and q3-q0 are opposite edges
  // - q0 connects to q1 (forward) and q3 (backward)
  // - q1 connects to q2 (forward) and q0 (backward)
  // - q2 connects to q3 (forward) and q1 (backward)
  // - q3 connects to q0 (forward) and q2 (backward)

  if (avgLen01_23 < avgLen12_30) {
    // q0-q1 and q2-q3 are the SHORT edges (should become top/bottom)
    // q1-q2 and q3-q0 are the LONG edges (should become left/right, i.e., height)

    // Determine which short edge is "top" (smaller Y = higher on screen)
    const midY01 = (q0.y + q1.y) / 2
    const midY23 = (q2.y + q3.y) / 2

    if (midY01 <= midY23) {
      // q0-q1 is top edge, q2-q3 is bottom edge
      // In traversal: q0 -> q1 -> q2 -> q3 -> q0
      // q1 connects to q2, q0 connects to q3
      if (q0.x <= q1.x) {
        // q0 is left, q1 is right on top edge
        topLeft = q0
        topRight = q1
        // q1 -> q2, so q2 is adjacent to topRight -> q2 is bottomRight
        // q0 <- q3, so q3 is adjacent to topLeft -> q3 is bottomLeft
        bottomRight = q2
        bottomLeft = q3
      } else {
        // q1 is left, q0 is right on top edge
        topLeft = q1
        topRight = q0
        // q1 -> q2, so q2 is adjacent to topLeft -> q2 is bottomLeft
        // q0 <- q3, so q3 is adjacent to topRight -> q3 is bottomRight
        bottomLeft = q2
        bottomRight = q3
      }
    } else {
      // q2-q3 is top edge, q0-q1 is bottom edge
      // In traversal: q0 -> q1 -> q2 -> q3 -> q0
      // q2 connects to q3 (forward) and q1 (backward)
      // q3 connects to q0 (forward) and q2 (backward)
      if (q2.x <= q3.x) {
        // q2 is left, q3 is right on top edge
        topLeft = q2
        topRight = q3
        // q2 <- q1, so q1 is adjacent to topLeft -> q1 is bottomLeft
        // q3 -> q0, so q0 is adjacent to topRight -> q0 is bottomRight
        bottomLeft = q1
        bottomRight = q0
      } else {
        // q3 is left, q2 is right on top edge
        topLeft = q3
        topRight = q2
        // q3 -> q0, so q0 is adjacent to topLeft -> q0 is bottomLeft
        // q2 <- q1, so q1 is adjacent to topRight -> q1 is bottomRight
        bottomLeft = q0
        bottomRight = q1
      }
    }
  } else {
    // q1-q2 and q3-q0 are the SHORT edges (should become top/bottom)
    // q0-q1 and q2-q3 are the LONG edges (should become left/right, i.e., height)

    const midY12 = (q1.y + q2.y) / 2
    const midY30 = (q3.y + q0.y) / 2

    if (midY12 <= midY30) {
      // q1-q2 is top edge, q3-q0 is bottom edge
      // q1 connects to q0 (backward) and q2 (forward)
      // q2 connects to q1 (backward) and q3 (forward)
      if (q1.x <= q2.x) {
        // q1 is left, q2 is right on top edge
        topLeft = q1
        topRight = q2
        // q1 <- q0, so q0 is adjacent to topLeft -> q0 is bottomLeft
        // q2 -> q3, so q3 is adjacent to topRight -> q3 is bottomRight
        bottomLeft = q0
        bottomRight = q3
      } else {
        // q2 is left, q1 is right on top edge
        topLeft = q2
        topRight = q1
        // q2 -> q3, so q3 is adjacent to topLeft -> q3 is bottomLeft
        // q1 <- q0, so q0 is adjacent to topRight -> q0 is bottomRight
        bottomLeft = q3
        bottomRight = q0
      }
    } else {
      // q3-q0 is top edge, q1-q2 is bottom edge
      // q3 connects to q2 (backward) and q0 (forward)
      // q0 connects to q3 (backward) and q1 (forward)
      if (q3.x <= q0.x) {
        // q3 is left, q0 is right on top edge
        topLeft = q3
        topRight = q0
        // q3 <- q2, so q2 is adjacent to topLeft -> q2 is bottomLeft
        // q0 -> q1, so q1 is adjacent to topRight -> q1 is bottomRight
        bottomLeft = q2
        bottomRight = q1
      } else {
        // q0 is left, q3 is right on top edge
        topLeft = q0
        topRight = q3
        // q0 -> q1, so q1 is adjacent to topLeft -> q1 is bottomLeft
        // q3 <- q2, so q2 is adjacent to topRight -> q2 is bottomRight
        bottomLeft = q1
        bottomRight = q2
      }
    }
  }

  return {
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
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
      return null
    }

    // Get the appropriate contour based on whether we have a click point
    let targetContour: Mat | null = null

    if (clickPoint) {
      // Find smallest contour containing the click point (more precise for cards on playmats)
      targetContour = await findSmallestContourContainingPoint(
        contours,
        clickPoint,
      )

      if (!targetContour) {
        targetContour = await findLargestContour(contours)
      }
    } else {
      // No click point provided, use largest contour
      targetContour = await findLargestContour(contours)
    }

    if (!targetContour) {
      // Cleanup
      for (const contour of contours) {
        contour.delete()
      }
      return null
    }

    // Try multiple epsilon values if initial approximation fails
    // Start with provided epsilon, then try progressively higher values
    // Higher epsilon = more aggressive simplification
    const epsilonValues = [epsilon, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12]
    let points: Point[] | null = null

    for (const eps of epsilonValues) {
      points = await approximateToQuad(targetContour, eps)
      if (points) {
        break
      }
    }

    // Cleanup contours
    for (const contour of contours) {
      contour.delete()
    }

    if (!points) {
      return null
    }

    // Order points consistently
    const quad = orderQuadPoints(points)

    return quad
  } catch {
    console.error('Error extracting contours')
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

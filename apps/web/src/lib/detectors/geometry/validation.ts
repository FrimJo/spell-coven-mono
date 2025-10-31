/**
 * Quad validation utilities
 *
 * Functions for validating detected card quadrilaterals:
 * - Aspect ratio validation
 * - Convexity checks
 * - Boundary validation
 *
 * @module detectors/geometry/validation
 */

import type { CardQuad, Point } from '../types.js'
import { MTG_CARD_ASPECT_RATIO } from '../types.js'

/**
 * Result of quad validation
 */
export interface QuadValidationResult {
  /** Whether the quad passes all validation checks */
  valid: boolean

  /** Reason for validation failure (if valid === false) */
  reason?: string

  /** Calculated aspect ratio of the quad */
  aspectRatio?: number

  /** Whether the quad is convex */
  isConvex?: boolean
}

/**
 * Validate quad aspect ratio against MTG card ratio
 *
 * Checks if the detected quad has an aspect ratio within 20% of the
 * expected MTG card ratio (63:88 ≈ 0.716)
 *
 * @param quad - Card quadrilateral to validate
 * @param tolerance - Allowed deviation from expected ratio (default: 0.20 = ±20%)
 * @returns Validation result with aspect ratio
 */
export function validateQuadAspectRatio(
  quad: CardQuad,
  tolerance: number = 0.2,
): QuadValidationResult {
  // Calculate quad dimensions
  const width = Math.max(
    distance(quad.topLeft, quad.topRight),
    distance(quad.bottomLeft, quad.bottomRight),
  )

  const height = Math.max(
    distance(quad.topLeft, quad.bottomLeft),
    distance(quad.topRight, quad.bottomRight),
  )

  if (height === 0) {
    return {
      valid: false,
      reason: 'Quad has zero height',
      aspectRatio: 0,
    }
  }

  const aspectRatio = width / height

  // Check if within tolerance
  const minRatio = MTG_CARD_ASPECT_RATIO * (1 - tolerance)
  const maxRatio = MTG_CARD_ASPECT_RATIO * (1 + tolerance)

  if (aspectRatio < minRatio || aspectRatio > maxRatio) {
    return {
      valid: false,
      reason: `Aspect ratio ${aspectRatio.toFixed(3)} outside valid range [${minRatio.toFixed(3)}, ${maxRatio.toFixed(3)}]`,
      aspectRatio,
    }
  }

  return {
    valid: true,
    aspectRatio,
  }
}

/**
 * Check if a quadrilateral is convex
 *
 * A quad is convex if all cross products have the same sign
 * (all interior angles < 180°)
 *
 * @param quad - Card quadrilateral to check
 * @returns Validation result with convexity status
 */
export function isConvexQuad(quad: CardQuad): QuadValidationResult {
  const points = [
    quad.topLeft,
    quad.topRight,
    quad.bottomRight,
    quad.bottomLeft,
  ]

  // Calculate cross products for each edge
  const crossProducts: number[] = []

  for (let i = 0; i < 4; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % 4]
    const p3 = points[(i + 2) % 4]

    // Vectors
    const v1x = p2.x - p1.x
    const v1y = p2.y - p1.y
    const v2x = p3.x - p2.x
    const v2y = p3.y - p2.y

    // Cross product (z-component)
    const cross = v1x * v2y - v1y * v2x
    crossProducts.push(cross)
  }

  // Check if all cross products have the same sign
  const allPositive = crossProducts.every((cp) => cp > 0)
  const allNegative = crossProducts.every((cp) => cp < 0)

  const isConvex = allPositive || allNegative

  if (!isConvex) {
    return {
      valid: false,
      reason: 'Quad is not convex (has interior angle > 180°)',
      isConvex: false,
    }
  }

  return {
    valid: true,
    isConvex: true,
  }
}

/**
 * Validate quad is within frame boundaries
 *
 * @param quad - Card quadrilateral to validate
 * @param frameWidth - Frame width in pixels
 * @param frameHeight - Frame height in pixels
 * @returns Validation result
 */
export function validateQuadBounds(
  quad: CardQuad,
  frameWidth: number,
  frameHeight: number,
): QuadValidationResult {
  const points = [
    quad.topLeft,
    quad.topRight,
    quad.bottomRight,
    quad.bottomLeft,
  ]

  for (const point of points) {
    if (
      point.x < 0 ||
      point.x > frameWidth ||
      point.y < 0 ||
      point.y > frameHeight
    ) {
      return {
        valid: false,
        reason: `Point (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) outside frame bounds [0, 0, ${frameWidth}, ${frameHeight}]`,
      }
    }
  }

  return {
    valid: true,
  }
}

/**
 * Comprehensive quad validation
 *
 * Runs all validation checks:
 * - Aspect ratio
 * - Convexity
 * - Bounds (if frame dimensions provided)
 *
 * @param quad - Card quadrilateral to validate
 * @param frameWidth - Optional frame width for bounds checking
 * @param frameHeight - Optional frame height for bounds checking
 * @returns Validation result with all checks
 */
export function validateQuad(
  quad: CardQuad,
  frameWidth?: number,
  frameHeight?: number,
): QuadValidationResult {
  // Check convexity first (fast check)
  const convexResult = isConvexQuad(quad)
  if (!convexResult.valid) {
    return convexResult
  }

  // REMOVED: Aspect ratio check - webcam can be at any angle
  // Cards viewed from an angle won't have the correct aspect ratio in the stream
  // const aspectResult = validateQuadAspectRatio(quad)
  // if (!aspectResult.valid) {
  //   return aspectResult
  // }

  // Check bounds if frame dimensions provided
  if (frameWidth !== undefined && frameHeight !== undefined) {
    const boundsResult = validateQuadBounds(quad, frameWidth, frameHeight)
    if (!boundsResult.valid) {
      return boundsResult
    }
  }

  // Calculate aspect ratio for logging purposes only
  const aspectResult = validateQuadAspectRatio(quad)

  return {
    valid: true,
    aspectRatio: aspectResult.aspectRatio,
    isConvex: true,
  }
}

/**
 * Calculate Euclidean distance between two points
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance in pixels
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate area of a quadrilateral using Shoelace formula
 *
 * @param quad - Card quadrilateral
 * @returns Area in square pixels
 */
export function calculateQuadArea(quad: CardQuad): number {
  const points = [
    quad.topLeft,
    quad.topRight,
    quad.bottomRight,
    quad.bottomLeft,
  ]

  let area = 0
  for (let i = 0; i < 4; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % 4]
    area += p1.x * p2.y - p2.x * p1.y
  }

  return Math.abs(area) / 2
}

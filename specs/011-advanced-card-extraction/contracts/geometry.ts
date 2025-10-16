/**
 * Type Contracts for Advanced Card Extraction Geometry
 * 
 * These types define the data contracts for card quad detection,
 * perspective transformation, and frame buffering.
 * 
 * @version 1.0.0
 * @date 2025-10-16
 */

/**
 * 2D point in pixel coordinates
 */
export interface Point {
  x: number
  y: number
}

/**
 * 2D size in pixels
 */
export interface Size {
  width: number
  height: number
}

/**
 * Four corner points defining a card quadrilateral
 * Points must be ordered: top-left, top-right, bottom-right, bottom-left
 */
export interface CardQuad {
  topLeft: Point
  topRight: Point
  bottomRight: Point
  bottomLeft: Point
}

/**
 * Metadata associated with a buffered video frame
 */
export interface FrameMetadata {
  /** Timestamp when frame was captured (milliseconds since epoch) */
  timestamp: number
  
  /** Sharpness score (Laplacian variance) - higher is sharper */
  sharpness: number
  
  /** Sequential frame number for debugging */
  frameNumber: number
}

/**
 * 3×3 perspective transformation matrix
 * Maps source quad to destination rectangle
 */
export interface HomographyMatrix {
  /** 9 elements in row-major order [m00, m01, m02, m10, m11, m12, m20, m21, m22] */
  matrix: Float32Array
  
  /** Source quadrilateral (detected card corners) */
  sourceQuad: CardQuad
  
  /** Destination size (target dimensions after warp) */
  destinationSize: Size
}

/**
 * Region of Interest for edge detection
 * Defines a rectangular area around the click point
 */
export interface ROI {
  /** Top-left X coordinate */
  x: number
  
  /** Top-left Y coordinate */
  y: number
  
  /** ROI width in pixels */
  width: number
  
  /** ROI height in pixels */
  height: number
  
  /** Scale factor relative to expected card size */
  scale: 1.0 | 1.5 | 2.0
}

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
 * Configuration for frame buffer
 */
export interface FrameBufferConfig {
  /** Maximum number of frames to buffer */
  maxSize: number
  
  /** Time window (ms) for selecting sharpest frame */
  sharpnessWindowMs: number
}

/**
 * Result of card extraction
 */
export interface ExtractionResult {
  /** Extracted card image as canvas (384×384) */
  canvas: HTMLCanvasElement
  
  /** Detected card quad in original frame */
  quad: CardQuad
  
  /** Sharpness score of selected frame */
  sharpness: number
  
  /** Timestamp of selected frame */
  timestamp: number
  
  /** Whether temporal optimization was used */
  usedTemporalOptimization: boolean
}

/**
 * Constants for card geometry
 */
export const GEOMETRY_CONSTANTS = {
  /** MTG card aspect ratio (width / height) */
  MTG_CARD_ASPECT_RATIO: 63 / 88,  // ≈ 0.716
  
  /** Tolerance for aspect ratio validation (±20%) */
  ASPECT_RATIO_TOLERANCE: 0.20,
  
  /** Canonical output size for extracted cards */
  CANONICAL_CARD_SIZE: { width: 384, height: 384 } as Size,
  
  /** Frame buffer size */
  FRAME_BUFFER_SIZE: 6,
  
  /** Time window for sharpness selection (±150ms) */
  SHARPNESS_WINDOW_MS: 150,
  
  /** ROI scale factors for adaptive expansion */
  ROI_SCALES: [1.0, 1.5, 2.0] as const,
  
  /** Epsilon for polygon approximation (% of perimeter) */
  APPROX_POLY_EPSILON: 0.02,
} as const

/**
 * Type guard to check if a quad is valid
 */
export function isValidQuad(quad: unknown): quad is CardQuad {
  if (typeof quad !== 'object' || quad === null) return false
  
  const q = quad as any
  return (
    isValidPoint(q.topLeft) &&
    isValidPoint(q.topRight) &&
    isValidPoint(q.bottomRight) &&
    isValidPoint(q.bottomLeft)
  )
}

/**
 * Type guard to check if a point is valid
 */
export function isValidPoint(point: unknown): point is Point {
  if (typeof point !== 'object' || point === null) return false
  
  const p = point as any
  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    isFinite(p.x) &&
    isFinite(p.y)
  )
}

/**
 * Helper to convert CardQuad to array of points
 */
export function quadToArray(quad: CardQuad): Point[] {
  return [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft]
}

/**
 * Helper to create CardQuad from array of points
 * Points must be in order: top-left, top-right, bottom-right, bottom-left
 */
export function arrayToQuad(points: Point[]): CardQuad | null {
  if (points.length !== 4) return null
  
  return {
    topLeft: points[0],
    topRight: points[1],
    bottomRight: points[2],
    bottomLeft: points[3],
  }
}

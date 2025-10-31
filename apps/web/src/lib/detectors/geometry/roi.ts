/**
 * Region of Interest (ROI) utilities
 *
 * Functions for defining and manipulating detection regions:
 * - ROI creation around click points
 * - Progressive ROI expansion
 * - Boundary clipping
 *
 * @module detectors/geometry/roi
 */

import type { Point, ROI } from '../types.js'

/**
 * Default ROI size (pixels)
 * Large enough to capture a typical card but small enough for fast processing
 */
const DEFAULT_ROI_SIZE = 400

/**
 * Create ROI around a click point
 *
 * Centers the ROI on the click point with specified size.
 * Does not clip to frame boundaries - use clipROIToFrame for that.
 *
 * @param clickPoint - Click coordinates
 * @param size - ROI size in pixels (default: 400)
 * @param scale - Scale factor (default: 1.0)
 * @returns ROI centered on click point
 */
export function createROI(
  clickPoint: Point,
  size: number = DEFAULT_ROI_SIZE,
  scale: number = 1.0,
): ROI {
  const scaledSize = size * scale
  const halfSize = scaledSize / 2

  return {
    x: clickPoint.x - halfSize,
    y: clickPoint.y - halfSize,
    width: scaledSize,
    height: scaledSize,
    scale,
  }
}

/**
 * Expand ROI by a scale factor
 *
 * Expands ROI around its center point.
 *
 * @param roi - Original ROI
 * @param scale - Scale factor (e.g., 1.5 for 50% expansion)
 * @returns Expanded ROI
 */
export function expandROI(roi: ROI, scale: number): ROI {
  const centerX = roi.x + roi.width / 2
  const centerY = roi.y + roi.height / 2

  const newWidth = roi.width * scale
  const newHeight = roi.height * scale

  return {
    x: centerX - newWidth / 2,
    y: centerY - newHeight / 2,
    width: newWidth,
    height: newHeight,
    scale: roi.scale * scale,
  }
}

/**
 * Clip ROI to frame boundaries
 *
 * Ensures ROI stays within frame bounds.
 * Adjusts position and size as needed.
 *
 * @param roi - ROI to clip
 * @param frameWidth - Frame width in pixels
 * @param frameHeight - Frame height in pixels
 * @returns Clipped ROI
 */
export function clipROIToFrame(
  roi: ROI,
  frameWidth: number,
  frameHeight: number,
): ROI {
  // Clip to frame boundaries
  const x = Math.max(0, Math.min(roi.x, frameWidth))
  const y = Math.max(0, Math.min(roi.y, frameHeight))

  // Adjust width/height to stay within bounds
  const maxWidth = frameWidth - x
  const maxHeight = frameHeight - y

  const width = Math.min(roi.width, maxWidth)
  const height = Math.min(roi.height, maxHeight)

  return {
    x,
    y,
    width,
    height,
    scale: roi.scale,
  }
}

/**
 * Check if ROI is valid (non-zero size, within reasonable bounds)
 *
 * @param roi - ROI to validate
 * @returns true if ROI is valid
 */
export function isValidROI(roi: ROI): boolean {
  return (
    roi.width > 0 &&
    roi.height > 0 &&
    roi.x >= 0 &&
    roi.y >= 0 &&
    isFinite(roi.x) &&
    isFinite(roi.y) &&
    isFinite(roi.width) &&
    isFinite(roi.height)
  )
}

/**
 * Calculate ROI area in square pixels
 *
 * @param roi - ROI to measure
 * @returns Area in square pixels
 */
export function calculateROIArea(roi: ROI): number {
  return roi.width * roi.height
}

/**
 * Transform point from ROI coordinates to frame coordinates
 *
 * @param point - Point in ROI space
 * @param roi - ROI definition
 * @returns Point in frame space
 */
export function roiToFrameCoordinates(point: Point, roi: ROI): Point {
  return {
    x: point.x + roi.x,
    y: point.y + roi.y,
  }
}

/**
 * Transform point from frame coordinates to ROI coordinates
 *
 * @param point - Point in frame space
 * @param roi - ROI definition
 * @returns Point in ROI space
 */
export function frameToROICoordinates(point: Point, roi: ROI): Point {
  return {
    x: point.x - roi.x,
    y: point.y - roi.y,
  }
}

/**
 * Extract ROI region from canvas
 *
 * @param canvas - Source canvas
 * @param roi - ROI to extract
 * @returns New canvas containing ROI region
 */
export function extractROICanvas(
  canvas: HTMLCanvasElement,
  roi: ROI,
): HTMLCanvasElement {
  const roiCanvas = document.createElement('canvas')
  roiCanvas.width = roi.width
  roiCanvas.height = roi.height

  const ctx = roiCanvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  // Draw ROI region from source canvas
  ctx.drawImage(
    canvas,
    roi.x,
    roi.y,
    roi.width,
    roi.height,
    0,
    0,
    roi.width,
    roi.height,
  )

  return roiCanvas
}

/**
 * Bounding box refinement utilities
 *
 * Functions for refining bounding box detections to precise card corners:
 * - Extract card region from bounding box
 * - Apply edge detection and contour finding
 * - Extract quadrilateral corners
 *
 * @module detectors/geometry/bbox-refinement
 */

import type { CardQuad, Point } from '../types.js'
import { loadOpenCV } from '../../opencv-loader.js'
import { validateQuad } from './validation.js'

/**
 * Refine a bounding box to precise card corners using OpenCV edge detection
 *
 * Workflow:
 * 1. Extract region from bounding box (with padding)
 * 2. Convert to grayscale
 * 3. Apply edge detection (Canny)
 * 4. Find contours
 * 5. Extract quadrilateral from largest/best contour
 * 6. Validate and return corners
 *
 * @param sourceCanvas - Source canvas containing the full frame
 * @param bbox - Normalized bounding box (xmin, ymin, xmax, ymax in 0-1 range)
 * @param canvasWidth - Canvas width for coordinate conversion
 * @param canvasHeight - Canvas height for coordinate conversion
 * @param padding - Padding factor to add around bbox (default: 0.1 = 10%)
 * @returns CardQuad with precise corners, or null if refinement fails
 */
export async function refineBoundingBoxToCorners(
  sourceCanvas: HTMLCanvasElement,
  bbox: { xmin: number; ymin: number; xmax: number; ymax: number },
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 0.1,
): Promise<CardQuad | null> {
  const cv = await loadOpenCV()

  try {
    // Convert normalized bbox to pixel coordinates
    const bboxWidth = bbox.xmax - bbox.xmin
    const bboxHeight = bbox.ymax - bbox.ymin

    // Add padding to bbox (helps capture card edges)
    const padX = bboxWidth * padding
    const padY = bboxHeight * padding

    const x1 = Math.max(0, bbox.xmin - padX) * canvasWidth
    const y1 = Math.max(0, bbox.ymin - padY) * canvasHeight
    const x2 = Math.min(1, bbox.xmax + padX) * canvasWidth
    const y2 = Math.min(1, bbox.ymax + padY) * canvasHeight

    const regionWidth = Math.round(x2 - x1)
    const regionHeight = Math.round(y2 - y1)

    // Extract region from source canvas
    const regionCanvas = document.createElement('canvas')
    regionCanvas.width = regionWidth
    regionCanvas.height = regionHeight
    const regionCtx = regionCanvas.getContext('2d')!
    regionCtx.drawImage(
      sourceCanvas,
      x1,
      y1,
      regionWidth,
      regionHeight,
      0,
      0,
      regionWidth,
      regionHeight,
    )

    // Convert to OpenCV Mat
    const src = cv.imread(regionCanvas)
    const gray = new cv.Mat()
    const edges = new cv.Mat()

    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // Apply Gaussian blur to reduce noise
    const ksize = new cv.Size(5, 5)
    cv.GaussianBlur(gray, gray, ksize, 0)

    // Apply Canny edge detection
    // Lower thresholds to catch more edges (card edges might be subtle)
    cv.Canny(gray, edges, 30, 100)

    // Dilate edges to connect nearby edge segments
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
    cv.dilate(edges, edges, kernel)
    kernel.delete()

    // Log the edge detection result for debugging
    const edgeCanvas = document.createElement('canvas')
    cv.imshow(edgeCanvas, edges)
    // Edge detection complete

    // Find contours
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(
      edges,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    )

    if (contours.size() === 0) {
      src.delete()
      gray.delete()
      edges.delete()
      hierarchy.delete()
      return null
    }

    // Find largest contour (likely the card)
    let maxArea = 0
    let largestContourIdx = -1

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const area = cv.contourArea(contour)
      if (area > maxArea) {
        maxArea = area
        largestContourIdx = i
      }
    }

    if (largestContourIdx === -1) {
      src.delete()
      gray.delete()
      edges.delete()
      hierarchy.delete()
      return null
    }

    // Get the largest contour
    const largestContour = contours.get(largestContourIdx)

    // Approximate contour to polygon
    const epsilon = 0.02 * cv.arcLength(largestContour, true)
    const approx = new cv.Mat()
    cv.approxPolyDP(largestContour, approx, epsilon, true)

    // Try to extract quad from the approximated polygon
    let quad: CardQuad | null = null

    if (approx.rows === 4) {
      // Perfect! We have a quadrilateral
      const points: Point[] = []
      for (let i = 0; i < 4; i++) {
        const x = approx.data32S[i * 2]
        const y = approx.data32S[i * 2 + 1]
        points.push({ x, y })
      }

      // Order points consistently (top-left, top-right, bottom-right, bottom-left)
      quad = orderQuadPoints(points)
    } else {
      // Fallback: use minimum area rectangle
      const rect = cv.minAreaRect(largestContour)
      const vertices = cv.RotatedRect.points(rect)

      const points: Point[] = vertices.map((pt: { x: number; y: number }) => ({
        x: pt.x,
        y: pt.y,
      }))

      quad = orderQuadPoints(points)
    }

    approx.delete()

    if (!quad) {
      src.delete()
      gray.delete()
      edges.delete()
      hierarchy.delete()
      return null
    }

    // Convert quad coordinates from region space back to canvas space
    const canvasQuad: CardQuad = {
      topLeft: { x: quad.topLeft.x + x1, y: quad.topLeft.y + y1 },
      topRight: { x: quad.topRight.x + x1, y: quad.topRight.y + y1 },
      bottomRight: { x: quad.bottomRight.x + x1, y: quad.bottomRight.y + y1 },
      bottomLeft: { x: quad.bottomLeft.x + x1, y: quad.bottomLeft.y + y1 },
    }

    // Validate the quad
    const validation = validateQuad(canvasQuad, canvasWidth, canvasHeight)

    if (!validation.valid) {
      src.delete()
      gray.delete()
      edges.delete()
      hierarchy.delete()
      return null
    }

    // Cleanup
    src.delete()
    gray.delete()
    edges.delete()
    hierarchy.delete()

    return canvasQuad
  } catch {
    // If refinement fails, return original bbox as CardQuad
    return {
      topLeft: { x: bbox.xmin, y: bbox.ymin },
      topRight: { x: bbox.xmax, y: bbox.ymin },
      bottomRight: { x: bbox.xmax, y: bbox.ymax },
      bottomLeft: { x: bbox.xmin, y: bbox.ymax },
    }
  }
}

/**
 * Order 4 points consistently as top-left, top-right, bottom-right, bottom-left
 *
 * Algorithm:
 * 1. Find centroid of all points
 * 2. Sort by angle from centroid
 * 3. Identify corners based on their position relative to centroid
 *
 * @param points - Array of 4 points (unordered)
 * @returns Ordered CardQuad
 */
function orderQuadPoints(points: Point[]): CardQuad {
  if (points.length !== 4) {
    throw new Error('orderQuadPoints requires exactly 4 points')
  }

  // Calculate centroid
  const cx = points.reduce((sum, p) => sum + p.x, 0) / 4
  const cy = points.reduce((sum, p) => sum + p.y, 0) / 4

  // Sort points by angle from centroid (clockwise from top)
  const sorted = points.slice().sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx)
    const angleB = Math.atan2(b.y - cy, b.x - cx)
    return angleA - angleB
  })

  // Find top-left (smallest x + y sum)
  let topLeftIdx = 0
  let minSum = Infinity
  for (let i = 0; i < 4; i++) {
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

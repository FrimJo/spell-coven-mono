/**
 * Card Edge Refinement using OpenCV.js
 * 
 * Takes a roughly cropped card image (from DETR) and finds the exact card edges
 * using computer vision techniques:
 * 1. Convert to grayscale
 * 2. Apply Gaussian blur to reduce noise
 * 3. Canny edge detection
 * 4. Find contours
 * 5. Identify largest quadrilateral (the card)
 * 6. Apply perspective transform to get perfectly aligned card
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// OpenCV.js types (minimal definitions)
// OpenCV.js is a JavaScript library without proper TypeScript definitions
declare global {
  interface Window {
    cv: any
  }
}

export interface CardEdges {
  corners: Array<{ x: number; y: number }>
  confidence: number
}

export interface RefinementResult {
  success: boolean
  refinedCanvas?: HTMLCanvasElement
  edges?: CardEdges
  error?: string
}

/**
 * Load OpenCV.js dynamically
 * @returns Promise that resolves when OpenCV is ready
 */
export async function loadOpenCV(): Promise<void> {
  // Check if already loaded
  if (window.cv && window.cv.Mat) {
    return
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://docs.opencv.org/4.10.0/opencv.js'
    script.async = true
    
    script.onload = () => {
      // OpenCV.js needs a moment to initialize
      const checkReady = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(checkReady)
          resolve()
        }
      }, 100)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkReady)
        reject(new Error('OpenCV initialization timeout'))
      }, 10000)
    }
    
    script.onerror = () => {
      reject(new Error('Failed to load OpenCV.js'))
    }
    
    document.head.appendChild(script)
  })
}

/**
 * Check if OpenCV is loaded
 */
export function isOpenCVLoaded(): boolean {
  return !!(window.cv && window.cv.Mat)
}

/**
 * Find the largest quadrilateral contour in the image
 * @param contours Array of contours from OpenCV
 * @returns The largest quadrilateral contour, or null if none found
 */
function findLargestQuadrilateral(contours: any): any {
  const cv = window.cv
  let maxArea = 0
  let bestContour = null
  
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i)
    const area = cv.contourArea(contour)
    
    // Skip small contours
    if (area < 1000) {
      contour.delete()
      continue
    }
    
    // Approximate contour to polygon
    const peri = cv.arcLength(contour, true)
    const approx = new cv.Mat()
    cv.approxPolyDP(contour, approx, 0.02 * peri, true)
    
    // Check if it's a quadrilateral (4 corners)
    if (approx.rows === 4 && area > maxArea) {
      if (bestContour) bestContour.delete()
      maxArea = area
      bestContour = approx
    } else {
      approx.delete()
    }
    
    contour.delete()
  }
  
  return bestContour
}

/**
 * Order points in clockwise order starting from top-left
 * @param points Array of 4 corner points
 * @returns Ordered points [top-left, top-right, bottom-right, bottom-left]
 */
function orderPoints(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  // Sort by y-coordinate
  const sorted = [...points].sort((a, b) => a.y - b.y)
  
  // Top two points
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x)
  // Bottom two points
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x)
  
  return [
    top[0],      // top-left
    top[1],      // top-right
    bottom[1],   // bottom-right
    bottom[0],   // bottom-left
  ]
}

/**
 * Apply perspective transform to extract the card
 * @param src Source image
 * @param corners Four corner points of the card
 * @param targetWidth Target width for output
 * @param targetHeight Target height for output
 * @returns Transformed image
 */
function applyPerspectiveTransform(
  src: any,
  corners: Array<{ x: number; y: number }>,
  targetWidth: number,
  targetHeight: number,
): any {
  const cv = window.cv
  
  // Order corners
  const ordered = orderPoints(corners)
  
  // Source points (card corners in original image)
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    ordered[0].x, ordered[0].y,
    ordered[1].x, ordered[1].y,
    ordered[2].x, ordered[2].y,
    ordered[3].x, ordered[3].y,
  ])
  
  // Destination points (rectangle in output image)
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    targetWidth, 0,
    targetWidth, targetHeight,
    0, targetHeight,
  ])
  
  // Calculate perspective transform matrix
  const M = cv.getPerspectiveTransform(srcPoints, dstPoints)
  
  // Apply transform
  const dst = new cv.Mat()
  const dsize = new cv.Size(targetWidth, targetHeight)
  cv.warpPerspective(src, dst, M, dsize)
  
  // Cleanup
  srcPoints.delete()
  dstPoints.delete()
  M.delete()
  
  return dst
}

/**
 * Refine card edges using OpenCV
 * Takes a roughly cropped card image and returns a precisely cropped and aligned card
 * 
 * @param inputCanvas Canvas containing the roughly cropped card
 * @param targetWidth Target width for output (default: 384)
 * @param targetHeight Target height for output (default: 384)
 * @returns RefinementResult with refined canvas or error
 */
export function refineCardEdges(
  inputCanvas: HTMLCanvasElement,
  targetWidth = 384,
  targetHeight = 384,
): RefinementResult {
  if (!isOpenCVLoaded()) {
    return {
      success: false,
      error: 'OpenCV not loaded. Call loadOpenCV() first.',
    }
  }
  
  const cv = window.cv
  let src: any = null
  let gray: any = null
  let blurred: any = null
  let edges: any = null
  let contours: any = null
  let hierarchy: any = null
  let quad: any = null
  let warped: any = null
  
  try {
    // Read image from canvas
    src = cv.imread(inputCanvas)
    
    // Convert to grayscale
    gray = new cv.Mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    
    // Apply Gaussian blur to reduce noise
    blurred = new cv.Mat()
    const ksize = new cv.Size(5, 5)
    cv.GaussianBlur(gray, blurred, ksize, 0)
    
    // Canny edge detection
    edges = new cv.Mat()
    cv.Canny(blurred, edges, 50, 150)
    
    // Find contours
    contours = new cv.MatVector()
    hierarchy = new cv.Mat()
    cv.findContours(
      edges,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    )
    
    
    // Find largest quadrilateral
    quad = findLargestQuadrilateral(contours)
    
    if (!quad) {
      return {
        success: false,
        error: 'No quadrilateral card shape found in image',
      }
    }
    
    // Extract corner points
    const corners: Array<{ x: number; y: number }> = []
    for (let i = 0; i < 4; i++) {
      corners.push({
        x: quad.data32F[i * 2],
        y: quad.data32F[i * 2 + 1],
      })
    }
    
    
    // Calculate confidence based on how rectangular the shape is
    // (A perfect rectangle would have corners at right angles)
    const orderedCorners = orderPoints(corners)
    const width1 = Math.hypot(
      orderedCorners[1].x - orderedCorners[0].x,
      orderedCorners[1].y - orderedCorners[0].y,
    )
    const width2 = Math.hypot(
      orderedCorners[2].x - orderedCorners[3].x,
      orderedCorners[2].y - orderedCorners[3].y,
    )
    const height1 = Math.hypot(
      orderedCorners[3].x - orderedCorners[0].x,
      orderedCorners[3].y - orderedCorners[0].y,
    )
    const height2 = Math.hypot(
      orderedCorners[2].x - orderedCorners[1].x,
      orderedCorners[2].y - orderedCorners[1].y,
    )
    
    const widthDiff = Math.abs(width1 - width2) / Math.max(width1, width2)
    const heightDiff = Math.abs(height1 - height2) / Math.max(height1, height2)
    const confidence = 1 - (widthDiff + heightDiff) / 2
    
    
    // Apply perspective transform
    warped = applyPerspectiveTransform(src, corners, targetWidth, targetHeight)
    
    // Create output canvas
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = targetWidth
    outputCanvas.height = targetHeight
    cv.imshow(outputCanvas, warped)
    
    return {
      success: true,
      refinedCanvas: outputCanvas,
      edges: {
        corners: orderedCorners,
        confidence,
      },
    }
  } catch (err) {
    console.error('[EdgeRefiner] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    // Cleanup OpenCV matrices
    if (src) src.delete()
    if (gray) gray.delete()
    if (blurred) blurred.delete()
    if (edges) edges.delete()
    if (contours) contours.delete()
    if (hierarchy) hierarchy.delete()
    if (quad) quad.delete()
    if (warped) warped.delete()
  }
}

/**
 * Convenience function: Load OpenCV and refine card edges in one call
 * @param inputCanvas Canvas containing the roughly cropped card
 * @param targetWidth Target width for output (default: 384)
 * @param targetHeight Target height for output (default: 384)
 * @returns RefinementResult with refined canvas or error
 */
export async function refineCardEdgesWithAutoLoad(
  inputCanvas: HTMLCanvasElement,
  targetWidth = 384,
  targetHeight = 384,
): Promise<RefinementResult> {
  if (!isOpenCVLoaded()) {
    try {
      await loadOpenCV()
    } catch (err) {
      return {
        success: false,
        error: `Failed to load OpenCV: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }
  
  return refineCardEdges(inputCanvas, targetWidth, targetHeight)
}

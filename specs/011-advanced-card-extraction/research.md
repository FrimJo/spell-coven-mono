# Phase 0: Research & Technical Decisions

**Feature**: Advanced Card Extraction  
**Date**: 2025-10-16

## Research Tasks

### 1. OpenCV.js Integration Strategy

**Question**: What is the optimal way to integrate OpenCV.js in a Vite/React application?

**Decision**: Lazy-load OpenCV.js on-demand when user first clicks on a card

**Rationale**:
- OpenCV.js WASM bundle is ~8-9MB (significant impact on initial load)
- Not all users will use card detection feature immediately
- Lazy loading keeps initial bundle small while providing functionality when needed
- IndexedDB caching ensures subsequent loads are instant

**Implementation Approach**:
```typescript
// apps/web/src/lib/opencv-loader.ts
let cvPromise: Promise<any> | null = null

export async function loadOpenCV(): Promise<any> {
  if (cvPromise) return cvPromise
  
  cvPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/opencv/opencv.js'
    script.async = true
    script.onload = () => {
      // Wait for cv to be ready
      cv['onRuntimeInitialized'] = () => resolve(cv)
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
  
  return cvPromise
}
```

**Alternatives Considered**:
- **Bundle with main app**: Rejected - adds 8-9MB to initial bundle
- **CDN loading**: Rejected - requires network access, violates offline-first principle
- **Web Worker**: Considered for future optimization, but adds complexity for MVP

**Bundle Size Impact**: 
- Initial: No impact (lazy loaded)
- On-demand: ~8.5MB download (cached in IndexedDB)
- Subsequent: Instant (from cache)

---

### 2. Frame Buffer Memory Management

**Question**: How to manage 6-frame buffer without memory leaks?

**Decision**: Use circular buffer with explicit cleanup and WeakMap for metadata

**Rationale**:
- Circular buffer provides O(1) insertion and automatic oldest-frame eviction
- WeakMap allows garbage collection of frame data when no longer referenced
- Explicit canvas cleanup prevents memory leaks from ImageData objects

**Implementation Approach**:
```typescript
class FrameBuffer {
  private frames: HTMLCanvasElement[] = []
  private metadata = new WeakMap<HTMLCanvasElement, FrameMetadata>()
  private currentIndex = 0
  private readonly maxSize = 6
  
  add(canvas: HTMLCanvasElement, timestamp: number, sharpness: number) {
    // Cleanup old frame if buffer is full
    if (this.frames.length >= this.maxSize) {
      const oldFrame = this.frames[this.currentIndex]
      // Canvas cleanup happens automatically via garbage collection
    }
    
    // Add new frame
    this.frames[this.currentIndex] = canvas
    this.metadata.set(canvas, { timestamp, sharpness })
    this.currentIndex = (this.currentIndex + 1) % this.maxSize
  }
  
  getSharpest(withinMs: number, clickTime: number): HTMLCanvasElement | null {
    let sharpest: HTMLCanvasElement | null = null
    let maxSharpness = -Infinity
    
    for (const frame of this.frames) {
      const meta = this.metadata.get(frame)
      if (!meta) continue
      
      if (Math.abs(meta.timestamp - clickTime) <= withinMs) {
        if (meta.sharpness > maxSharpness) {
          maxSharpness = meta.sharpness
          sharpest = frame
        }
      }
    }
    
    return sharpest
  }
  
  clear() {
    this.frames = []
    this.currentIndex = 0
  }
}
```

**Memory Footprint**:
- 6 frames × 720p × 4 bytes (RGBA) = ~6.6MB
- Metadata: negligible (~200 bytes per frame)
- Total: ~7MB (acceptable for modern browsers)

**Alternatives Considered**:
- **Array with splice**: Rejected - O(n) insertion, causes array reallocation
- **Keep only ImageData**: Rejected - need full canvas for re-extraction
- **Larger buffer (10+ frames)**: Rejected - diminishing returns vs memory cost

---

### 3. Sharpness Calculation Method

**Question**: What is the most efficient sharpness metric for real-time video?

**Decision**: Laplacian variance (as specified)

**Rationale**:
- Fast to compute (~5-10ms for 720p frame)
- Well-established metric in computer vision
- Directly supported by OpenCV.js (`cv.Laplacian`)
- Higher variance = sharper edges = better image quality

**Implementation**:
```typescript
function calculateSharpness(canvas: HTMLCanvasElement): number {
  const cv = await loadOpenCV()
  
  // Convert to grayscale for faster processing
  const src = cv.imread(canvas)
  const gray = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  
  // Apply Laplacian operator
  const laplacian = new cv.Mat()
  cv.Laplacian(gray, laplacian, cv.CV_64F)
  
  // Calculate variance
  const mean = new cv.Mat()
  const stddev = new cv.Mat()
  cv.meanStdDev(laplacian, mean, stddev)
  const variance = Math.pow(stddev.data64F[0], 2)
  
  // Cleanup
  src.delete()
  gray.delete()
  laplacian.delete()
  mean.delete()
  stddev.delete()
  
  return variance
}
```

**Performance**: ~5-10ms per frame (acceptable overhead)

**Alternatives Considered**:
- **Gradient magnitude**: Similar performance, less established
- **FFT-based**: Rejected - too slow for real-time
- **Simple edge count**: Rejected - less accurate, noise-sensitive

---

### 4. Contour Detection and Polygon Approximation

**Question**: How to reliably detect card quad from SlimSAM mask?

**Decision**: findContours + approxPolyDP with area filtering

**Rationale**:
- SlimSAM provides binary mask of card region
- findContours extracts boundary
- approxPolyDP simplifies to quadrilateral
- Area filtering removes noise/small contours

**Implementation Approach**:
```typescript
function maskToQuad(mask: cv.Mat): Point[] | null {
  const cv = await loadOpenCV()
  
  // Find contours
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
  
  // Find largest contour (should be the card)
  let maxArea = 0
  let maxContourIdx = -1
  
  for (let i = 0; i < contours.size(); i++) {
    const area = cv.contourArea(contours.get(i))
    if (area > maxArea) {
      maxArea = area
      maxContourIdx = i
    }
  }
  
  if (maxContourIdx === -1) return null
  
  // Approximate to polygon
  const contour = contours.get(maxContourIdx)
  const epsilon = 0.02 * cv.arcLength(contour, true)
  const approx = new cv.Mat()
  cv.approxPolyDP(contour, approx, epsilon, true)
  
  // Validate it's a quadrilateral
  if (approx.rows !== 4) {
    // Try different epsilon values or fall back to bounding box
    contours.delete()
    hierarchy.delete()
    approx.delete()
    return null
  }
  
  // Extract 4 corner points
  const points: Point[] = []
  for (let i = 0; i < 4; i++) {
    points.push({
      x: approx.data32S[i * 2],
      y: approx.data32S[i * 2 + 1]
    })
  }
  
  // Cleanup
  contours.delete()
  hierarchy.delete()
  approx.delete()
  
  return points
}
```

**Epsilon tuning**: 2% of perimeter (standard value, may need adjustment)

**Fallback strategy**: If quad detection fails, use minimum bounding rectangle

---

### 5. Perspective Transformation

**Question**: How to apply homography transformation for perspective correction?

**Decision**: getPerspectiveTransform + warpPerspective to 384×384 square

**Rationale**:
- Standard OpenCV approach for perspective correction
- Output size (384×384) matches embedding model input
- Maintains consistency with existing pipeline

**Implementation**:
```typescript
function warpCardToCanonical(
  sourceCanvas: HTMLCanvasElement,
  quad: Point[]
): HTMLCanvasElement {
  const cv = await loadOpenCV()
  
  // Define source quad (detected corners)
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    quad[0].x, quad[0].y,
    quad[1].x, quad[1].y,
    quad[2].x, quad[2].y,
    quad[3].x, quad[3].y
  ])
  
  // Define destination quad (384×384 square)
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    384, 0,
    384, 384,
    0, 384
  ])
  
  // Compute homography matrix
  const M = cv.getPerspectiveTransform(srcPoints, dstPoints)
  
  // Apply transformation
  const src = cv.imread(sourceCanvas)
  const dst = new cv.Mat()
  const dsize = new cv.Size(384, 384)
  cv.warpPerspective(src, dst, M, dsize)
  
  // Convert back to canvas
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = 384
  outputCanvas.height = 384
  cv.imshow(outputCanvas, dst)
  
  // Cleanup
  srcPoints.delete()
  dstPoints.delete()
  M.delete()
  src.delete()
  dst.delete()
  
  return outputCanvas
}
```

**Corner ordering**: Must ensure consistent ordering (top-left, top-right, bottom-right, bottom-left)

---

### 6. ROI Expansion Strategy

**Question**: How to implement adaptive ROI scaling?

**Decision**: Progressive expansion with validation at each step

**Rationale**:
- Start small to minimize processing time
- Expand only if needed (edge detection fails)
- Validate results at each step to avoid unnecessary expansion

**Implementation**:
```typescript
async function detectCardWithROI(
  mask: cv.Mat,
  clickPoint: Point,
  cardSize: { width: number; height: number }
): Promise<Point[] | null> {
  const scales = [1.0, 1.5, 2.0]
  
  for (const scale of scales) {
    // Define ROI around click point
    const roiWidth = cardSize.width * scale
    const roiHeight = cardSize.height * scale
    const roi = new cv.Rect(
      Math.max(0, clickPoint.x - roiWidth / 2),
      Math.max(0, clickPoint.y - roiHeight / 2),
      Math.min(mask.cols, roiWidth),
      Math.min(mask.rows, roiHeight)
    )
    
    // Extract ROI
    const roiMask = mask.roi(roi)
    
    // Try to detect quad
    const quad = maskToQuad(roiMask)
    
    roiMask.delete()
    
    if (quad && validateQuad(quad)) {
      // Adjust coordinates back to full image
      return quad.map(p => ({
        x: p.x + roi.x,
        y: p.y + roi.y
      }))
    }
  }
  
  return null // All attempts failed
}
```

**Expected card size**: Based on MTG card aspect ratio (63:88) and typical distance from camera

---

## Summary of Technical Decisions

| Component | Technology | Rationale |
|-----------|------------|-----------|
| OpenCV Integration | Lazy-loaded WASM | Minimize initial bundle, offline-capable |
| Frame Buffer | Circular buffer (6 frames) | O(1) operations, automatic eviction |
| Sharpness Metric | Laplacian variance | Fast, accurate, well-established |
| Contour Detection | findContours + approxPolyDP | Standard OpenCV approach |
| Perspective Warp | getPerspectiveTransform | Direct transformation to 384×384 |
| ROI Strategy | Progressive expansion (1.0× → 1.5× → 2.0×) | Balance speed vs robustness |

**All NEEDS CLARIFICATION items resolved** ✅

# Data Model: Advanced Card Extraction

**Feature**: Advanced Card Extraction  
**Date**: 2025-10-16

## Core Entities

### 1. CardQuad

Represents the four corner points of a detected card in the video frame.

**Fields**:
- `topLeft: Point` - Top-left corner coordinates
- `topRight: Point` - Top-right corner coordinates
- `bottomRight: Point` - Bottom-right corner coordinates
- `bottomLeft: Point` - Bottom-left corner coordinates

**Validation Rules**:
- All points must be within frame boundaries
- Points must form a convex quadrilateral
- Aspect ratio must be within 20% of MTG card ratio (63:88 ≈ 0.716)
- Minimum area threshold to filter noise

**State Transitions**:
```
SlimSAM Mask → Contour Detection → Polygon Approximation → CardQuad
                                                              ↓
                                                         Validation
                                                              ↓
                                                    Valid / Invalid
```

**Relationships**:
- Derived from: SlimSAM segmentation mask
- Used by: Perspective transformation
- Validated against: MTG card aspect ratio constant

---

### 2. FrameBuffer

Rolling collection of recent video frames with associated quality metrics.

**Fields**:
- `frames: HTMLCanvasElement[]` - Array of canvas elements (max 6)
- `metadata: WeakMap<HTMLCanvasElement, FrameMetadata>` - Frame metadata
- `currentIndex: number` - Circular buffer write position
- `maxSize: number` - Maximum buffer size (constant: 6)

**FrameMetadata** (nested):
- `timestamp: number` - Frame capture time (milliseconds since epoch)
- `sharpness: number` - Laplacian variance score
- `frameNumber: number` - Sequential frame counter

**Validation Rules**:
- Buffer size never exceeds `maxSize`
- Timestamps must be monotonically increasing
- Sharpness scores must be non-negative

**Lifecycle**:
```
Video Frame → Capture → Calculate Sharpness → Add to Buffer
                                                     ↓
                                              Evict Oldest (if full)
                                                     ↓
                                              Available for Selection
```

**Operations**:
- `add(canvas, timestamp, sharpness)` - Add new frame, evict oldest if full
- `getSharpest(withinMs, clickTime)` - Find sharpest frame within time window
- `clear()` - Reset buffer (on webcam stop/restart)

---

### 3. HomographyMatrix

3×3 transformation matrix mapping detected quad to canonical rectangle.

**Fields**:
- `matrix: Float32Array` - 9 elements in row-major order
- `sourceQuad: CardQuad` - Original detected corners
- `destinationSize: Size` - Target dimensions (384×384)

**Validation Rules**:
- Matrix must be invertible (determinant ≠ 0)
- Matrix elements must be finite numbers
- Destination size must match embedding model input (384×384)

**Computation**:
```
CardQuad → getPerspectiveTransform → HomographyMatrix
                                           ↓
                                    warpPerspective
                                           ↓
                                    384×384 Canvas
```

**Relationships**:
- Input: CardQuad (4 source points)
- Output: Warped canvas (384×384 pixels)
- Used once per extraction (not cached)

---

### 4. ROI (Region of Interest)

Bounding area around click point where edge detection is performed.

**Fields**:
- `x: number` - Top-left X coordinate
- `y: number` - Top-left Y coordinate
- `width: number` - ROI width in pixels
- `height: number` - ROI height in pixels
- `scale: number` - Scale factor (1.0, 1.5, or 2.0)

**Validation Rules**:
- ROI must be within frame boundaries (clipped if necessary)
- Scale must be one of: 1.0, 1.5, 2.0
- Dimensions based on expected card size × scale

**Expansion Strategy**:
```
Click Point → ROI (1.0×) → Edge Detection
                              ↓
                          Success? → Return Quad
                              ↓ No
                          ROI (1.5×) → Edge Detection
                              ↓
                          Success? → Return Quad
                              ↓ No
                          ROI (2.0×) → Edge Detection
                              ↓
                          Success? → Return Quad
                              ↓ No
                          Fail Gracefully
```

**Expected Card Size** (baseline for scaling):
- Width: ~200-300 pixels (at typical distance)
- Height: ~280-420 pixels (63:88 aspect ratio)
- Calculated from: MTG_CARD_ASPECT_RATIO constant

---

### 5. SharpnessScore

Numerical measure of frame clarity using Laplacian variance.

**Fields**:
- `value: number` - Variance of Laplacian operator
- `computedAt: number` - Timestamp when calculated

**Validation Rules**:
- Value must be non-negative
- Higher values indicate sharper images
- Typical range: 0-10000 (depends on image content)

**Computation**:
```
Canvas → Grayscale Conversion → Laplacian Operator → Variance Calculation → SharpnessScore
```

**Usage**:
- Calculated for each buffered frame
- Used to select optimal frame for extraction
- Threshold for "acceptable sharpness": TBD during testing

---

## Type Definitions

### Point

```typescript
interface Point {
  x: number
  y: number
}
```

### Size

```typescript
interface Size {
  width: number
  height: number
}
```

### CardQuad

```typescript
interface CardQuad {
  topLeft: Point
  topRight: Point
  bottomRight: Point
  bottomLeft: Point
}
```

### FrameMetadata

```typescript
interface FrameMetadata {
  timestamp: number
  sharpness: number
  frameNumber: number
}
```

### HomographyMatrix

```typescript
interface HomographyMatrix {
  matrix: Float32Array  // 3×3 in row-major order
  sourceQuad: CardQuad
  destinationSize: Size
}
```

### ROI

```typescript
interface ROI {
  x: number
  y: number
  width: number
  height: number
  scale: 1.0 | 1.5 | 2.0
}
```

---

## Constants

### MTG_CARD_ASPECT_RATIO

```typescript
const MTG_CARD_ASPECT_RATIO = 63 / 88  // ≈ 0.716
```

**Usage**: Validate detected quads have approximately correct aspect ratio

**Tolerance**: ±20% (0.573 - 0.859)

### CANONICAL_CARD_SIZE

```typescript
const CANONICAL_CARD_SIZE = { width: 384, height: 384 }
```

**Usage**: Target dimensions for perspective-warped card image

**Rationale**: Matches embedding model input size

### FRAME_BUFFER_SIZE

```typescript
const FRAME_BUFFER_SIZE = 6
```

**Usage**: Maximum number of frames to buffer

**Rationale**: ~400ms coverage at 15 FPS, balanced memory usage

### SHARPNESS_WINDOW_MS

```typescript
const SHARPNESS_WINDOW_MS = 150
```

**Usage**: Time window (±150ms) for selecting sharpest frame

**Rationale**: Balances temporal proximity with quality improvement

### ROI_SCALES

```typescript
const ROI_SCALES = [1.0, 1.5, 2.0] as const
```

**Usage**: Progressive expansion factors for adaptive ROI

**Rationale**: Geometric progression provides good coverage without excessive attempts

---

## Data Flow

### End-to-End Extraction Pipeline

```
1. User Click
   ↓
2. Get Current Frame + Buffered Frames
   ↓
3. SlimSAM Segmentation (existing)
   ↓
4. Mask → Contours → CardQuad
   ↓
5. Validate Quad (aspect ratio, convexity)
   ↓
6. Select Sharpest Frame (within ±150ms)
   ↓
7. Compute Homography Matrix
   ↓
8. Warp Perspective → 384×384 Canvas
   ↓
9. Return Canonical Card Image
```

### Frame Buffer Update (Continuous)

```
Video Frame (every ~66ms at 15 FPS)
   ↓
Calculate Sharpness Score
   ↓
Add to Frame Buffer
   ↓
Evict Oldest if Buffer Full
```

---

## Validation Rules Summary

| Entity | Validation | Error Handling |
|--------|------------|----------------|
| CardQuad | Convex, aspect ratio ±20%, within bounds | Fall back to bounding box or fail gracefully |
| FrameBuffer | Size ≤ 6, timestamps increasing | Log warning, continue with available frames |
| HomographyMatrix | Invertible, finite values | Fail extraction, show error to user |
| ROI | Within frame bounds | Clip to frame boundaries |
| SharpnessScore | Non-negative | Use frame anyway, log warning |

---

## Memory Management

### Frame Buffer

- **Size**: 6 frames × 720p × 4 bytes (RGBA) ≈ 6.6MB
- **Cleanup**: Automatic via circular buffer + WeakMap
- **Lifecycle**: Cleared on webcam stop/restart

### OpenCV.js Matrices

- **Allocation**: Created during processing
- **Cleanup**: Explicit `.delete()` calls required
- **Pattern**: Try-finally blocks to ensure cleanup

### Canvas Elements

- **Temporary canvases**: Created for intermediate steps
- **Cleanup**: Garbage collected when no longer referenced
- **Reuse**: Output canvas reused for display

---

## Performance Characteristics

| Operation | Time Complexity | Space Complexity | Typical Duration |
|-----------|----------------|------------------|------------------|
| Frame Buffer Add | O(1) | O(1) | <1ms |
| Sharpness Calculation | O(n) pixels | O(n) pixels | 5-10ms (720p) |
| Contour Detection | O(n) pixels | O(k) contour points | 10-20ms |
| Perspective Warp | O(n) pixels | O(1) | 15-25ms |
| Total Extraction | O(n) pixels | O(n) pixels | 50-100ms |

**Note**: n = number of pixels in frame, k = number of contour points (typically << n)

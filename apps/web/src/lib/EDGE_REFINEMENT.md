# Card Edge Refinement with OpenCV

## Overview

The edge refinement feature uses OpenCV.js to find the **exact edges** of MTG cards after initial detection by DETR. This provides more precise card boundaries and better alignment.

## How It Works

### Two-Stage Pipeline

1. **DETR Detection** (Fast, approximate)
   - Detects card regions in video stream
   - Provides bounding boxes with ~90-95% accuracy
   - Runs at 500ms intervals

2. **OpenCV Refinement** (Precise, on-demand)
   - Takes DETR-cropped image as input
   - Finds exact card edges using computer vision
   - Applies perspective transform for perfect alignment
   - Only runs when user clicks to capture a card

### Computer Vision Pipeline

```
Input Image (DETR crop)
    ↓
Grayscale Conversion
    ↓
Gaussian Blur (noise reduction)
    ↓
Canny Edge Detection
    ↓
Contour Finding
    ↓
Quadrilateral Detection (find card shape)
    ↓
Perspective Transform (straighten card)
    ↓
Output: Perfectly aligned card
```

## Usage

### Basic Setup

```typescript
import { loadOpenCV } from './lib/card-edge-refiner'
import { setupWebcam } from './lib/webcam'

// 1. Load OpenCV (do this once at app startup)
await loadOpenCV()

// 2. Setup webcam
const webcam = await setupWebcam({
  video: videoElement,
  overlay: overlayCanvas,
  cropped: croppedCanvas,
  fullRes: fullResCanvas,
  onCrop: (canvas) => {
    // Handle cropped card
  },
})

// 3. Enable edge refinement
webcam.setEdgeRefinement(true)

// 4. Start video
await webcam.startVideo()
```

### Toggle Edge Refinement

```typescript
// Check if available
if (webcam.isEdgeRefinementAvailable()) {
  // Enable/disable
  webcam.setEdgeRefinement(true) // or false

  // Check current state
  const enabled = webcam.isEdgeRefinementEnabled()
}
```

### Standalone Edge Refinement

You can also use edge refinement on existing images:

```typescript
import { refineCardEdgesWithAutoLoad } from './lib/card-edge-refiner'

// Load image into canvas
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')!
ctx.drawImage(image, 0, 0)

// Refine edges
const result = await refineCardEdgesWithAutoLoad(canvas, 384, 384)

if (result.success) {
  // Use refined canvas
  document.body.appendChild(result.refinedCanvas!)

  // Check quality
  console.log('Confidence:', result.edges?.confidence)
  console.log('Corners:', result.edges?.corners)
} else {
  console.error('Failed:', result.error)
}
```

## API Reference

### `loadOpenCV()`

Loads OpenCV.js library from CDN.

**Returns:** `Promise<void>`

**Example:**

```typescript
try {
  await loadOpenCV()
  console.log('OpenCV ready!')
} catch (err) {
  console.error('Failed to load OpenCV:', err)
}
```

### `isOpenCVLoaded()`

Checks if OpenCV is loaded and ready.

**Returns:** `boolean`

### `refineCardEdges(inputCanvas, targetWidth?, targetHeight?)`

Refines card edges from a roughly cropped card image.

**Parameters:**

- `inputCanvas: HTMLCanvasElement` - Canvas containing the card
- `targetWidth?: number` - Output width (default: 384)
- `targetHeight?: number` - Output height (default: 384)

**Returns:** `RefinementResult`

```typescript
interface RefinementResult {
  success: boolean
  refinedCanvas?: HTMLCanvasElement
  edges?: {
    corners: Array<{ x: number; y: number }>
    confidence: number // 0-1, higher is better
  }
  error?: string
}
```

### `refineCardEdgesWithAutoLoad(inputCanvas, targetWidth?, targetHeight?)`

Same as `refineCardEdges()` but automatically loads OpenCV if needed.

**Returns:** `Promise<RefinementResult>`

### Webcam Methods

#### `setEdgeRefinement(enabled: boolean)`

Enable or disable edge refinement for card cropping.

#### `isEdgeRefinementEnabled()`

Check if edge refinement is currently enabled.

**Returns:** `boolean`

#### `isEdgeRefinementAvailable()`

Check if OpenCV is loaded and edge refinement is available.

**Returns:** `boolean`

## Performance

### Loading Time

- OpenCV.js: ~2-3 seconds (one-time, at startup)
- CDN size: ~8MB (cached after first load)

### Processing Time

- Edge refinement: ~50-200ms per card
- Does not affect detection loop (only runs on crop)

### Memory Usage

- OpenCV.js: ~20-30MB
- Temporary matrices are cleaned up after each refinement

## Confidence Score

The refinement returns a confidence score (0-1) indicating how well the detected shape matches a rectangle:

- **0.9-1.0**: Excellent - Card is flat and well-aligned
- **0.7-0.9**: Good - Minor perspective distortion
- **0.5-0.7**: Fair - Noticeable distortion but usable
- **< 0.5**: Poor - May not be a card or heavily distorted

## Troubleshooting

### OpenCV fails to load

**Problem:** Network error or CDN unavailable

**Solution:**

```typescript
try {
  await loadOpenCV()
} catch (err) {
  // Fallback: Use DETR crops without refinement
  console.warn('OpenCV unavailable, using basic cropping')
}
```

### No quadrilateral found

**Problem:** Card edges not detected

**Possible causes:**

- Card is too small in the image
- Poor lighting or low contrast
- Card is heavily occluded
- Background is too cluttered

**Solution:**

- Ensure DETR bounding box is tight around card
- Improve lighting conditions
- Move camera closer to card

### Low confidence score

**Problem:** Detected shape doesn't match a rectangle well

**Possible causes:**

- Card is bent or warped
- Perspective distortion is too extreme
- Partial occlusion

**Solution:**

- Hold card flat
- Position card more perpendicular to camera
- Ensure full card is visible

## Example: Complete Integration

See `card-edge-refiner.demo.ts` for complete examples including:

- Webcam setup with edge refinement
- Toggle button for enabling/disabling
- Standalone image refinement

## Technical Details

### OpenCV Operations Used

1. **cvtColor** - RGB to grayscale conversion
2. **GaussianBlur** - Noise reduction (5×5 kernel)
3. **Canny** - Edge detection (thresholds: 50, 150)
4. **findContours** - Contour extraction
5. **approxPolyDP** - Polygon approximation
6. **getPerspectiveTransform** - Homography calculation
7. **warpPerspective** - Image transformation

### Why This Approach?

- **DETR**: Fast, GPU-accelerated, works on full video frame
- **OpenCV**: Precise, CPU-based, works on small cropped region
- **Combined**: Best of both worlds - speed + accuracy

### Alternatives Considered

1. **OpenCV-only detection**: Too slow for real-time video
2. **DETR-only**: Less precise edges, no perspective correction
3. **Deep learning edge detection**: Overkill, requires additional models

## Future Improvements

- [ ] Adaptive Canny thresholds based on image brightness
- [ ] Multi-scale edge detection for better robustness
- [ ] Card orientation detection (upright vs. rotated)
- [ ] Quality metrics (blur detection, lighting assessment)
- [ ] WebAssembly optimization for faster processing

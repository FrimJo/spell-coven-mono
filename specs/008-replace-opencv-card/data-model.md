# Data Model: DETR Card Detection

**Feature**: Replace OpenCV Card Detection with DETR  
**Date**: 2025-10-15

## Overview

This document defines the data structures and contracts for DETR-based card detection. The system processes video frames, detects objects, filters by confidence and aspect ratio, and outputs detected card locations for user interaction.

---

## Core Entities

### 1. DetectionResult

Represents a single object detected by the DETR model.

**Source**: DETR model output (Transformers.js pipeline)

**Schema**:
```typescript
interface DetectionResult {
  label: string          // Object class label (e.g., "card", "book", "remote")
  score: number          // Confidence score [0.0, 1.0]
  box: BoundingBox       // Location in frame
}
```

**Validation Rules**:
- `score` MUST be in range [0.0, 1.0]
- `label` MUST be non-empty string
- `box` MUST contain valid coordinates

**Lifecycle**:
1. Created by DETR inference
2. Filtered by confidence threshold (>= 0.5)
3. Filtered by aspect ratio validation
4. Converted to DetectedCard if passes filters
5. Discarded after frame processing

**Example**:
```json
{
  "label": "book",
  "score": 0.87,
  "box": {
    "xmin": 0.234,
    "ymin": 0.123,
    "xmax": 0.567,
    "ymax": 0.789
  }
}
```

---

### 2. BoundingBox

Rectangular region defining object location in normalized coordinates.

**Source**: DETR model output

**Schema**:
```typescript
interface BoundingBox {
  xmin: number  // Left edge [0.0, 1.0] as percentage of frame width
  ymin: number  // Top edge [0.0, 1.0] as percentage of frame height
  xmax: number  // Right edge [0.0, 1.0] as percentage of frame width
  ymax: number  // Bottom edge [0.0, 1.0] as percentage of frame height
}
```

**Validation Rules**:
- All coordinates MUST be in range [0.0, 1.0]
- `xmax` MUST be > `xmin`
- `ymax` MUST be > `ymin`
- Width (`xmax - xmin`) MUST be > 0.01 (minimum 1% of frame)
- Height (`ymax - ymin`) MUST be > 0.01 (minimum 1% of frame)

**Derived Properties**:
```typescript
width = xmax - xmin
height = ymax - ymin
aspectRatio = width / height
centerX = (xmin + xmax) / 2
centerY = (ymin + ymax) / 2
```

**Coordinate Conversion**:
```typescript
// Normalized (percentage) → Pixel coordinates
function toPixels(box: BoundingBox, canvasWidth: number, canvasHeight: number) {
  return {
    xmin: box.xmin * canvasWidth,
    ymin: box.ymin * canvasHeight,
    xmax: box.xmax * canvasWidth,
    ymax: box.ymax * canvasHeight
  }
}

// Pixel → Normalized coordinates
function toPercentage(pixelBox: PixelBox, canvasWidth: number, canvasHeight: number) {
  return {
    xmin: pixelBox.xmin / canvasWidth,
    ymin: pixelBox.ymin / canvasHeight,
    xmax: pixelBox.xmax / canvasWidth,
    ymax: pixelBox.ymax / canvasHeight
  }
}
```

---

### 3. DetectedCard

A filtered detection result that represents a valid MTG card candidate.

**Source**: Filtered DetectionResult

**Schema**:
```typescript
interface DetectedCard {
  box: BoundingBox       // Normalized coordinates
  score: number          // Confidence score [0.5, 1.0]
  aspectRatio: number    // Computed width/height ratio
  polygon: Point[]       // 4-point polygon for rendering (ordered: TL, TR, BR, BL)
}

interface Point {
  x: number  // Pixel coordinates on overlay canvas
  y: number
}
```

**Validation Rules**:
- `score` MUST be >= 0.5 (confidence threshold)
- `aspectRatio` MUST be within MTG card tolerance:
  - Target: 0.716 (63/88)
  - Range: [0.573, 0.859] (±20% tolerance)
- `polygon` MUST have exactly 4 points
- Points MUST be ordered: top-left, top-right, bottom-right, bottom-left

**Lifecycle**:
1. Created from DetectionResult after filtering
2. Stored in `detectedCards` array
3. Rendered as bounding box on overlay
4. Used for click-to-select interaction
5. Replaced on next detection cycle (every 500ms)

**Example**:
```json
{
  "box": {
    "xmin": 0.3,
    "ymin": 0.2,
    "xmax": 0.5,
    "ymax": 0.6
  },
  "score": 0.89,
  "aspectRatio": 0.714,
  "polygon": [
    {"x": 192, "y": 108},
    {"x": 320, "y": 108},
    {"x": 320, "y": 324},
    {"x": 192, "y": 324}
  ]
}
```

---

### 4. DetectionState

Application state for the detection system.

**Source**: Application runtime

**Schema**:
```typescript
interface DetectionState {
  status: 'idle' | 'loading' | 'ready' | 'detecting' | 'error'
  detector: ObjectDetectionPipeline | null
  detectedCards: DetectedCard[]
  lastDetectionTime: number  // Timestamp (ms)
  error: string | null
}
```

**State Transitions**:
```
idle → loading (initDetection called)
loading → ready (model loaded successfully)
loading → error (model load failed)
ready → detecting (startDetection called)
detecting → ready (stopDetection called)
error → loading (retry initiated)
```

**Validation Rules**:
- `detector` MUST be null when status is 'idle', 'loading', or 'error'
- `detector` MUST be non-null when status is 'ready' or 'detecting'
- `detectedCards` MUST be empty when status is not 'detecting'
- `error` MUST be null when status is not 'error'
- `lastDetectionTime` MUST be updated on each detection cycle

---

## Data Flow

### Detection Pipeline

```
Video Frame (HTMLVideoElement)
  ↓
Capture to Canvas (ImageData)
  ↓
DETR Inference (500ms interval)
  ↓
DetectionResult[] (raw model output)
  ↓
Filter by confidence (>= 0.5)
  ↓
Filter by aspect ratio (±20% of 0.716)
  ↓
Convert to DetectedCard[] (with polygon points)
  ↓
Update overlay (render bounding boxes)
  ↓
Store in detectedCards array
  ↓
Wait for user click
  ↓
Find closest card to click point
  ↓
Crop card using perspective transform
  ↓
Pass to CLIP identification (existing pipeline)
```

### Coordinate Systems

**1. Video Frame Coordinates**
- Source: `HTMLVideoElement`
- Units: Pixels
- Origin: Top-left (0, 0)
- Size: `videoEl.videoWidth × videoEl.videoHeight` (e.g., 1920×1080)

**2. Overlay Canvas Coordinates**
- Source: `overlayEl` canvas
- Units: Pixels
- Origin: Top-left (0, 0)
- Size: `overlayEl.width × overlayEl.height` (e.g., 640×360)
- **Scaling**: `scaleX = overlayEl.width / videoEl.videoWidth`

**3. Normalized Coordinates**
- Source: DETR model output
- Units: Percentage [0.0, 1.0]
- Origin: Top-left (0.0, 0.0)
- Size: 1.0 × 1.0
- **Conversion**: `pixelX = normalizedX * canvasWidth`

**4. Cropped Card Coordinates**
- Source: Perspective transform output
- Units: Pixels
- Origin: Top-left (0, 0)
- Size: 315×440 (MTG card aspect ratio)
- **Contract**: Fixed size for CLIP pipeline compatibility

---

## Constants

### Detection Parameters

```typescript
// Confidence threshold for DETR detections
const CONFIDENCE_THRESHOLD = 0.5

// MTG card aspect ratio (width/height)
const MTG_CARD_ASPECT_RATIO = 63 / 88  // ≈ 0.716

// Tolerance for aspect ratio matching (±20%)
const ASPECT_RATIO_TOLERANCE = 0.20

// Detection inference interval (milliseconds)
const DETECTION_INTERVAL_MS = 500  // 2 FPS

// Minimum card area (percentage of frame)
const MIN_CARD_AREA = 0.01  // 1% of frame

// Cropped card dimensions (pixels)
const CROPPED_CARD_WIDTH = 315
const CROPPED_CARD_HEIGHT = 440
```

### Computed Ranges

```typescript
// Valid aspect ratio range
const MIN_ASPECT_RATIO = MTG_CARD_ASPECT_RATIO * (1 - ASPECT_RATIO_TOLERANCE)  // 0.573
const MAX_ASPECT_RATIO = MTG_CARD_ASPECT_RATIO * (1 + ASPECT_RATIO_TOLERANCE)  // 0.859

// Aspect ratio validation
function isValidCardAspectRatio(aspectRatio: number): boolean {
  return aspectRatio >= MIN_ASPECT_RATIO && aspectRatio <= MAX_ASPECT_RATIO
}
```

---

## Integration Contracts

### Input Contract: Video Frame

**Provider**: Browser MediaStream API  
**Consumer**: DETR detection pipeline

**Format**: HTMLVideoElement with active video stream

**Requirements**:
- Video MUST be playing (`videoEl.readyState >= 2`)
- Dimensions MUST be available (`videoEl.videoWidth > 0`)
- Minimum resolution: 640×480 (recommended: 1280×720)

**Validation**:
```typescript
function validateVideoElement(videoEl: HTMLVideoElement): boolean {
  return (
    videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    videoEl.videoWidth > 0 &&
    videoEl.videoHeight > 0
  )
}
```

---

### Output Contract: Cropped Card Canvas

**Provider**: DETR detection + perspective transform  
**Consumer**: CLIP identification pipeline

**Format**: HTMLCanvasElement with card image

**Requirements**:
- Dimensions: 315×440 pixels (fixed)
- Format: RGBA ImageData
- Content: Perspective-corrected card image
- Aspect ratio: 63:88 (MTG card standard)

**Validation**:
```typescript
function validateCroppedCanvas(canvas: HTMLCanvasElement): boolean {
  return (
    canvas.width === CROPPED_CARD_WIDTH &&
    canvas.height === CROPPED_CARD_HEIGHT &&
    canvas.getContext('2d') !== null
  )
}
```

**Contract Guarantee**: This output format is unchanged from the existing OpenCV implementation, ensuring compatibility with the CLIP identification pipeline.

---

## Error Handling

### Error Types

```typescript
type DetectionError =
  | 'MODEL_LOAD_FAILED'
  | 'INFERENCE_FAILED'
  | 'INVALID_VIDEO_FRAME'
  | 'WEBGL_NOT_SUPPORTED'
  | 'NETWORK_ERROR'

interface DetectionErrorInfo {
  type: DetectionError
  message: string
  recoverable: boolean
  retryable: boolean
}
```

### Error Scenarios

| Error Type | Cause | User Message | Recovery |
|------------|-------|--------------|----------|
| MODEL_LOAD_FAILED | Network failure, CORS issue | "Detection model unavailable - please check your internet connection" | Retry after network restore |
| INFERENCE_FAILED | GPU memory, model corruption | "Detection temporarily unavailable - retrying..." | Automatic retry |
| INVALID_VIDEO_FRAME | Camera disconnected, stream ended | "Camera feed lost - please reconnect" | Restart video stream |
| WEBGL_NOT_SUPPORTED | Old browser, GPU disabled | "Your browser doesn't support card detection features" | Not recoverable |
| NETWORK_ERROR | Offline, CDN down | "Detection model unavailable - please connect to internet for first-time download" | Wait for network |

---

## Performance Characteristics

### Memory Usage

| Component | Size | Lifecycle |
|-----------|------|-----------|
| DETR model | ~200MB | Persistent (cached in IndexedDB) |
| Video frame buffer | ~8MB | Per-frame (1920×1080 RGBA) |
| Detection results | <1KB | Per-cycle (500ms) |
| Overlay canvas | ~1MB | Persistent (640×360 RGBA) |
| Cropped card canvas | ~0.5MB | Persistent (315×440 RGBA) |

**Total overhead**: ~210MB (mostly one-time model download)

### Timing Characteristics

| Operation | Target | Typical | Maximum |
|-----------|--------|---------|---------|
| Model load (first) | <30s | 15-20s | 60s |
| Model load (cached) | <5s | 1-2s | 10s |
| Single inference | <500ms | 200-300ms | 1000ms |
| Frame capture | <10ms | 2-5ms | 20ms |
| Aspect ratio filter | <1ms | <1ms | 5ms |
| Overlay render | <16ms | 5-10ms | 33ms |

**Detection latency**: 500ms (inference interval) + 200ms (avg inference) = ~700ms total

---

## Version History

**v1.0** (2025-10-15): Initial data model for DETR detection system

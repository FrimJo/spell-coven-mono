# Card Detector Architecture

This module provides a **pluggable card detection system** with separation of concerns (SoC), enabling easy switching between different detection models.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        webcam.ts                             │
│                  (Detection Orchestration)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    CardDetector Interface                    │
│                   (Abstract Detection API)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
                ▼           ▼           ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  OpenCV     │ │  DETR       │ │  OWL-ViT    │
    │  Detector   │ │  Detector   │ │  Detector   │
    │  (Classic)  │ │  (Current)  │ │  (Stub)     │
    └─────────────┘ └─────────────┘ └─────────────┘
```

## Key Components

### 1. **CardDetector Interface** (`types.ts`)
Defines the contract that all detectors must implement:
- `initialize()`: Load and prepare the model
- `detect()`: Run detection on a video frame
- `getStatus()`: Check if detector is ready
- `dispose()`: Clean up resources

### 2. **OpenCVDetector** (`opencv-detector.ts`)
Classic edge-detection implementation:
- Uses Canny edge detection + contour finding
- Fast (~50-100ms per frame)
- No model download required
- Sensitive to lighting conditions

### 3. **DETRDetector** (`detr-detector.ts`)
Current default using DETR ResNet-50:
- Object detection with bounding boxes
- Filters by confidence, aspect ratio, and object class
- GPU-accelerated inference (WebGPU/WebGL)

### 4. **OWLViTDetector** (`owl-vit-detector.ts`)
Placeholder for future zero-shot detection:
- Text-prompt based detection ("Magic card")
- Better at specific object types
- Not yet implemented

### 4. **Factory** (`factory.ts`)
Creates detector instances with configuration:
- `createDetector(type, config)`: Create specific detector
- `createDefaultDetector()`: Use configured default
- `getDefaultDetectorType()`: Get active detector type

### 5. **Configuration** (`../detector-config.ts`)
Central configuration file:
- `ACTIVE_DETECTOR`: Switch between detectors
- `DETECTOR_OVERRIDES`: Customize detector settings

## How to Switch Detectors

### Option 1: Change Default Detector (Recommended)

Edit `apps/web/src/lib/detector-config.ts`:

```typescript
// Change from DETR to OWL-ViT
export const ACTIVE_DETECTOR: DetectorType = 'owl-vit'
```

### Option 2: Programmatic Selection

```typescript
import { createDetector } from '@/lib/detectors'

// Create DETR detector
const detrDetector = createDetector('detr', {
  confidenceThreshold: 0.6,
  onProgress: (msg) => console.log(msg)
})

// Create OWL-ViT detector (when implemented)
const owlDetector = createDetector('owl-vit', {
  confidenceThreshold: 0.3,
  prompts: ['Magic card', 'trading card']
})
```

### Option 3: Runtime Configuration

```typescript
import { createDetector } from '@/lib/detectors'

// Read from environment or user preferences
const detectorType = process.env.DETECTOR_TYPE || 'detr'
const detector = createDetector(detectorType)
```

## Adding a New Detector

To add a new detector (e.g., YOLO, Faster R-CNN):

### 1. Create Detector Class

```typescript
// detectors/yolo-detector.ts
import type { CardDetector, DetectorConfig, DetectionOutput } from './types'

export class YOLODetector implements CardDetector {
  private status: DetectorStatus = 'uninitialized'
  private model: any = null
  
  constructor(private config: DetectorConfig) {}
  
  async initialize(): Promise<void> {
    // Load YOLO model
    this.model = await loadYOLOModel(this.config.modelId)
    this.status = 'ready'
  }
  
  async detect(canvas, width, height): Promise<DetectionOutput> {
    // Run YOLO detection
    const detections = await this.model.detect(canvas)
    return this.filterAndConvert(detections, width, height)
  }
  
  getStatus() { return this.status }
  dispose() { this.model = null }
}
```

### 2. Update Factory

```typescript
// detectors/factory.ts
import { YOLODetector } from './yolo-detector'

const DEFAULT_CONFIGS: Record<DetectorType, Partial<DetectorConfig>> = {
  // ... existing configs
  'yolo': {
    modelId: 'Xenova/yolov8',
    confidenceThreshold: 0.5,
  }
}

export function createDetector(type: DetectorType, config?: Partial<DetectorConfig>) {
  switch (type) {
    // ... existing cases
    case 'yolo':
      return new YOLODetector(finalConfig)
  }
}
```

### 3. Update Types

```typescript
// detectors/types.ts
export type DetectorType = 'detr' | 'owl-vit' | 'yolo'
```

### 4. Export from Index

```typescript
// detectors/index.ts
export { YOLODetector } from './yolo-detector'
```

## Benefits of This Architecture

### ✅ **Separation of Concerns**
- Detection logic isolated from webcam orchestration
- Each detector is self-contained
- Easy to test detectors independently

### ✅ **Easy Switching**
- Change one line in config to switch detectors
- No changes to webcam.ts required
- Compare detectors side-by-side

### ✅ **Extensibility**
- Add new detectors without modifying existing code
- Implement custom detectors for specific use cases
- Mix and match detector features

### ✅ **Testability**
- Mock detectors for testing
- Test each detector in isolation
- Verify detector interface compliance

### ✅ **Configuration**
- Centralized detector settings
- Override defaults per detector type
- Runtime configuration support

## Current Status

| Detector | Status | Notes |
|----------|--------|-------|
| OpenCV | ✅ Implemented | Classic method, fast but lighting-sensitive |
| DETR | ✅ Implemented | Default, ML-based, robust |
| OWL-ViT | 🚧 Stub | Interface defined, needs implementation |

## Implementation Checklist for OWL-ViT

To implement OWL-ViT detector:

- [ ] Load OWL-ViT model from Hugging Face
- [ ] Implement zero-shot detection with text prompts
- [ ] Filter detections by confidence threshold
- [ ] Validate aspect ratio for MTG cards
- [ ] Convert to DetectedCard format
- [ ] Add unit tests
- [ ] Update documentation
- [ ] Benchmark performance vs DETR

## Performance Considerations

### OpenCV
- **Inference**: ~50-100ms per frame
- **Model Size**: ~1MB (library only)
- **GPU**: CPU-based (very fast)
- **Accuracy**: Good in controlled lighting, many false positives

### DETR
- **Inference**: ~200-500ms per frame
- **Model Size**: ~160MB
- **GPU**: Supports WebGPU/WebGL
- **Accuracy**: Good for general objects, fewer false positives

### OWL-ViT (Expected)
- **Inference**: ~300-700ms per frame
- **Model Size**: ~200MB
- **GPU**: Supports WebGPU/WebGL
- **Accuracy**: Best for specific objects with text prompts

## Example Usage

```typescript
// In your application code
import { setupWebcam } from '@/lib/webcam'

// Setup webcam with default detector (configured in detector-config.ts)
const webcam = await setupWebcam({
  video: videoElement,
  overlay: overlayCanvas,
  cropped: croppedCanvas,
  fullRes: fullResCanvas,
  onProgress: (msg) => console.log(msg),
  onCrop: () => console.log('Card cropped!')
})

// Start detection
await webcam.startVideo()

// Detection runs automatically using configured detector
```

## Testing

```typescript
// Mock detector for testing
class MockDetector implements CardDetector {
  getStatus() { return 'ready' }
  async initialize() {}
  async detect() {
    return {
      cards: [/* mock cards */],
      inferenceTimeMs: 100,
      rawDetectionCount: 5
    }
  }
  dispose() {}
}

// Use in tests
const detector = new MockDetector()
```

## Future Enhancements

- [ ] Add detector performance metrics
- [ ] Implement detector ensemble (combine multiple detectors)
- [ ] Add detector A/B testing framework
- [ ] Support custom detector plugins
- [ ] Add detector benchmarking tools
- [ ] Implement detector caching strategies

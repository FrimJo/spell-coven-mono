# Research: DETR Object Detection Integration

**Feature**: Replace OpenCV Card Detection with DETR  
**Date**: 2025-10-15  
**Status**: Complete

## Overview

This document consolidates research findings for replacing OpenCV edge detection with DETR (DEtection TRansformer) object detection in the MTG card recognition system.

## Decision 1: DETR Model Selection

**Decision**: Use `Xenova/detr-resnet-50` model from Transformers.js

**Rationale**:
- **Proven accuracy**: DETR achieves state-of-the-art object detection performance
- **Browser compatibility**: Xenova port optimized for WebGL/WASM execution
- **Reasonable size**: ~40MB model download (acceptable for first-time load)
- **Standard in Transformers.js**: Well-documented, actively maintained
- **Confidence scoring**: Returns scores for filtering low-confidence detections

**Alternatives Considered**:
1. **YOLOS (Xenova/yolos-tiny)**: Smaller (~20MB) but lower accuracy, less suitable for small objects like cards
2. **Custom fine-tuned model**: Would require training data collection, annotation, and hosting - violates browser-first principle
3. **OwlViT (zero-shot)**: Requires text prompts, adds complexity without clear benefit for fixed object type (cards)

**References**:
- Transformers.js docs: https://huggingface.co/docs/transformers.js
- DETR paper: "End-to-End Object Detection with Transformers" (Carion et al., 2020)
- Model card: https://huggingface.co/Xenova/detr-resnet-50

---

## Decision 2: Detection Pipeline Architecture

**Decision**: Replace OpenCV `detectCards()` loop with DETR pipeline, preserve cropping logic

**Rationale**:
- **Minimal disruption**: Cropping and perspective transformation logic already works well
- **Clear separation**: Detection (DETR) vs. extraction (existing OpenCV warpPerspective)
- **Testability**: Can test detection independently from cropping
- **Performance**: DETR handles detection; OpenCV handles geometric transforms (each tool for its strength)

**Implementation Pattern**:
```typescript
// OLD: OpenCV edge detection
function detectCards() {
  // Canny edge detection
  // findContours
  // approxPolyDP for 4-sided shapes
  // Filter by area and aspect ratio
}

// NEW: DETR object detection
async function detectCards() {
  // Run DETR inference every 500ms
  // Filter by confidence >= 0.5
  // Filter by aspect ratio (63:88 ±20%)
  // Convert bounding boxes to polygon points
}

// UNCHANGED: Cropping logic
function cropCardAt(x, y) {
  // Find closest detected card
  // Apply perspective transform
  // Extract to canvas
}
```

**Alternatives Considered**:
1. **Full rewrite with DETR-based cropping**: Unnecessary complexity, existing cropping works
2. **Hybrid OpenCV + DETR**: Adds complexity without clear benefit
3. **Keep OpenCV as fallback**: Increases bundle size, maintenance burden

---

## Decision 3: Inference Timing Strategy

**Decision**: Run DETR inference every 500ms (2 FPS) using `setInterval`

**Rationale**:
- **Performance balance**: 2 FPS provides responsive updates without excessive CPU load
- **User experience**: 500ms latency acceptable for users holding cards steady
- **Battery efficiency**: Lower inference rate conserves power on mobile devices
- **Smooth overlay**: Video rendering continues at full frame rate (30-60 FPS)

**Implementation Pattern**:
```typescript
let detectionInterval: number | null = null

function startDetection() {
  detectionInterval = setInterval(async () => {
    const frame = captureVideoFrame()
    const detections = await detector(frame, {
      threshold: 0.5,
      percentage: true
    })
    updateOverlay(detections)
  }, 500) // 2 FPS
}

function stopDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval)
    detectionInterval = null
  }
}
```

**Alternatives Considered**:
1. **Every frame (30-60 FPS)**: Too CPU intensive, causes UI lag
2. **Every 1000ms (1 FPS)**: Slower response time, less smooth experience
3. **requestAnimationFrame with throttling**: More complex, no clear benefit over setInterval

---

## Decision 4: Model Loading and Caching

**Decision**: Use Transformers.js built-in caching with progress callbacks

**Rationale**:
- **Zero configuration**: Transformers.js automatically caches models in IndexedDB
- **Standard pattern**: Same approach used for existing CLIP model
- **Progress feedback**: Built-in progress callbacks for UX
- **Offline support**: Cached models work offline after first download

**Implementation Pattern**:
```typescript
import { pipeline } from '@huggingface/transformers'

let detector: any = null

async function loadDetector(onProgress?: (msg: string) => void) {
  if (detector) return detector
  
  detector = await pipeline(
    'object-detection',
    'Xenova/detr-resnet-50',
    {
      progress_callback: (progress) => {
        if (progress.status === 'downloading') {
          onProgress?.(`Downloading: ${progress.file} - ${progress.progress}%`)
        }
      }
    }
  )
  
  return detector
}
```

**Alternatives Considered**:
1. **Manual IndexedDB management**: Unnecessary complexity, Transformers.js handles it
2. **Service Worker caching**: Overkill for single model, adds deployment complexity
3. **Preload on app start**: Delays initial page load, better to lazy load on webcam activation

---

## Decision 5: Aspect Ratio Filtering

**Decision**: Apply MTG card aspect ratio filter (63:88 ±20%) after DETR detection

**Rationale**:
- **Precision improvement**: Reduces false positives from non-card rectangles
- **Semantic + geometric**: Combines DETR's object understanding with geometric constraints
- **Configurable tolerance**: 20% tolerance handles perspective distortion
- **Post-processing**: Keeps DETR model generic, adds domain-specific logic separately

**Implementation Pattern**:
```typescript
const MTG_CARD_ASPECT_RATIO = 63 / 88 // ~0.716
const ASPECT_RATIO_TOLERANCE = 0.20

function filterCardDetections(detections: Detection[]): Detection[] {
  return detections.filter(det => {
    const { xmin, ymin, xmax, ymax } = det.box
    const width = xmax - xmin
    const height = ymax - ymin
    const aspectRatio = width / height
    
    const diff = Math.abs(aspectRatio - MTG_CARD_ASPECT_RATIO)
    const isValidAspect = diff / MTG_CARD_ASPECT_RATIO < ASPECT_RATIO_TOLERANCE
    
    return det.score >= 0.5 && isValidAspect
  })
}
```

**Alternatives Considered**:
1. **No aspect ratio filtering**: Increases false positives (phones, books)
2. **Stricter tolerance (±10%)**: May miss cards at steep angles
3. **Fine-tune DETR on MTG cards**: Requires training data, violates browser-first principle

---

## Decision 6: Error Handling Strategy

**Decision**: Graceful degradation with user-friendly error messages

**Rationale**:
- **User experience**: Clear errors better than silent failures or crashes
- **Offline support**: Detect network issues and guide users
- **Recovery**: Allow retry without page reload
- **Debugging**: Log errors for troubleshooting

**Error Scenarios**:
1. **Model load failure**: "Detection model unavailable - please check your internet connection"
2. **WebGL not supported**: "Your browser doesn't support required features for card detection"
3. **Inference error**: "Detection temporarily unavailable - retrying..."
4. **No detections**: Show "No cards detected" status (not an error)

**Implementation Pattern**:
```typescript
async function initDetection() {
  try {
    detector = await loadDetector(msg => setStatus(msg))
    startDetection()
  } catch (err) {
    if (err.message.includes('network')) {
      setError('Detection model unavailable - please connect to internet')
    } else if (err.message.includes('WebGL')) {
      setError('Your browser doesn\'t support card detection features')
    } else {
      setError('Failed to initialize detection - please refresh the page')
      console.error('Detection init error:', err)
    }
  }
}
```

**Alternatives Considered**:
1. **Silent failure with OpenCV fallback**: Increases complexity, bundle size
2. **Generic error messages**: Less helpful for users
3. **Automatic retry**: May spam network on persistent failures

---

## Best Practices: Transformers.js Object Detection

Based on official documentation and examples:

### 1. Pipeline Initialization
- Initialize pipeline once and reuse (singleton pattern)
- Use progress callbacks for UX feedback
- Handle initialization errors gracefully

### 2. Inference Optimization
- Batch processing not needed (single frame at a time)
- Use `percentage: true` for normalized coordinates (easier to scale)
- Set appropriate confidence threshold (0.5 is standard)

### 3. Memory Management
- Models cached automatically in IndexedDB
- No manual cleanup required
- Monitor memory usage in DevTools for large models

### 4. Browser Compatibility
- Requires WebGL support (check with `await env.backends.onnx.webgpu.isSupported()`)
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Fallback for older browsers: show compatibility message

### 5. Performance Monitoring
- Use Performance API to measure inference time
- Log slow inferences (>1000ms) for debugging
- Consider reducing inference rate if performance degrades

---

## Integration Points

### 1. Existing CLIP Pipeline
- **No changes required**: DETR outputs bounding boxes → cropping extracts card → CLIP identifies
- **Contract preserved**: Cropped canvas remains 315x440px
- **Data flow**: Video → DETR detection → User click → Crop → CLIP embedding → Database search

### 2. Video Overlay
- **Bounding box rendering**: Reuse existing `drawPolygon()` function
- **Coordinate conversion**: DETR uses percentages, convert to overlay canvas pixels
- **Visual feedback**: Green boxes for detected cards (existing pattern)

### 3. User Interaction
- **Click handling**: Existing `cropCardAt()` function unchanged
- **Selection logic**: Find closest detected card to click point (existing algorithm)
- **Feedback**: Show detection count in status message

---

## Testing Strategy

### Unit Tests
- DETR pipeline initialization
- Aspect ratio filtering logic
- Coordinate conversion (percentage → pixels)
- Error handling scenarios

### Integration Tests
- Model loading with mocked network
- Detection → cropping → identification flow
- Performance benchmarks (inference time, FPS)

### E2E Tests (Playwright)
- Card detection in various lighting conditions
- False positive filtering (phones, books)
- Model caching behavior
- Error recovery flows

---

## Performance Expectations

Based on DETR benchmarks and Transformers.js performance data:

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Model load (first) | <30s | Time from pipeline() call to ready |
| Model load (cached) | <5s | Time from pipeline() call to ready |
| Inference time | <500ms | Time per DETR forward pass |
| Detection latency | <2s | Time from card appearance to bounding box |
| Memory overhead | ~200MB | Chrome DevTools memory profiler |
| FPS impact | <5% | Compare video FPS before/after |

---

## Migration Path

### Phase 1: Replace Detection (P1 User Story)
1. Remove OpenCV initialization code
2. Add DETR pipeline initialization
3. Replace `detectCards()` with DETR inference loop
4. Update bounding box rendering for DETR output format
5. Test detection accuracy improvements

### Phase 2: Optimize Loading (P2 User Story)
1. Add progress callbacks to model loading
2. Update UI to show loading status
3. Test cached vs. first-load performance

### Phase 3: Refine Filtering (P3 User Story)
1. Implement aspect ratio filtering
2. Test false positive reduction
3. Tune tolerance if needed

### Rollback Plan
If DETR performance is unacceptable:
1. Revert webcam.ts to OpenCV version (git revert)
2. No other files affected (isolated change)
3. Document findings for future attempts

---

## Open Questions

None - all technical decisions resolved through clarification workflow.

---

## References

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [DETR Model Card](https://huggingface.co/Xenova/detr-resnet-50)
- [Object Detection Tutorial](https://huggingface.co/docs/transformers.js/tutorials/vanilla-js)
- [DETR Paper](https://arxiv.org/abs/2005.12872)
- [Existing webcam.ts](../../apps/web/src/lib/webcam.ts)
- [Existing search.ts (CLIP)](../../apps/web/src/lib/search.ts)

# Quickstart: DETR Card Detection Implementation

**Feature**: Replace OpenCV Card Detection with DETR  
**Date**: 2025-10-15  
**For**: Developers implementing this feature

## Overview

This guide provides a step-by-step implementation path for replacing OpenCV edge detection with DETR object detection in the MTG card recognition system.

---

## Prerequisites

- Node.js 18+ and pnpm installed
- Existing monorepo cloned and dependencies installed
- Familiarity with TypeScript, React, and Vite
- Basic understanding of Transformers.js and object detection

---

## Quick Start (5 minutes)

### 1. Verify Environment

```bash
cd apps/web
pnpm check-types  # Should pass
pnpm lint         # Should pass
```

### 2. Review Existing Code

```bash
# Primary file to modify
cat src/lib/webcam.ts

# Related files (no changes needed)
cat src/lib/search.ts
cat src/hooks/useCardQuery.ts
```

### 3. Run Existing Tests

```bash
pnpm e2e  # Playwright tests
pnpm test # Vitest tests
```

### 4. Start Development Server

```bash
pnpm dev  # Opens on http://localhost:3000
```

---

## Implementation Roadmap

### Phase 1: Core Detection (P1 User Story) - 4-6 hours

**Goal**: Replace OpenCV detection with DETR inference

**Steps**:

1. **Remove OpenCV dependencies** (30 min)
   - Remove OpenCV script loading from `webcam.ts`
   - Remove `ensureOpenCVScript()` function
   - Remove OpenCV Mat initialization (`initOpenCVMats()`)
   - Remove `cv` global references

2. **Add DETR pipeline initialization** (1 hour)
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

3. **Replace detectCards() function** (2 hours)
   ```typescript
   let detectionInterval: number | null = null
   
   async function detectCards() {
     if (!detector) return
     
     // Capture current video frame
     overlayCtx!.clearRect(0, 0, overlayEl.width, overlayEl.height)
     overlayCtx!.drawImage(videoEl, 0, 0, overlayEl.width, overlayEl.height)
     
     // Run DETR inference
     const detections = await detector(overlayEl, {
       threshold: 0.5,
       percentage: true
     })
     
     // Filter and render
     detectedCards = filterCardDetections(detections)
     renderDetections(detectedCards)
   }
   
   function startDetection() {
     detectionInterval = setInterval(detectCards, 500)
   }
   
   function stopDetection() {
     if (detectionInterval) {
       clearInterval(detectionInterval)
       detectionInterval = null
     }
   }
   ```

4. **Implement aspect ratio filtering** (1 hour)
   ```typescript
   const MTG_CARD_ASPECT_RATIO = 63 / 88
   const ASPECT_RATIO_TOLERANCE = 0.20
   
   function filterCardDetections(detections: any[]): DetectedCard[] {
     return detections
       .filter(det => {
         const { xmin, ymin, xmax, ymax } = det.box
         const width = xmax - xmin
         const height = ymax - ymin
         const aspectRatio = width / height
         
         const diff = Math.abs(aspectRatio - MTG_CARD_ASPECT_RATIO)
         const isValidAspect = diff / MTG_CARD_ASPECT_RATIO < ASPECT_RATIO_TOLERANCE
         
         return det.score >= 0.5 && isValidAspect
       })
       .map(det => ({
         box: det.box,
         score: det.score,
         aspectRatio: (det.box.xmax - det.box.xmin) / (det.box.ymax - det.box.ymin),
         polygon: boundingBoxToPolygon(det.box, overlayEl.width, overlayEl.height)
       }))
   }
   ```

5. **Update rendering** (30 min)
   ```typescript
   function renderDetections(cards: DetectedCard[]) {
     cards.forEach(card => {
       drawPolygon(overlayCtx!, card.polygon, 'lime', 3)
     })
   }
   
   function boundingBoxToPolygon(box: any, width: number, height: number) {
     return [
       { x: box.xmin * width, y: box.ymin * height },
       { x: box.xmax * width, y: box.ymin * height },
       { x: box.xmax * width, y: box.ymax * height },
       { x: box.xmin * width, y: box.ymax * height }
     ]
   }
   ```

6. **Update setupWebcam()** (30 min)
   - Call `loadDetector()` during initialization
   - Start detection interval after video ready
   - Add error handling

**Testing**:
```bash
# Type check
pnpm check-types

# Lint
pnpm lint

# Manual test
pnpm dev
# Navigate to webcam page, verify cards are detected
```

---

### Phase 2: Loading UX (P2 User Story) - 2-3 hours

**Goal**: Add progress feedback for model loading

**Steps**:

1. **Add status state** (30 min)
   ```typescript
   let loadingStatus: string = ''
   let statusCallback: ((msg: string) => void) | null = null
   
   function setStatus(msg: string) {
     loadingStatus = msg
     statusCallback?.(msg)
   }
   ```

2. **Update loadDetector() with progress** (1 hour)
   ```typescript
   async function loadDetector(onProgress?: (msg: string) => void) {
     if (detector) return detector
     
     statusCallback = onProgress || null
     setStatus('Loading detection model...')
     
     try {
       detector = await pipeline(
         'object-detection',
         'Xenova/detr-resnet-50',
         {
           progress_callback: (progress) => {
             if (progress.status === 'downloading') {
               setStatus(`Downloading: ${progress.file} - ${Math.round(progress.progress || 0)}%`)
             } else if (progress.status === 'done') {
               setStatus(`Loaded: ${progress.file}`)
             }
           }
         }
       )
       
       setStatus('Detection ready')
       return detector
     } catch (err) {
       setStatus('Failed to load detection model')
       throw err
     }
   }
   ```

3. **Connect to UI** (1 hour)
   - Pass progress callback from React component
   - Display loading status in UI
   - Show spinner during first load

**Testing**:
```bash
# Clear browser cache to test first-time load
# Open DevTools → Application → Clear storage
pnpm dev
# Verify progress messages appear
```

---

### Phase 3: Precision Filtering (P3 User Story) - 1-2 hours

**Goal**: Fine-tune aspect ratio filtering to reduce false positives

**Steps**:

1. **Add detection metrics** (30 min)
   ```typescript
   interface DetectionMetrics {
     totalDetections: number
     filteredByConfidence: number
     filteredByAspectRatio: number
     finalDetections: number
   }
   
   function collectMetrics(detections: any[]): DetectionMetrics {
     const total = detections.length
     const afterConfidence = detections.filter(d => d.score >= 0.5)
     const afterAspect = afterConfidence.filter(d => {
       const ar = (d.box.xmax - d.box.xmin) / (d.box.ymax - d.box.ymin)
       return validateCardAspectRatio(ar)
     })
     
     return {
       totalDetections: total,
       filteredByConfidence: total - afterConfidence.length,
       filteredByAspectRatio: afterConfidence.length - afterAspect.length,
       finalDetections: afterAspect.length
     }
   }
   ```

2. **Test with various objects** (1 hour)
   - Place phones, books, credit cards in view
   - Verify only MTG cards are detected
   - Adjust tolerance if needed

3. **Document findings** (30 min)
   - Record false positive rate
   - Note any edge cases
   - Update tolerance constant if needed

**Testing**:
```bash
# E2E test for false positives
pnpm e2e tests/e2e/card-identification.spec.ts
```

---

## Testing Strategy

### Unit Tests (Optional)

```typescript
// tests/unit/detection.test.ts
import { describe, it, expect } from 'vitest'
import { validateCardAspectRatio, computeAspectRatio } from '../contracts/detection-api'

describe('Aspect Ratio Validation', () => {
  it('accepts MTG card aspect ratio', () => {
    expect(validateCardAspectRatio(0.716)).toBe(true)
  })
  
  it('rejects phone aspect ratio', () => {
    expect(validateCardAspectRatio(0.5)).toBe(false)
  })
  
  it('accepts cards within tolerance', () => {
    expect(validateCardAspectRatio(0.6)).toBe(true)  // ~0.716 - 16%
    expect(validateCardAspectRatio(0.85)).toBe(true) // ~0.716 + 19%
  })
})
```

### E2E Tests

```typescript
// tests/e2e/card-identification.spec.ts
import { test, expect } from '@playwright/test'

test('detects MTG card in webcam stream', async ({ page }) => {
  await page.goto('/')
  
  // Grant camera permissions (mock)
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      // Return mock video stream
    }
  })
  
  // Wait for detection to initialize
  await expect(page.locator('[data-testid="detection-status"]'))
    .toHaveText('Detection ready', { timeout: 30000 })
  
  // Verify bounding boxes appear
  await expect(page.locator('canvas[data-testid="overlay"]'))
    .toBeVisible()
})
```

---

## Performance Monitoring

### Add Performance Metrics

```typescript
let performanceMetrics = {
  inferenceTime: [] as number[],
  detectionCount: [] as number[],
  fps: 0
}

async function detectCards() {
  const startTime = performance.now()
  
  // ... detection logic ...
  
  const endTime = performance.now()
  const inferenceTime = endTime - startTime
  
  performanceMetrics.inferenceTime.push(inferenceTime)
  performanceMetrics.detectionCount.push(detectedCards.length)
  
  // Log slow inferences
  if (inferenceTime > 1000) {
    console.warn(`Slow inference: ${inferenceTime}ms`)
  }
}

// Log metrics every 10 seconds
setInterval(() => {
  if (performanceMetrics.inferenceTime.length > 0) {
    const avg = performanceMetrics.inferenceTime.reduce((a, b) => a + b) / 
                performanceMetrics.inferenceTime.length
    console.log(`Avg inference time: ${avg.toFixed(0)}ms`)
    performanceMetrics.inferenceTime = []
  }
}, 10000)
```

---

## Troubleshooting

### Model Won't Load

**Symptom**: "Failed to load detection model" error

**Solutions**:
1. Check network connection
2. Verify Hugging Face CDN is accessible
3. Clear browser cache and reload
4. Check browser console for CORS errors

### Slow Inference

**Symptom**: Inference takes >1000ms

**Solutions**:
1. Check GPU acceleration is enabled
2. Reduce detection interval (e.g., 1000ms instead of 500ms)
3. Verify WebGL is working: `chrome://gpu`
4. Close other GPU-intensive tabs

### No Cards Detected

**Symptom**: Cards visible but no bounding boxes

**Solutions**:
1. Check confidence threshold (try lowering to 0.3)
2. Verify aspect ratio tolerance (try increasing to 0.3)
3. Check lighting conditions
4. Verify video feed is active

### False Positives

**Symptom**: Non-card objects detected

**Solutions**:
1. Increase confidence threshold (try 0.6 or 0.7)
2. Decrease aspect ratio tolerance (try 0.15)
3. Add additional filtering (e.g., minimum area)

---

## Verification Checklist

Before marking feature complete:

- [ ] OpenCV code completely removed
- [ ] DETR detection working in varied lighting
- [ ] Aspect ratio filtering reduces false positives
- [ ] Model loading shows progress feedback
- [ ] Cached model loads quickly (<5s)
- [ ] Detection runs at 2 FPS without UI lag
- [ ] Cropped cards work with CLIP identification
- [ ] Type checking passes (`pnpm check-types`)
- [ ] Linting passes (`pnpm lint`)
- [ ] E2E tests pass (`pnpm e2e`)
- [ ] Manual testing with real cards successful
- [ ] Performance metrics logged and acceptable
- [ ] Error handling tested (offline, WebGL disabled)
- [ ] Documentation updated

---

## Next Steps

After implementation:

1. **Measure success criteria** (from spec.md):
   - 30% accuracy improvement over OpenCV
   - 50% false positive reduction
   - <5s cached load time
   - 15+ FPS maintained

2. **Gather user feedback**:
   - Test with multiple users
   - Collect detection success rate data
   - Note any edge cases or issues

3. **Optimize if needed**:
   - Adjust confidence threshold
   - Fine-tune aspect ratio tolerance
   - Optimize inference interval

4. **Document learnings**:
   - Update research.md with findings
   - Add troubleshooting tips
   - Share performance data

---

## Resources

- [Transformers.js Docs](https://huggingface.co/docs/transformers.js)
- [DETR Model Card](https://huggingface.co/Xenova/detr-resnet-50)
- [Object Detection Tutorial](https://huggingface.co/docs/transformers.js/tutorials/vanilla-js)
- [Existing webcam.ts](../../apps/web/src/lib/webcam.ts)
- [Feature Spec](./spec.md)
- [Research Findings](./research.md)
- [Data Model](./data-model.md)
- [API Contract](./contracts/detection-api.ts)

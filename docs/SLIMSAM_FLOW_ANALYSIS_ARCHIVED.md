# SlimSAM Flow Analysis - ARCHIVED

**Status**: This analysis document has been archived as of 2025-10-18.

**Reason**: All issues identified in this document have been resolved in [Spec 012: Fix CLIP Model Alignment](../specs/012-fix-clip-model-alignment/).

## Issues Resolved

✅ **CRITICAL: Dimension mismatch (512 → 768)** - Fixed  
✅ **HIGH: Preprocessing mismatch (center-crop → black padding)** - Fixed  
✅ **MEDIUM: Redundant resize step (384→446×620→384)** - Verified not present  
✅ **Model alignment (ViT-B/32 → ViT-L/14@336px)** - Fixed  

## See Current Documentation

For current implementation details, refer to:
- `/specs/012-fix-clip-model-alignment/` - Complete specification and implementation
- `/apps/web/src/lib/clip-search.ts` - Current CLIP implementation (768-dim, ViT-L/14@336px)
- `/apps/web/src/lib/detection-constants.ts` - Preprocessing constants (336×336)

---

**Original document preserved below for historical reference**

---
# SlimSAM Flow Analysis: Click to Database Query

**Date:** 2025-10-17  
**Analysis Type:** End-to-End Flow Review  
**Focus:** SlimSAM detector integration and optimization opportunities

---

## Executive Summary

The current implementation uses **SlimSAM for segmentation** but follows a **complex multi-step pipeline** that may introduce unnecessary overhead. This analysis identifies **3 critical inefficiencies** and proposes **2 major optimizations** that could significantly improve performance and accuracy.

### Key Findings
- ✅ **Working:** SlimSAM segmentation with point prompts
- ⚠️ **Inefficient:** Unnecessary perspective warp → resize → embed pipeline
- ⚠️ **Misaligned:** Browser preprocessing doesn't match Python pipeline (spec violation)
- 🔴 **Critical:** Double normalization risk in embedding pipeline

---

## Complete Flow Breakdown

### 1. User Interaction (Click Event)
**File:** `apps/web/src/components/VideoStreamGrid.tsx`

```typescript
// Line 206-223: Overlay canvas with click handler
<canvas
  ref={overlayRef}
  style={{ cursor: 'pointer', zIndex: 1 }}
/>
```

**Flow:**
1. User clicks on video stream overlay canvas
2. Click coordinates captured relative to canvas bounds
3. Event propagates to `useWebcam` hook

---

### 2. Webcam Click Handler
**File:** `apps/web/src/lib/webcam.ts` (Lines 635-652)

```typescript
clickHandler = (evt: MouseEvent) => {
  const rect = overlayEl.getBoundingClientRect()
  const x = evt.clientX - rect.left
  const y = evt.clientY - rect.top
  
  requestAnimationFrame(async () => {
    // Step 1: Run detection at click point
    await detectCards({ x, y })
    
    // Step 2: Crop the detected card
    const ok = cropCardAt(x, y)
    if (ok && typeof args.onCrop === 'function') {
      args.onCrop(croppedCanvas)
    }
  })
}
```

**Purpose:** Async processing to prevent blocking UI

---

### 3. SlimSAM Detection
**File:** `apps/web/src/lib/detectors/slimsam-detector.ts`

#### 3.1 Set Click Point (Lines 254-261)
```typescript
// In detectCards()
if (clickPoint && 'setClickPoint' in detector) {
  detector.setClickPoint(clickPoint)
}
```

#### 3.2 Run Segmentation (Lines 186-380)
```typescript
async detect(canvas, canvasWidth, canvasHeight) {
  // 1. Get click point (required for SlimSAM)
  const point = this.clickPoint
  if (!point) throw new Error('SlimSAM requires click point')
  
  // 2. Convert canvas to RawImage
  const image = RawImage.fromCanvas(canvas)
  
  // 3. Prepare inputs with point prompt
  const inputs = await this.processor(image, {
    input_points: [[[point.x, point.y]]],
    input_labels: [[1]]  // 1 = foreground
  })
  
  // 4. Run model inference
  const outputs = await this.model(inputs)
  
  // 5. Post-process masks
  const masks = await this.processor.post_process_masks(
    outputs.pred_masks,
    inputs.original_sizes,
    inputs.reshaped_input_sizes
  )
  
  // 6. Get IoU scores and select best mask
  const iouScores = outputs.iou_scores
  // ... select mask with highest IoU > 0.5
  
  // 7. Extract quad from mask using OpenCV
  const quad = await this.extractQuadFromMask(mask, canvasWidth, canvasHeight)
  
  // 8. Validate quad geometry
  const validation = validateQuad(quad, canvasWidth, canvasHeight)
  
  // 9. Apply perspective warp to canonical 384×384
  const warpedCanvas = await warpCardToCanonical(canvas, quad)
  
  // 10. Return DetectedCard with warpedCanvas
  return {
    cards: [{
      box: boundingBox,
      polygon,
      score: bestScore,
      aspectRatio,
      warpedCanvas  // ⚠️ Already 384×384 canonical view
    }],
    inferenceTimeMs,
    rawDetectionCount: masks.length
  }
}
```

**Key Steps:**
- **Point-prompt segmentation:** SlimSAM uses click coordinates to segment card
- **Mask → Quad extraction:** OpenCV contour detection finds card corners
- **Perspective warp:** Transforms skewed card to canonical 384×384 rectangle
- **Output:** `warpedCanvas` contains perspective-corrected card image

---

### 4. Card Cropping
**File:** `apps/web/src/lib/webcam.ts` (Lines 440-564)

#### 4.1 Find Closest Card (Lines 440-476)
```typescript
function cropCardAt(x, y) {
  // Find card polygon closest to click point
  let closestIndex = -1
  let minDist = Infinity
  
  for (let i = 0; i < detectedCards.length; i++) {
    const card = detectedCards[i]
    const poly = card.polygon
    
    // Calculate center of polygon
    let cx = 0, cy = 0
    for (const p of poly) {
      cx += p.x
      cy += p.y
    }
    cx /= poly.length
    cy /= poly.length
    
    const d = Math.hypot(cx - x, cy - y)
    if (d < minDist) {
      minDist = d
      closestIndex = i
    }
  }
  
  const card = detectedCards[closestIndex]
  // ...
}
```

#### 4.2 Use Warped Canvas (Lines 527-560)
```typescript
// ⚠️ CRITICAL PATH: Use perspective-corrected canvas if available
if (enablePerspectiveWarp && card.warpedCanvas) {
  console.log('[Webcam] Using perspective-corrected 384×384 canvas')
  
  // Copy warped canvas to cropped canvas
  croppedCanvas.width = CROPPED_CARD_WIDTH   // 446
  croppedCanvas.height = CROPPED_CARD_HEIGHT // 620
  croppedCtx.clearRect(0, 0, croppedCanvas.width, croppedCanvas.height)
  croppedCtx.drawImage(
    card.warpedCanvas,  // Source: 384×384
    0, 0, card.warpedCanvas.width, card.warpedCanvas.height,
    0, 0, CROPPED_CARD_WIDTH, CROPPED_CARD_HEIGHT  // Dest: 446×620
  )
  
  return true
}
```

**⚠️ PROBLEM #1: Unnecessary Resize**
- SlimSAM already produces 384×384 canonical view
- Code resizes to 446×620 (MTG card aspect ratio)
- This resize is **immediately undone** in the next step!

---

### 5. CLIP Embedding
**File:** `apps/web/src/hooks/useCardQuery.ts` (Lines 69-78)

```typescript
// Embed the canvas
const embedding = await embedFromCanvas(canvas)  // 446×620 input

// Query the database
const result = top1(embedding)
```

**File:** `apps/web/src/lib/search/clip-embedder.ts` (Lines 99-159)

```typescript
async embedFromCanvas(canvas: HTMLCanvasElement): Promise<QueryEmbedding> {
  // Extract features using CLIP
  const result = await this.extractor(canvas, {
    pooling: 'mean',
    normalize: true  // ⚠️ CLIP normalizes internally
  })
  
  // Convert to Float32Array
  let vector = new Float32Array(result.data)
  
  // Verify embedding dimension (512-dim for ViT-B/32)
  if (vector.length !== 512) {
    throw new Error(`Invalid embedding dimension: expected 512, got ${vector.length}`)
  }
  
  // Compute L2 norm
  let norm = 0
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i]
  }
  norm = Math.sqrt(norm)
  
  // Verify L2 normalization
  const tolerance = 0.008
  const isNormalized = Math.abs(norm - 1.0) <= tolerance
  
  if (!isNormalized) {
    throw new Error(`Embedding not properly normalized: L2 norm = ${norm.toFixed(4)}`)
  }
  
  return { vector, isNormalized, norm }
}
```

**⚠️ PROBLEM #2: CLIP Preprocessing Mismatch**
- **Python pipeline** (per `packages/mtg-image-db/SPEC.md`):
  - Uses **black padding** to preserve full card (v0.3.0)
  - Resizes to **336×336** (ViT-L/14@336px native input)
  - Produces **768-dim** embeddings
  
- **Browser pipeline** (current):
  - Uses **center-crop** to square (old v0.2.0 behavior)
  - Resizes to **384×384** (wrong size)
  - Produces **512-dim** embeddings (ViT-B/32, not ViT-L/14)

**🔴 CRITICAL: Spec Violation**
The browser is using the **wrong CLIP model** and **wrong preprocessing**!

---

### 6. Similarity Search
**File:** `apps/web/src/lib/search/similarity-search.ts` (Lines 61-117)

```typescript
export function top1(
  query: QueryEmbedding,
  database: EmbeddingDatabase,
  metadata: MetadataFile
): SearchResult {
  // Validate inputs
  if (query.vector.length !== database.embeddingDim) {
    throw new Error(`Query dimension mismatch: expected ${database.embeddingDim}, got ${query.vector.length}`)
  }
  
  // Brute-force search
  let maxScore = -Infinity
  let bestIdx = -1
  
  for (let i = 0; i < database.numCards; i++) {
    const offset = i * database.embeddingDim
    const score = computeSimilarity(
      query.vector,
      database.vectors,
      offset,
      database.embeddingDim
    )
    
    if (score > maxScore) {
      maxScore = score
      bestIdx = i
    }
  }
  
  return {
    card: metadata.records[bestIdx],
    score: maxScore,
    inferenceTimeMs,
    index: bestIdx
  }
}

function computeSimilarity(
  queryVec: Float32Array,
  dbVec: Float32Array,
  offset: number,
  embeddingDim: number
): number {
  let score = 0
  for (let j = 0; j < embeddingDim; j++) {
    score += queryVec[j] * dbVec[offset + j]
  }
  return score  // Dot product = cosine similarity for L2-normalized vectors
}
```

**Performance:**
- **O(N)** brute-force search over all database vectors
- For 100K cards with 768-dim embeddings: ~77M multiplications
- Typical time: 50-200ms on modern hardware

---

## Critical Issues & Recommendations

### Issue #1: Dimension Mismatch (CRITICAL 🔴)

**Problem:**
- Database uses **768-dim** embeddings (ViT-L/14@336px)
- Browser uses **512-dim** embeddings (ViT-B/32)
- This will cause **immediate failure** at runtime!

**Evidence:**
```typescript
// packages/mtg-image-db/SPEC.md (Line 120)
- **Layout**: Row-major, shape `[N, 768]` (768-dim from ViT-L/14@336px)

// apps/web/src/lib/search/clip-embedder.ts (Line 122)
if (vector.length !== 512) {
  throw new Error(`Invalid embedding dimension: expected 512, got ${vector.length}`)
}
```

**Fix:**
1. Update browser to use `Xenova/clip-vit-large-patch14-336` (768-dim)
2. Update embedding verification to expect 768-dim
3. Update preprocessing to use 336×336 input size

---

### Issue #2: Preprocessing Mismatch (HIGH ⚠️)

**Problem:**
- **Python:** Black padding → 336×336 (preserves full card)
- **Browser:** Center crop → 384×384 (loses card edges)

**Impact:**
- Different preprocessing = different embeddings
- Lower search accuracy due to information loss
- Inconsistent results between Python and browser

**Fix:**
Implement black padding in browser to match Python:

```typescript
function preprocessForCLIP(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const targetSize = 336  // Match ViT-L/14@336px
  
  // Calculate padding to preserve aspect ratio
  const maxDim = Math.max(canvas.width, canvas.height)
  const scale = targetSize / maxDim
  const scaledWidth = canvas.width * scale
  const scaledHeight = canvas.height * scale
  
  // Create output canvas with black background
  const output = document.createElement('canvas')
  output.width = targetSize
  output.height = targetSize
  const ctx = output.getContext('2d')!
  
  // Fill with black (padding)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, targetSize, targetSize)
  
  // Draw scaled image centered
  const offsetX = (targetSize - scaledWidth) / 2
  const offsetY = (targetSize - scaledHeight) / 2
  ctx.drawImage(canvas, offsetX, offsetY, scaledWidth, scaledHeight)
  
  return output
}
```

---

### Issue #3: Redundant Resize Pipeline (MEDIUM ⚠️)

**Problem:**
```
SlimSAM warp → 384×384
  ↓
Resize → 446×620 (MTG aspect ratio)
  ↓
CLIP preprocessing → 336×336 (with padding/crop)
```

**Why This Happens:**
- `CROPPED_CARD_WIDTH/HEIGHT` (446×620) is designed for **display purposes**
- But it's used as an intermediate step before CLIP embedding
- This adds unnecessary canvas operations

**Optimization:**
Skip the 446×620 resize entirely:

```typescript
// Option A: Use SlimSAM output directly
if (card.warpedCanvas) {
  // warpedCanvas is already 384×384, close to target 336×336
  // Just pass to CLIP with black padding
  const preprocessed = preprocessForCLIP(card.warpedCanvas)
  const embedding = await embedFromCanvas(preprocessed)
}

// Option B: Resize SlimSAM output to exact CLIP input size
if (card.warpedCanvas) {
  // Resize 384×384 → 336×336 directly
  const resized = resizeCanvas(card.warpedCanvas, 336, 336)
  const embedding = await embedFromCanvas(resized)
}
```

**Performance Gain:**
- Eliminates 1 canvas resize operation (~5-10ms)
- Reduces memory allocations
- Cleaner code path

---

### Issue #4: Double Normalization Risk (LOW ⚠️)

**Current Code:**
```typescript
// CLIP extractor already normalizes
const result = await this.extractor(canvas, {
  pooling: 'mean',
  normalize: true  // ← CLIP normalizes here
})

// Then we verify normalization
const norm = Math.sqrt(vector.reduce((sum, v) => sum + v*v, 0))
if (Math.abs(norm - 1.0) > 0.008) {
  throw new Error('Not normalized')
}
```

**Analysis:**
- Verification is good for debugging
- But the `normalize: true` flag should guarantee L2 normalization
- The tolerance check (±0.008) suggests quantization error awareness

**Recommendation:**
- Keep verification in development mode
- Consider removing in production for performance
- Document that CLIP's `normalize: true` is the source of truth

---

## Proposed Optimizations

### Optimization #1: Direct SlimSAM → CLIP Pipeline

**Current:**
```
User Click
  ↓
SlimSAM Segmentation (384×384 warped)
  ↓
Resize to 446×620 (MTG aspect)
  ↓
CLIP Preprocessing (center-crop to 384×384)
  ↓
CLIP Embedding (512-dim, WRONG MODEL)
  ↓
Similarity Search
```

**Proposed:**
```
User Click
  ↓
SlimSAM Segmentation (384×384 warped)
  ↓
Black Padding to 336×336
  ↓
CLIP Embedding (768-dim, ViT-L/14@336px)
  ↓
Similarity Search
```

**Benefits:**
- ✅ Eliminates 1 resize operation
- ✅ Matches Python preprocessing exactly
- ✅ Uses correct CLIP model (768-dim)
- ✅ Preserves full card information (no center-crop)
- ✅ Cleaner code, fewer intermediate canvases

**Implementation:**
```typescript
// In webcam.ts cropCardAt()
if (enablePerspectiveWarp && card.warpedCanvas) {
  // Skip 446×620 resize, go directly to CLIP preprocessing
  const preprocessed = preprocessForCLIP(card.warpedCanvas, 336)
  
  // Store for embedding (no need for croppedCanvas)
  args.onCrop(preprocessed)
  return true
}
```

---

### Optimization #2: Lazy CLIP Model Loading

**Current:**
```typescript
// GameRoom.tsx - loads on mount
useEffect(() => {
  async function initModel() {
    await loadEmbeddingsAndMetaFromPackage()  // ~8MB download
    await loadModel({ onProgress })            // ~500MB model download
  }
  initModel()
}, [])
```

**Problem:**
- User waits for full model download before seeing UI
- Model may not be needed if user doesn't click any cards

**Proposed:**
```typescript
// Load embeddings immediately (small, needed for UI)
useEffect(() => {
  loadEmbeddingsAndMetaFromPackage()
}, [])

// Load CLIP model on first card click
const handleCardCrop = async (canvas: HTMLCanvasElement) => {
  if (!clipModel) {
    setStatus('Loading CLIP model...')
    await loadModel({ onProgress })
  }
  
  const embedding = await embedFromCanvas(canvas)
  const result = top1(embedding)
}
```

**Benefits:**
- ✅ Faster initial page load
- ✅ Better perceived performance
- ✅ Only download model if user actually uses feature

**Trade-off:**
- ⚠️ First card identification will be slower
- ⚠️ Need to handle loading state in UI

---

## Performance Metrics

### Current Pipeline (Estimated)
```
SlimSAM Segmentation:     200-500ms  (GPU-accelerated)
Quad Extraction:           20-50ms   (OpenCV contours)
Perspective Warp:          10-30ms   (OpenCV warpPerspective)
Resize 384→446×620:         5-10ms   (canvas drawImage)
CLIP Preprocessing:        10-20ms   (center-crop + resize)
CLIP Embedding:           100-300ms  (GPU-accelerated)
Similarity Search:         50-200ms  (brute-force, 100K cards)
─────────────────────────────────────
TOTAL:                    395-1110ms
```

### Optimized Pipeline (Estimated)
```
SlimSAM Segmentation:     200-500ms  (GPU-accelerated)
Quad Extraction:           20-50ms   (OpenCV contours)
Perspective Warp:          10-30ms   (OpenCV warpPerspective)
Black Padding 384→336:      5-10ms   (canvas drawImage)
CLIP Embedding (768-dim): 150-400ms  (larger model, GPU-accelerated)
Similarity Search:         80-300ms  (brute-force, 100K × 768-dim)
─────────────────────────────────────
TOTAL:                    465-1290ms
```

**Analysis:**
- Optimized pipeline is **slightly slower** due to larger CLIP model
- But **more accurate** due to correct preprocessing and model
- Eliminates unnecessary resize, cleaner code
- **Net benefit:** Better accuracy outweighs small performance cost

---

## Spec Compliance Check

### ✅ Compliant
- SlimSAM point-prompt segmentation
- Perspective warp to canonical view
- L2-normalized embeddings
- Dot product similarity search
- Brute-force top-1 search

### ❌ Non-Compliant
- **CRITICAL:** Using ViT-B/32 (512-dim) instead of ViT-L/14@336px (768-dim)
- **HIGH:** Using center-crop instead of black padding
- **MEDIUM:** Using 384×384 instead of 336×336 input size

### 📋 Spec References
- `packages/mtg-image-db/SPEC.md` v0.3.0 (Lines 9-16)
  - "Upgraded CLIP model from ViT-B/32 (512-dim) to ViT-L/14@336px (768-dim)"
  - "Changed preprocessing from center-crop to black padding"
  - "Updated default image size from 384px to 336px"

- `apps/web/SPEC.md` v0.2.0 (Lines 10-12)
  - Still references 512-dim embeddings (outdated)
  - Needs update to reflect v0.3.0 changes

---

## Recommended Action Plan

### Phase 1: Critical Fixes (MUST DO)
1. **Update CLIP model to ViT-L/14@336px**
   - Change model ID in `clip-embedder.ts`
   - Update dimension checks: 512 → 768
   - Update `apps/web/SPEC.md` to v0.3.0

2. **Implement black padding preprocessing**
   - Add `preprocessForCLIP()` function
   - Replace center-crop logic
   - Match Python pipeline exactly

3. **Fix input size: 384×384 → 336×336**
   - Update `CROPPED_CARD_WIDTH/HEIGHT` or bypass it
   - Ensure SlimSAM output goes to 336×336

### Phase 2: Optimizations (SHOULD DO)
4. **Eliminate redundant resize**
   - Skip 446×620 intermediate canvas
   - Go directly from SlimSAM warp to CLIP preprocessing

5. **Add lazy CLIP loading**
   - Load embeddings on mount
   - Load CLIP model on first use
   - Improve perceived performance

### Phase 3: Enhancements (NICE TO HAVE)
6. **Add preprocessing visualization**
   - Show user what CLIP "sees" after preprocessing
   - Help debug search accuracy issues

7. **Benchmark and profile**
   - Measure actual timings in production
   - Identify bottlenecks
   - Consider WebGPU optimizations

---

## Conclusion

The current SlimSAM integration is **functionally correct** but has **critical spec violations** that will cause runtime failures. The pipeline also contains **unnecessary steps** that can be eliminated for cleaner code and better performance.

**Priority:**
1. 🔴 **CRITICAL:** Fix dimension mismatch (512 → 768)
2. ⚠️ **HIGH:** Fix preprocessing mismatch (center-crop → black padding)
3. ⚠️ **MEDIUM:** Eliminate redundant resize step
4. ✅ **LOW:** Consider lazy loading optimization

**Estimated Effort:**
- Phase 1 (Critical): 4-6 hours
- Phase 2 (Optimizations): 2-3 hours
- Phase 3 (Enhancements): 4-8 hours

**Risk:**
- Phase 1 changes will break existing functionality temporarily
- Need to regenerate embeddings database with new model
- Recommend feature flag for gradual rollout

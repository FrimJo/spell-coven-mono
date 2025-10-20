# Card Image Logging Guide

This document describes the image blob logging added to track cards through the entire processing pipeline.

## Complete Card Flow with Logging

### Stage 1: OWL-ViT Detection & Crop
**File**: `src/lib/webcam.ts` (lines 413-436)
**When**: After user clicks on a card, OWL-ViT detects it and crops it

**Logs**:
```javascript
// 1. Extracted card region (before resize)
console.log('[Webcam] Extracted card region (before resize):', {
  url: 'blob:http://localhost:3000/...',
  dimensions: '640x896',
  blob: Blob
})

// 2. Final query image (336×336 with black padding)
console.log('[Webcam] Query image for database (336×336):', {
  url: 'blob:http://localhost:3000/...',
  dimensions: '336x336',
  blob: Blob
})
```

**What you see**: 
- Raw card crop from OWL-ViT detection
- Card resized to 336×336 with black padding (if needed to preserve aspect ratio)

---

### Stage 2: Canvas Passed to useCardQuery
**File**: `src/hooks/useCardQuery.ts` (lines 54-64)
**When**: Right after validation, before any rotation

**Log**:
```javascript
console.log('[useCardQuery] 🖼️ Card after OWL-ViT detection & crop (before rotation):', {
  url: 'blob:http://localhost:3000/...',
  dimensions: '336x336',
  blob: Blob
})
```

**What you see**: 
- The 336×336 card image as it enters the query pipeline
- This is the "canonical" card image before any transformations

---

### Stage 3: Contrast Enhancement (Optional)
**File**: `src/lib/clip-search.ts` (lines 434-456)
**When**: If `VITE_QUERY_CONTRAST > 1.0`, before CLIP inference

**Logs**:
```javascript
// With contrast enhancement enabled
console.log('[embedFromCanvas] 🖼️ Card after contrast enhancement:', {
  url: 'blob:http://localhost:3000/...',
  dimensions: '336x336',
  factor: 1.2,
  blob: Blob
})

// Without contrast enhancement
console.log('[embedFromCanvas] 🖼️ Card before CLIP embedding (no enhancement):', {
  url: 'blob:http://localhost:3000/...',
  dimensions: '336x336',
  blob: Blob
})
```

**What you see**: 
- Card with contrast enhancement applied (if enabled)
- Shows the exact image being sent to CLIP model
- Useful for debugging blurry card detection

---

### Stage 4: CLIP Embedding Complete
**File**: `src/lib/clip-search.ts` (lines 481-486)
**When**: After CLIP inference and L2 normalization

**Log**:
```javascript
console.log('[embedFromCanvas] ✅ Embedding complete:', {
  embeddingDim: 768,
  embeddingNorm: 0.9999,
  metrics: {
    contrast: 18,
    inference: 2150,
    normalization: 5,
    total: 2173
  }
})
```

**What you see**: 
- Embedding dimension (768 for ViT-L/14@336px)
- Embedding norm (should be ~1.0 for L2-normalized vectors)
- Timing breakdown of the embedding pipeline

---

## How to View Image Blobs in Browser Console

1. **Open DevTools**: `F12` or `Cmd+Option+I`
2. **Go to Console tab**
3. **Search for logs**: Filter by `🖼️` emoji or search for specific stage names
4. **Click the blob URL**: The console will show a clickable link
5. **Right-click → Open Link in New Tab**: View the image

## Example Console Output

```
[Webcam] Extracted card region (before resize): {
  url: "blob:http://localhost:3000/f1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6"
  dimensions: "640x896"
  blob: Blob(98765) {size: 98765, type: "image/png"}
}

[useCardQuery] 🖼️ Card after OWL-ViT detection & crop (before rotation): {
  url: "blob:http://localhost:3000/a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"
  dimensions: "336x336"
  blob: Blob(45678) {size: 45678, type: "image/png"}
}

[embedFromCanvas] 🖼️ Card before CLIP embedding (no enhancement): {
  url: "blob:http://localhost:3000/x1y2z3a4-b5c6-d7e8-f9g0-h1i2j3k4l5m6"
  dimensions: "336x336"
  blob: Blob(45678) {size: 45678, type: "image/png"}
}

[embedFromCanvas] ✅ Embedding complete: {
  embeddingDim: 768
  embeddingNorm: 0.9999
  metrics: {
    contrast: 0
    inference: 2150
    normalization: 5
    total: 2155
  }
}
```

## Debugging Tips

### Card looks wrong at Stage 2?
- Check OWL-ViT detection accuracy
- Verify card is fully visible in frame
- Try clicking closer to card center

### Card looks blurry at Stage 3?
- Enable contrast enhancement: `VITE_QUERY_CONTRAST=1.2 pnpm dev`
- Check webcam focus/lighting
- Try different camera angle

### Embedding norm not ~1.0?
- Check if L2 normalization is working
- Verify embedding dimension matches database (should be 768)
- Check for NaN or Infinity values

### Search returns wrong card?
- Compare embedding norm with expected ~1.0
- Check if contrast enhancement matches database build
- Verify database was built with same CLIP model

## Performance Metrics

The embedding stage logs detailed timing:

```javascript
metrics: {
  contrast: 18,        // Contrast enhancement (if enabled)
  inference: 2150,     // CLIP model inference
  normalization: 5,    // L2 normalization
  total: 2173          // Total embedding time
}
```

**Expected ranges**:
- **Contrast**: 10-20ms (if enabled)
- **Inference**: 1500-3000ms (depends on browser/GPU)
- **Normalization**: 1-10ms
- **Total**: 1500-3000ms

If inference is >5000ms, check:
- Browser CPU throttling
- Other tabs using GPU
- Model cache status
- WebGPU availability

## Files Modified

1. **src/lib/webcam.ts** (lines 413-436)
   - Logs extracted card region and final 336×336 query image

2. **src/hooks/useCardQuery.ts** (lines 54-64)
   - Logs card before rotation/processing

3. **src/lib/clip-search.ts** (lines 434-456, 481-486)
   - Logs card before/after contrast enhancement
   - Logs embedding completion with metrics

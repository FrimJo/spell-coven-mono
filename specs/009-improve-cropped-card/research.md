# Research: Improve Cropped Card Query Accuracy

**Feature**: 009-improve-cropped-card  
**Date**: 2025-10-16  
**Phase**: 0 (Research & Technical Decisions)

## Overview

This document consolidates research findings for aligning the browser preprocessing pipeline with the Python embedding generation pipeline. The core issue is a mismatch in image preprocessing that causes query embeddings to exist in a different space than database embeddings.

## Problem Analysis

### Current State

**Python Pipeline** (`packages/mtg-image-db/build_mtg_faiss.py` lines 122-135):
```python
def load_image_rgb(path: Path, target_size: int = 384) -> Optional[Image.Image]:
    img = Image.open(path).convert("RGB")
    # Simple square center-crop to be robust to non-uniform borders
    w, h = img.size
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    img = img.crop((left, top, left + s, top + s))
    if max(img.size) != target_size:
        img = img.resize((target_size, target_size), Image.BICUBIC)
    return img
```

**Browser Pipeline** (`apps/web/src/lib/webcam.ts` lines 331-396):
- Crops using DETR bounding box (rectangular, card aspect ratio ~0.72)
- Resizes to 446×620 (non-square)
- Passes to CLIP model

**Impact**: Embeddings computed from different image geometries produce poor similarity scores.

## Research Findings

### 1. Canvas API Center-Crop Implementation

**Decision**: Use Canvas `getImageData` and `putImageData` for center-crop

**Rationale**:
- Native browser APIs, no external dependencies
- Pixel-perfect control over crop region
- Maintains image quality (no compression artifacts)
- Consistent with Python PIL crop behavior

**Implementation Pattern**:
```typescript
// Calculate square crop dimensions
const minDim = Math.min(width, height)
const cropX = x + (width - minDim) / 2
const cropY = y + (height - minDim) / 2

// Extract square region
const imageData = ctx.getImageData(cropX, cropY, minDim, minDim)

// Create temp canvas for extracted region
const tempCanvas = document.createElement('canvas')
tempCanvas.width = minDim
tempCanvas.height = minDim
tempCtx.putImageData(imageData, 0, 0)

// Resize to target dimensions (384×384)
croppedCanvas.width = 384
croppedCanvas.height = 384
croppedCtx.drawImage(tempCanvas, 0, 0, 384, 384)
```

**Alternatives Considered**:
- CSS transforms: Rejected - doesn't provide pixel data for CLIP
- Third-party image libraries: Rejected - adds dependencies, unnecessary complexity
- Server-side preprocessing: Rejected - violates browser-first architecture

### 2. Target Dimensions Alignment

**Decision**: Use 384×384 pixels (matching Python `target_size` default)

**Rationale**:
- Exact match with Python pipeline default parameter
- CLIP model accepts any square input (internal preprocessing handles resizing)
- 384×384 provides good balance between quality and processing speed
- Verified in `build_embeddings.py` line 69: `target_size: int = 384`

**Alternatives Considered**:
- 224×224 (CLIP native): Rejected - Python pipeline uses 384, must match
- 512×512 (higher quality): Rejected - Python pipeline uses 384, must match
- Keep 446×620: Rejected - this is the root cause of the bug

### 3. CLIP Preprocessing Consistency

**Decision**: Rely on Transformers.js internal preprocessing (no custom normalization)

**Rationale**:
- Transformers.js `Xenova/clip-vit-base-patch32` uses same preprocessing as Python OpenAI CLIP
- Both apply: resize to 224×224, center crop, normalize to [-1, 1]
- Input image geometry (square vs rectangle) affects internal center-crop behavior
- By providing square input, we ensure consistent internal processing

**Verification**:
- Python: `clip.load("ViT-B/32")` applies standard CLIP preprocessing
- Browser: `pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32')` applies same preprocessing
- Both L2-normalize output embeddings

**Key Insight**: The bug isn't in CLIP preprocessing itself, but in the *input geometry* we provide. Square inputs ensure CLIP's internal center-crop behaves identically.

### 4. Image Quality Preservation

**Decision**: Crop from full-resolution video frame before any resizing

**Rationale**:
- Current implementation already does this correctly (`fullResCanvas` at `videoEl.videoWidth × videoEl.videoHeight`)
- Maintains maximum quality before downscaling
- Reduces compression artifacts

**Best Practices**:
- Use `willReadFrequently: true` for contexts that read pixel data frequently
- Use `imageSmoothingEnabled: true` (default) for high-quality downscaling
- Consider `imageSmoothingQuality: 'high'` for better bicubic interpolation

### 5. Validation and Debugging

**Decision**: Add preprocessing validation warnings in `search.ts`

**Rationale**:
- Helps developers catch preprocessing errors early
- Provides user-facing feedback when image quality may affect results
- Maintains debugging capability for future issues

**Implementation**:
```typescript
export async function embedFromCanvas(canvas: HTMLCanvasElement) {
  if (!extractor) throw new Error('Model not loaded')
  
  // Validate canvas is square (matching Python preprocessing)
  if (canvas.width !== canvas.height) {
    console.warn(
      `[search] Canvas should be square for optimal matching. ` +
      `Got ${canvas.width}×${canvas.height}. Results may be inaccurate.`
    )
  }
  
  // Validate target dimensions
  if (canvas.width !== 384 || canvas.height !== 384) {
    console.warn(
      `[search] Canvas dimensions should be 384×384 to match database preprocessing. ` +
      `Got ${canvas.width}×${canvas.height}.`
    )
  }
  
  const out = await extractor(canvas)
  return l2norm(Float32Array.from(out.data))
}
```

### 6. Testing Strategy

**Decision**: Manual validation with test card set + Playwright integration test

**Rationale**:
- Accuracy testing requires ground truth (known cards)
- Playwright can automate preprocessing validation
- Manual testing needed for visual quality assessment

**Test Plan**:
1. **Baseline Measurement**: Test 100 diverse cards with current implementation
2. **Implementation**: Apply preprocessing fixes
3. **Validation**: Re-test same 100 cards, measure improvement
4. **Playwright Test**: Verify canvas dimensions and preprocessing warnings

**Test Card Selection Criteria**:
- Diverse sets (old/new frames)
- Various art styles (dark/light, busy/simple)
- Different card types (creatures, spells, lands)
- Include foils and special treatments if available

## Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Crop Strategy | Square center-crop (min dimension) | Matches Python pipeline exactly |
| Target Dimensions | 384×384 pixels | Matches Python `target_size` default |
| Canvas API | `getImageData` + `putImageData` | Native, no dependencies, pixel-perfect |
| Resize Method | `drawImage` with default smoothing | High-quality bicubic interpolation |
| Validation | Warnings in `embedFromCanvas` | Early error detection, debugging aid |
| Testing | Manual + Playwright | Accuracy validation + regression prevention |

## Implementation Risks and Mitigations

### Risk 1: Performance Regression
**Likelihood**: Low  
**Impact**: Medium  
**Mitigation**: Center-crop adds minimal overhead (<10ms). Benchmark before/after.

### Risk 2: Edge Cases (Very Wide/Tall Cards)
**Likelihood**: Low  
**Impact**: Low  
**Mitigation**: Center-crop handles all aspect ratios correctly. Test with extreme cases.

### Risk 3: Browser Compatibility
**Likelihood**: Very Low  
**Impact**: Medium  
**Mitigation**: Canvas API is universally supported. Test on Chrome, Firefox, Safari.

## Open Questions

None - all technical decisions resolved through code analysis and API documentation.

## References

- Python preprocessing: `packages/mtg-image-db/build_mtg_faiss.py` lines 122-135
- Browser cropping: `apps/web/src/lib/webcam.ts` lines 331-396
- CLIP model: Transformers.js `Xenova/clip-vit-base-patch32`
- Canvas API: MDN Web Docs (getImageData, putImageData, drawImage)
- Embedding validation: `packages/mtg-image-db/build_embeddings.py` lines 227-234

## Next Steps

Proceed to Phase 1: Design & Contracts
- Generate data-model.md (minimal - no new entities)
- Document preprocessing pipeline contract
- Create quickstart.md for testing

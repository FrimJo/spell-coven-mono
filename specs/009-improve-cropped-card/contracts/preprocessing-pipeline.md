# Preprocessing Pipeline Contract

**Feature**: 009-improve-cropped-card  
**Version**: 1.0  
**Date**: 2025-10-16

## Purpose

This contract defines the preprocessing pipeline that MUST be applied to card images before CLIP embedding generation. Both Python (database generation) and browser (query) implementations MUST follow this contract to ensure embedding space alignment.

## Contract Requirements

### Input: Raw Card Image
- **Format**: RGB image (any dimensions)
- **Source**: Scryfall download (Python) or webcam/upload (browser)
- **Quality**: Minimum 200×200 pixels recommended

### Transformation Sequence

#### Step 1: Center-Crop to Square
**Operation**: Extract square region from center of image

**Algorithm**:
```
minDim = min(width, height)
cropX = (width - minDim) / 2
cropY = (height - minDim) / 2
squareImage = crop(image, cropX, cropY, minDim, minDim)
```

**Rationale**: Removes letterboxing/pillarboxing while preserving card artwork. Centers the crop to capture the most important visual features.

**Python Implementation**:
```python
w, h = img.size
s = min(w, h)
left = (w - s) // 2
top = (h - s) // 2
img = img.crop((left, top, left + s, top + s))
```

**Browser Implementation**:
```typescript
const minDim = Math.min(width, height)
const cropX = x + (width - minDim) / 2
const cropY = y + (height - minDim) / 2
const imageData = ctx.getImageData(cropX, cropY, minDim, minDim)
```

#### Step 2: Resize to Target Dimensions
**Operation**: Scale square image to 384×384 pixels

**Algorithm**:
```
targetImage = resize(squareImage, 384, 384, method=BICUBIC)
```

**Rationale**: Standardizes input size for CLIP model. 384×384 provides good balance between quality and processing speed.

**Python Implementation**:
```python
img = img.resize((384, 384), Image.BICUBIC)
```

**Browser Implementation**:
```typescript
croppedCanvas.width = 384
croppedCanvas.height = 384
croppedCtx.drawImage(tempCanvas, 0, 0, 384, 384)
// Uses default imageSmoothingEnabled=true (bicubic)
```

#### Step 3: CLIP Internal Preprocessing
**Operation**: Applied automatically by CLIP model

**Algorithm** (internal to CLIP):
```
1. Resize to 224×224
2. Center crop to 224×224 (no-op since already square)
3. Normalize to [-1, 1] range
4. Convert to tensor
```

**Rationale**: CLIP's internal preprocessing is consistent across implementations. By providing square 384×384 input, we ensure the internal center-crop behaves identically.

### Output: Embedding Vector
- **Format**: Float32Array, 512 dimensions
- **Normalization**: L2-normalized (||v|| = 1.0)
- **Quantization**: int8 for storage (browser), float32 for computation

## Validation Rules

### Pre-Embedding Validation
1. **Square Check**: `width === height` MUST be true
2. **Dimension Check**: `width === 384 && height === 384` SHOULD be true
3. **Empty Check**: Image MUST contain valid pixel data

### Post-Embedding Validation
1. **Dimension Check**: Embedding MUST be 512 dimensions
2. **Normalization Check**: `||embedding|| ≈ 1.0` (within 1e-5 tolerance)
3. **Value Range**: All values SHOULD be in [-1, 1] range (typical for L2-normalized CLIP embeddings)

## Error Handling

### Validation Failures

**Non-Square Input**:
```
Error: "Preprocessing validation failed: Canvas must be square. Got {width}×{height}."
Action: Log warning, continue with degraded accuracy
```

**Wrong Dimensions**:
```
Warning: "Canvas dimensions should be 384×384 to match database preprocessing. Got {width}×{height}."
Action: Log warning, continue with degraded accuracy
```

**Empty or Corrupted Image**:
```
Error: "Preprocessing validation failed: Image data is empty or corrupted."
Action: Throw error, abort embedding
```

**Embedding Dimension Mismatch**:
```
Error: "CLIP model returned unexpected embedding dimensions. Expected 512, got {actual}."
Action: Throw error, abort query
```

## Compatibility Matrix

| Implementation | Language | CLIP Library | Preprocessing | Status |
|----------------|----------|--------------|---------------|--------|
| Database Generation | Python 3.11 | OpenAI CLIP | Square center-crop → 384×384 | ✅ Reference |
| Browser Query (Before Fix) | TypeScript 5.x | Transformers.js | Rectangle → 446×620 | ❌ Misaligned |
| Browser Query (After Fix) | TypeScript 5.x | Transformers.js | Square center-crop → 384×384 | ✅ Aligned |

## Testing Contract

### Unit Tests
1. **Test**: Center-crop calculation
   - Input: 1000×800 image
   - Expected: 800×800 crop at (100, 0)

2. **Test**: Center-crop calculation (tall image)
   - Input: 600×900 image
   - Expected: 600×600 crop at (0, 150)

3. **Test**: Resize to target
   - Input: 800×800 square
   - Expected: 384×384 square

### Integration Tests
1. **Test**: Database self-query
   - Input: Card image from database
   - Expected: Top result is itself with score >0.95

2. **Test**: Preprocessing validation warnings
   - Input: Non-square canvas (446×620)
   - Expected: Warning logged, embedding still generated

3. **Test**: Cross-method consistency
   - Input: Same card via webcam and upload
   - Expected: Top-3 results match

## Version History

- **v1.0** (2025-10-16): Initial contract defining square center-crop → 384×384 pipeline

## References

- Python implementation: `packages/mtg-image-db/build_mtg_faiss.py` lines 122-135
- Browser implementation: `apps/web/src/lib/webcam.ts` (to be updated)
- CLIP model: `Xenova/clip-vit-base-patch32` (Transformers.js)
- Validation: `apps/web/src/lib/search.ts` (to be updated)

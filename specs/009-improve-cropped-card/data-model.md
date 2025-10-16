# Data Model: Improve Cropped Card Query Accuracy

**Feature**: 009-improve-cropped-card  
**Date**: 2025-10-16  
**Phase**: 1 (Design & Contracts)

## Overview

This feature does not introduce new data entities or modify existing data structures. It fixes a preprocessing pipeline bug by aligning image transformation logic between Python and browser implementations.

## Existing Entities (No Changes)

### Card Image
**Source**: Webcam video frame or uploaded file  
**Attributes**:
- Raw dimensions (width × height in pixels)
- Pixel data (RGB values)
- Source type (webcam, upload, database)

**Preprocessing States**:
1. **Raw**: Original captured/uploaded image
2. **Cropped**: Bounding box extracted from full frame
3. **Center-Cropped**: Square region extracted (min dimension)
4. **Resized**: Scaled to 384×384 pixels
5. **Normalized**: Ready for CLIP embedding

**Changes**: Preprocessing pipeline modified to include center-crop step (state 3)

### Embedding Vector
**Source**: CLIP ViT-B/32 model output  
**Attributes**:
- Dimensions: 512 float32 values
- Normalization: L2-normalized (||v|| = 1.0)
- Quantization: int8 in database, float32 in memory

**Changes**: None - embedding format unchanged

### Query Result
**Source**: Similarity search output  
**Attributes**:
- Card metadata (name, set, image_url, card_url)
- Similarity score (cosine similarity, range [0, 1])
- Rank (position in top-K results)

**Changes**: None - result format unchanged

## Preprocessing Pipeline Contract

### Input Contract
**From**: DETR detector (`detectedCards[i].box`)  
**Format**: Normalized bounding box
```typescript
{
  xmin: number  // [0, 1] normalized
  ymin: number  // [0, 1] normalized
  xmax: number  // [0, 1] normalized
  ymax: number  // [0, 1] normalized
}
```

### Output Contract
**To**: CLIP embedding function (`embedFromCanvas`)  
**Format**: HTMLCanvasElement
```typescript
{
  width: 384      // pixels (square)
  height: 384     // pixels (square)
  context: '2d'   // rendering context
  // Pixel data: RGB values ready for CLIP preprocessing
}
```

**Validation Rules**:
- MUST be square (width === height)
- SHOULD be 384×384 pixels (matching Python pipeline)
- MUST contain valid RGB pixel data
- MUST NOT be empty or corrupted

### Preprocessing Transformation Sequence

```
1. Extract bounding box from full-resolution video frame
   Input:  fullResCanvas (videoWidth × videoHeight)
   Output: Rectangular region (boxWidth × boxHeight)

2. Calculate square crop dimensions
   minDim = min(boxWidth, boxHeight)
   cropX = x + (boxWidth - minDim) / 2
   cropY = y + (boxHeight - minDim) / 2

3. Extract square region
   Input:  Rectangular card region
   Output: Square region (minDim × minDim)

4. Resize to target dimensions
   Input:  Square region (minDim × minDim)
   Output: croppedCanvas (384 × 384)
   Method: Canvas.drawImage with bicubic interpolation

5. Pass to CLIP embedding
   Input:  croppedCanvas (384 × 384)
   Output: Embedding vector (512-dim, L2-normalized)
```

### Alignment with Python Pipeline

**Python** (`build_mtg_faiss.py`):
```python
# Step 1: Load image
img = Image.open(path).convert("RGB")

# Step 2: Center-crop to square
w, h = img.size
s = min(w, h)
left = (w - s) // 2
top = (h - s) // 2
img = img.crop((left, top, left + s, top + s))

# Step 3: Resize to target
img = img.resize((target_size, target_size), Image.BICUBIC)
# target_size = 384 (default)

# Step 4: CLIP preprocessing (internal)
# - Resize to 224×224
# - Center crop
# - Normalize to [-1, 1]
```

**Browser** (after fix):
```typescript
// Step 1: Extract bounding box region
const width = (box.xmax - box.xmin) * fullResCanvas.width
const height = (box.ymax - box.ymin) * fullResCanvas.height

// Step 2: Center-crop to square
const minDim = Math.min(width, height)
const cropX = x + (width - minDim) / 2
const cropY = y + (height - minDim) / 2

// Step 3: Resize to target
croppedCanvas.width = 384
croppedCanvas.height = 384
croppedCtx.drawImage(tempCanvas, 0, 0, 384, 384)

// Step 4: CLIP preprocessing (internal, via Transformers.js)
// - Resize to 224×224
// - Center crop
// - Normalize to [-1, 1]
```

**Key Alignment**: Both pipelines now produce 384×384 square images before CLIP internal preprocessing.

## Validation Contract

### Preprocessing Validation
**Location**: `apps/web/src/lib/search.ts`  
**Function**: `embedFromCanvas`

**Validation Rules**:
1. Canvas MUST be square (width === height)
2. Canvas SHOULD be 384×384 pixels
3. Canvas MUST NOT be empty

**Error Handling**:
- Non-square canvas: Log warning, continue (degraded accuracy)
- Wrong dimensions: Log warning, continue (degraded accuracy)
- Empty canvas: Throw error (cannot embed)

**Warning Messages**:
```typescript
// Non-square warning
"Canvas should be square for optimal matching. Got {width}×{height}. Results may be inaccurate."

// Wrong dimensions warning
"Canvas dimensions should be 384×384 to match database preprocessing. Got {width}×{height}."
```

## State Transitions

### Before Fix
```
Video Frame → DETR Detection → Rectangular Crop (446×620) → CLIP Embedding
                                      ↑
                                   MISMATCH
                                      ↓
Database Cards → Square Crop (384×384) → CLIP Embedding
```

### After Fix
```
Video Frame → DETR Detection → Rectangular Crop → Square Center-Crop (384×384) → CLIP Embedding
                                                              ↑
                                                           ALIGNED
                                                              ↓
Database Cards → Square Crop (384×384) → CLIP Embedding
```

## No New Storage Requirements

This feature modifies in-memory image processing only. No persistent storage changes required.

## No New API Contracts

This feature modifies internal preprocessing logic. No external API changes required.

## Summary

This feature introduces no new data entities. It modifies the preprocessing pipeline to align browser and Python implementations, ensuring both produce 384×384 square images before CLIP embedding. The fix is entirely internal to the `webcam.ts` module with validation added to `search.ts`.

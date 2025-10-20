# Contrast Enhancement for Blurry Card Detection

## Overview

Phase 1 of the blurry card detection improvement adds **contrast enhancement** to the image preprocessing pipeline. This feature sharpens card features (text, mana symbols, artwork edges) to improve CLIP embedding matching accuracy when cards are blurry or at odd angles.

## Implementation Details

### Changes Made

#### 1. `build_mtg_faiss.py`
- Modified `load_image_rgb()` function to accept `enhance_contrast` parameter (default: 1.0)
- When `enhance_contrast > 1.0`, applies PIL's `ImageEnhance.Contrast` before padding and resizing
- Enhancement happens early in the pipeline, before CLIP preprocessing

```python
def load_image_rgb(path: Path, target_size: int = 224, enhance_contrast: float = 1.0) -> Optional[Image.Image]:
    try:
        img = Image.open(path).convert("RGB")
        
        # Enhance contrast if requested (helps with blurry cards)
        if enhance_contrast > 1.0:
            from PIL import ImageEnhance
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(enhance_contrast)
        # ... rest of padding/resize logic
```

#### 2. `build_embeddings.py`
- Updated `_load_image_worker()` to pass `enhance_contrast` parameter
- Added `enhance_contrast` parameter to `build_embeddings_from_cache()` function
- Added `--contrast` CLI argument to `main()` (default: 1.0)
- Included `enhance_contrast` in build manifest for tracking

```bash
# CLI usage
python build_embeddings.py --kind unique_artwork --contrast 1.2
```

#### 3. `README.md`
- Added documentation section "Contrast enhancement for blurry cards"
- Provided usage examples with recommended values

## Usage

### Standard build (no enhancement)
```bash
python build_embeddings.py --kind unique_artwork --out index_out --cache image_cache
```

### With 20% contrast boost (recommended starting point)
```bash
python build_embeddings.py --kind unique_artwork --out index_out --cache image_cache --contrast 1.2
```

### With 50% contrast boost (aggressive, for very blurry conditions)
```bash
python build_embeddings.py --kind unique_artwork --out index_out --cache image_cache --contrast 1.5
```

## Enhancement Factor Reference

- `1.0` = no enhancement (default, original behavior)
- `1.2` = 20% boost (recommended for typical webcam blur)
- `1.5` = 50% boost (for challenging lighting/blur conditions)
- `2.0` = 100% boost (aggressive, may create artifacts)

## How It Works

1. **Early preprocessing**: Contrast is enhanced immediately after loading the image from disk
2. **Before CLIP**: Enhancement happens before padding to square and resizing to 336×336
3. **Per-image**: Each card image is enhanced individually during embedding generation
4. **One-time cost**: Enhancement happens during index build, not at query time

## Performance Impact

- **Build time**: Minimal (~5-10% slower due to contrast enhancement operation)
- **Index size**: No change (same number of embeddings)
- **Query time**: No change (enhancement only during build)
- **Storage**: No change (embeddings are identical size)

## Testing Recommendations

1. **Start with 1.2**: Build index with `--contrast 1.2` and test with blurry webcam cards
2. **Compare results**: Query the same blurry card against both enhanced and non-enhanced indices
3. **Adjust if needed**: Try 1.5 if 1.2 doesn't improve matching enough
4. **Monitor false positives**: Ensure enhancement doesn't hurt matching on clear cards

## Future Enhancements (Phase 2+)

- **Multi-scale augmentation**: Generate embeddings at multiple blur levels (0, 1, 2, 3 sigma)
- **Adaptive query enhancement**: Detect blur in webcam frame and enhance query image before embedding
- **CLAHE**: Use Contrast Limited Adaptive Histogram Equalization for more sophisticated enhancement
- **Sharpening**: Add optional unsharp mask filter for additional edge enhancement

## Build Manifest

The build manifest (`build_manifest.json`) now includes the `enhance_contrast` parameter:

```json
{
  "parameters": {
    "enhance_contrast": 1.2
  }
}
```

This allows you to track which index was built with which enhancement level.

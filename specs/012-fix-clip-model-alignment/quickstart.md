# Quickstart: CLIP Model Alignment & Pipeline Optimization

**Feature**: 012-fix-clip-model-alignment  
**Branch**: `012-fix-clip-model-alignment`  
**Status**: Implementation Ready

## Overview

Fix critical CLIP model dimension mismatch (512→768), align preprocessing with Python pipeline, and optimize SlimSAM→CLIP pipeline by removing redundant resize operations.

---

## Prerequisites

- Node.js 18+ with pnpm
- TypeScript 5.x
- Modern browser with WebGPU/WebGL support
- Python 3.11+ (for regenerating embeddings)

---

## Quick Start

### 1. Checkout Feature Branch

```bash
git checkout 012-fix-clip-model-alignment
cd apps/web
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Regenerate Embeddings (Required)

The database must be regenerated with 768-dim embeddings:

```bash
cd ../../packages/mtg-image-db

# Generate embeddings with ViT-L/14@336px (default)
python build_embeddings.py --kind unique_artwork

# Export for browser
python export_for_browser.py

# Verify output
ls -lh index_out/
# Should see:
# - embeddings.bin (N * 768 bytes)
# - meta.json (shape [N, 768])
```

### 4. Run Development Server

```bash
cd ../../apps/web
pnpm dev
```

Open http://localhost:3000

### 5. Test Card Recognition

1. Navigate to game room
2. Click on a card in video stream
3. **First click**: Model downloads (~500MB, shows progress)
4. **Subsequent clicks**: Use cached model (instant)
5. Verify search results are accurate

---

## Key Changes

### Model Upgrade

**Before**: `Xenova/clip-vit-base-patch32` (512-dim)  
**After**: `Xenova/clip-vit-large-patch14-336` (768-dim)

**Files Changed**:
- `src/lib/search/clip-embedder.ts` - Update model ID
- `src/lib/search/clip-search.ts` - Update model ID
- `src/lib/validation/contract-validator.ts` - Update dimension validation

### Preprocessing Alignment

**Before**: Center-crop (loses card edges)  
**After**: Black padding (preserves full card)

**Implementation**: Transformers.js automatic preprocessing (no manual code needed)

**Verification**: Visual inspection + embedding similarity ≥0.95

### Pipeline Optimization

**Before**: SlimSAM (384×384) → Resize (446×620) → CLIP (336×336)  
**After**: SlimSAM (384×384) → CLIP (336×336)

**Files Changed**:
- Remove any code creating 446×620 intermediate canvas
- Update `CROPPED_CARD_WIDTH/HEIGHT` constants to 336

### Lazy Loading

**Before**: Model loads on page load (blocks initial render)  
**After**: Model loads on first card click (improves page load by ~2s)

**Files Changed**:
- `src/lib/search/clip-embedder.ts` - Add lazy initialization
- UI components - Add loading indicators

---

## Testing

### Manual Testing

#### Test 1: Dimension Validation
```bash
# Open browser console
# Click a card
# Verify: "Embedding dimension: 768" (not 512)
```

#### Test 2: Preprocessing Alignment
```bash
# Process same card in Python and browser
# Export preprocessed images
# Visual inspection: Should look identical (black padding, 336×336)
```

#### Test 3: Lazy Loading
```bash
# Open Network tab
# Load page
# Verify: No CLIP model download on page load
# Click card
# Verify: Model downloads with progress indicator
# Click another card
# Verify: No re-download (uses cached model)
```

#### Test 4: Error Handling
```bash
# Simulate network failure (throttle to offline)
# Click card
# Verify: Retry attempts (up to 3)
# Verify: After 3 failures, persistent error banner
```

### Automated Testing

```bash
# Type checking
pnpm check-types

# Linting
pnpm lint

# Unit tests
pnpm test

# E2E tests
pnpm e2e
```

---

## Verification Checklist

- [ ] Model ID updated to `Xenova/clip-vit-large-patch14-336`
- [ ] Dimension validation expects 768 (not 512)
- [ ] Embeddings database regenerated with ViT-L/14@336px
- [ ] 446×620 intermediate resize removed
- [ ] Lazy loading implemented with progress indicator
- [ ] Error handling: 3 retries + permanent error banner
- [ ] Type checking passes (`pnpm check-types`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Manual visual inspection confirms preprocessing alignment
- [ ] Search results match Python pipeline (same top-1 card)
- [ ] Page load time improved by ~2s (lazy loading)
- [ ] Click-to-result latency improved by 5-10ms (pipeline optimization)

---

## Common Issues

### Issue: "Invalid embedding dimension: expected 768, got 512"

**Cause**: Browser using old model or database not regenerated

**Fix**:
1. Verify model ID is `Xenova/clip-vit-large-patch14-336`
2. Regenerate embeddings: `python build_embeddings.py && python export_for_browser.py`
3. Clear browser cache and reload

### Issue: "Embedding file size mismatch"

**Cause**: Database has wrong dimensions

**Fix**:
1. Check `meta.json`: `shape[1]` should be 768
2. Regenerate embeddings with updated Python pipeline
3. Verify `embeddings.bin` size is `N * 768` bytes

### Issue: Model fails to download

**Cause**: Network issues or CORS errors

**Fix**:
1. Check browser console for network errors
2. Verify Hugging Face CDN is accessible
3. Try clearing browser cache
4. Check for ad blockers or privacy extensions blocking requests

### Issue: Search results don't match Python pipeline

**Cause**: Preprocessing mismatch

**Fix**:
1. Export preprocessed images from both pipelines
2. Visual inspection: Should be identical (black padding, 336×336)
3. If different, file bug report with screenshots
4. May need manual preprocessing implementation (fallback)

---

## Performance Expectations

### Before (ViT-B/32, 512-dim)
- Model size: ~147MB
- Page load: Blocks for ~3s (model download)
- Click-to-result: ~200ms
- Accuracy: Baseline

### After (ViT-L/14@336px, 768-dim, lazy loading)
- Model size: ~500MB (larger, but lazy loaded)
- Page load: Instant (model not loaded)
- First click: ~5-10s (model download + embedding)
- Subsequent clicks: ~150-180ms (5-10ms faster)
- Accuracy: +10-15% improvement

---

## Next Steps

After implementation:

1. **Run `/speckit.tasks`** to generate task breakdown
2. **Run `/speckit.implement`** to execute tasks
3. **Manual testing** with visual inspection
4. **Performance benchmarking** (before/after comparison)
5. **Documentation update** (README, migration guide)
6. **Deployment** (regenerate production embeddings)

---

## Resources

- [Feature Spec](./spec.md)
- [Implementation Plan](./plan.md)
- [Research Notes](./research.md)
- [Data Model](./data-model.md)
- [Contracts](./contracts/)
- [Transformers.js Docs](https://huggingface.co/docs/transformers.js)
- [CLIP Paper](https://arxiv.org/abs/2103.00020)

---

## Support

For questions or issues:
1. Check [Common Issues](#common-issues) above
2. Review [Data Model](./data-model.md) for validation rules
3. Check browser console for detailed error messages
4. File issue with reproduction steps

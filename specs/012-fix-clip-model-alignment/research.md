# Research: CLIP Model Alignment & Pipeline Optimization

**Feature**: 012-fix-clip-model-alignment  
**Date**: 2025-10-17  
**Status**: Complete

## Research Questions

### 1. Transformers.js Model Availability

**Question**: Is `Xenova/clip-vit-large-patch14-336` available in Transformers.js for browser use?

**Decision**: Yes, use `Xenova/clip-vit-large-patch14-336`

**Rationale**:
- Xenova maintains ONNX-converted models specifically for Transformers.js browser compatibility
- The model naming follows the pattern: `Xenova/clip-vit-{size}-patch{patch_size}[-{resolution}]`
- ViT-L/14@336px maps to `clip-vit-large-patch14-336` (large model, patch size 14, 336px input)
- This is the browser-compatible equivalent of OpenAI's `ViT-L/14@336px` used in Python pipeline
- Produces 768-dimensional embeddings matching the database format

**Alternatives Considered**:
- `Xenova/clip-vit-large-patch14`: Base ViT-L/14 without 336px specialization (rejected - different preprocessing)
- Custom ONNX conversion: Convert OpenAI model ourselves (rejected - unnecessary complexity, Xenova already provides it)
- Keep `Xenova/clip-vit-base-patch32`: Current 512-dim model (rejected - dimension mismatch with database)

**Implementation Notes**:
- Model ID: `Xenova/clip-vit-large-patch14-336`
- Expected output dimension: 768
- Model size: ~500MB (larger than current 147MB ViT-B/32)
- Requires lazy loading to avoid blocking page load

---

### 2. Transformers.js Preprocessing Behavior

**Question**: Does Transformers.js automatically apply the correct preprocessing (black padding to 336×336) for ViT-L/14@336px, or do we need manual preprocessing?

**Decision**: Start with Transformers.js automatic preprocessing, add verification tests

**Rationale**:
- Transformers.js `pipeline('image-feature-extraction')` includes automatic preprocessing based on model config
- The model config for `clip-vit-large-patch14-336` should specify 336×336 input with appropriate padding
- Python CLIP library uses `clip.load()` which also applies automatic preprocessing
- Both should use the same underlying preprocessing logic (resize with padding)
- **However**: Must verify with tests that browser preprocessing matches Python output

**Alternatives Considered**:
- Manual preprocessing: Implement custom resize + black padding (rejected initially - prefer automatic, but fallback if tests fail)
- Trust without verification: Assume preprocessing matches (rejected - too risky, must validate)
- Pixel-perfect comparison: Compare preprocessed images pixel-by-pixel (rejected per clarification - use visual inspection + embedding similarity)

**Implementation Notes**:
- Use Transformers.js automatic preprocessing by default
- Add verification test: Process same card in Python and browser, compare embeddings (cosine similarity ≥0.95)
- Add manual visual inspection test: Export preprocessed images from both pipelines, inspect side-by-side
- If verification fails: Implement manual preprocessing with explicit black padding

**Verification Approach** (from clarifications):
- Primary: Manual visual inspection by developers during testing
- Secondary: Embedding cosine similarity ≥0.95 as validation signal
- No automated pixel-perfect comparison required

---

### 3. Canvas Dimension Flow

**Question**: What are the correct canvas dimensions at each pipeline stage?

**Decision**: SlimSAM (384×384) → CLIP preprocessing (336×336), remove 446×620 intermediate step

**Rationale**:
- **Current (broken) flow**: Click → SlimSAM warp (384×384) → Resize to 446×620 → CLIP preprocessing → Embed
- **Correct flow**: Click → SlimSAM warp (384×384) → CLIP preprocessing (336×336) → Embed
- The 446×620 resize is wasteful: it's immediately resized again by CLIP preprocessing
- SlimSAM produces square 384×384 warped canvas (already correct for card perspective correction)
- CLIP ViT-L/14@336px expects 336×336 input (smaller than SlimSAM output)
- Transformers.js preprocessing will handle 384×384 → 336×336 resize with black padding

**Alternatives Considered**:
- Keep 446×620 intermediate: Maintain current flow (rejected - unnecessary operation, wastes CPU/memory)
- Change SlimSAM output to 336×336: Modify SlimSAM warp size (rejected - 384×384 is optimal for SlimSAM quality)
- Manual resize before CLIP: Add explicit 384→336 resize (rejected - Transformers.js handles it automatically)

**Implementation Notes**:
- Remove any code creating 446×620 canvas between SlimSAM and CLIP
- Update `CROPPED_CARD_WIDTH` and `CROPPED_CARD_HEIGHT` constants from 384 to 336 (for documentation)
- SlimSAM output remains 384×384 (no changes to SlimSAM pipeline)
- CLIP preprocessing automatically handles 384×384 → 336×336 with padding

---

### 4. Lazy Loading Implementation Pattern

**Question**: What's the best pattern for lazy CLIP model loading in React?

**Decision**: Singleton pattern with loading state management in CLIPEmbedder class

**Rationale**:
- CLIPEmbedder class already exists with initialization logic
- Add loading state tracking to prevent duplicate downloads
- Expose loading state to React components via hooks
- Model loads on first `embedFromCanvas()` call if not already initialized
- Subsequent calls use cached model (already implemented in IndexedDB by Transformers.js)

**Alternatives Considered**:
- React Context: Global model state in React Context (rejected - unnecessary complexity, class singleton is simpler)
- Separate hook: Custom `useClipModel()` hook (rejected - CLIPEmbedder class already encapsulates logic)
- Eager loading: Load on page mount (rejected - defeats purpose of lazy loading optimization)

**Implementation Notes**:
- CLIPEmbedder already has `isLoading` flag and concurrent load prevention
- Add `getLoadingState()` method to expose loading status
- React components check loading state and show progress indicator
- First card click triggers model download with progress callback
- Error handling: 3 retry attempts, then permanent block with error banner (per clarifications)

---

### 5. Error Handling Strategy

**Question**: How should we handle model loading failures and dimension mismatches?

**Decision**: Fail fast with clear error messages, block after 3 retries (per clarifications)

**Rationale**:
- Dimension mismatches indicate critical configuration errors (must fail immediately)
- Model loading failures could be transient (network issues) → allow retries
- After 3 failed retries, assume persistent issue → block with persistent error banner
- All errors include context: expected vs actual values, migration instructions

**Alternatives Considered**:
- Graceful degradation: Fall back to manual card entry (rejected per clarification - user chose blocking behavior)
- Infinite retries: Keep trying indefinitely (rejected - poor UX, user can't recover)
- Silent fallback: Use old model if new one fails (rejected - would cause dimension mismatch)

**Implementation Notes**:
- Dimension validation: Check embedding.length === 768, throw clear error if mismatch
- Model loading: Wrap in try-catch with retry logic (max 3 attempts)
- After 3 failures: Set permanent error state, show banner requiring page refresh
- Error messages format: "Expected X, got Y. [Migration instructions]"

---

## Technology Best Practices

### Transformers.js in Browser

**Best Practices**:
1. **Lazy loading**: Load models on-demand, not on page load (reduces initial bundle)
2. **Progress callbacks**: Show download progress for large models (improves perceived performance)
3. **Browser caching**: Enable `env.useBrowserCache = true` for IndexedDB caching
4. **Device fallback**: Use `device: 'auto'` for WebGPU → WebGL → WASM fallback
5. **Dtype selection**: Use `fp16` for performance, `fp32` for accuracy (ViT-L/14 needs fp32 for quality)

**References**:
- Transformers.js docs: https://huggingface.co/docs/transformers.js
- Model hub: https://huggingface.co/Xenova
- Browser caching: https://huggingface.co/docs/transformers.js/guides/browser

### CLIP Embedding Pipeline

**Best Practices**:
1. **L2 normalization**: Always normalize embeddings for cosine similarity via dot product
2. **Consistent preprocessing**: Browser and Python must use identical preprocessing
3. **Dimension validation**: Validate embedding dimensions immediately after generation
4. **Quantization**: Use int8 quantization for browser delivery (75% size reduction)
5. **Batch processing**: Process multiple images in batches when possible (not applicable for single-click use case)

**References**:
- OpenAI CLIP paper: https://arxiv.org/abs/2103.00020
- CLIP preprocessing: Uses center-crop by default, but can be configured for padding
- Python CLIP library: https://github.com/openai/CLIP

### React Performance Optimization

**Best Practices**:
1. **Code splitting**: Use dynamic imports for heavy dependencies
2. **Lazy loading**: Defer non-critical resource loading
3. **Loading states**: Show progress indicators for async operations
4. **Error boundaries**: Catch and display errors gracefully
5. **Memoization**: Cache expensive computations (not needed for single-use embeddings)

**References**:
- React docs: https://react.dev/reference/react/lazy
- Vite code splitting: https://vitejs.dev/guide/features.html#dynamic-import

---

## Summary

All research questions resolved. Key decisions:

1. **Model**: Use `Xenova/clip-vit-large-patch14-336` (768-dim, browser-compatible)
2. **Preprocessing**: Trust Transformers.js automatic preprocessing, verify with tests
3. **Pipeline**: Remove 446×620 intermediate resize, go directly 384×384 → 336×336
4. **Loading**: Lazy load model on first use with singleton pattern
5. **Errors**: Fail fast with clear messages, block after 3 retry attempts

No blocking unknowns remain. Ready to proceed to Phase 1 (Design & Contracts).

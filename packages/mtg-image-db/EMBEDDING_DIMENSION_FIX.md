# Embedding Dimension Fix

## Problem

When running `make embed` with ViT-B/32 model, the build failed with:

```
ValueError: could not broadcast input array from shape (512,) into shape (768,)
```

This occurred because:
1. The code was using ViT-B/32 model (512-dimensional embeddings)
2. But the code had hardcoded 768-dimensional array allocations
3. ViT-B/32 outputs 512-dim vectors, causing a shape mismatch

## Root Cause

The codebase had hardcoded embedding dimension of 768 (from ViT-L/14) in multiple places:

**Backend (build_mtg_faiss.py):**
- Line 176: `return np.zeros((0, 768), dtype="float32")`
- Line 182: `out = np.zeros((len(pil_images), 768), dtype="float32")`

**Backend (build_embeddings.py):**
- Line 180: `vecs = np.zeros((len(records), 768), dtype="float32")`

**Frontend (clip-search.ts):**
- Line 27: `const D = 768`

## Solution

Made embedding dimension **dynamic** based on the actual model output:

### Backend Changes

**build_mtg_faiss.py:**
```python
class Embedder:
    def __init__(self, device: str = None):
        # ... model loading ...
        # Get embedding dimension from model (ViT-B/32 = 512, ViT-L/14 = 768)
        self.embedding_dim = self.model.visual.output_dim

    def encode_images(self, pil_images: List[Image.Image]) -> np.ndarray:
        # ... encoding ...
        # Use dynamic dimension instead of hardcoded 768
        out = np.zeros((len(pil_images), self.embedding_dim), dtype="float32")
```

**build_embeddings.py:**
```python
embedder = Embedder()
embedding_dim = embedder.embedding_dim
vecs = np.zeros((len(records), embedding_dim), dtype="float32")
```

### Frontend Changes

**clip-search.ts:**
```typescript
// Default to 512 (ViT-B/32) but will be overridden by actual metadata
let D = 512

// After loading metadata:
D = metaObj.shape[1]
console.log(`Loaded embeddings with dimension D=${D}`)
```

## Benefits

1. **Model agnostic**: Works with any CLIP model (ViT-B/32, ViT-L/14, etc.)
2. **Automatic**: Dimension is detected from model output, no manual configuration needed
3. **Consistent**: Frontend reads dimension from metadata, ensuring alignment with backend
4. **Future-proof**: Can switch models without code changes

## Testing

After the fix, the build works with ViT-B/32:

```bash
make embed
# Now works! Creates 512-dimensional embeddings
```

## Embedding Dimensions

| Model | Dimension | Speed | Size |
|-------|-----------|-------|------|
| ViT-B/32 | 512 | Fast | Smaller |
| ViT-L/14 | 768 | Slower | Larger |

## Verification

After building, check the build manifest:

```bash
cat packages/mtg-image-db/index_out/build_manifest.json | grep shape
# Should show: "shape": [N, 512] for ViT-B/32
# Or: "shape": [N, 768] for ViT-L/14
```

Check frontend logs:

```javascript
// In browser console after loading embeddings
// Should show: [loadEmbeddingsAndMetaFromPackage] Loaded embeddings with dimension D=512
```

## Related Files

- Backend embedding: `build_mtg_faiss.py` (Embedder class)
- Backend build: `build_embeddings.py` (build_embeddings_from_cache function)
- Frontend: `apps/web/src/lib/clip-search.ts` (loadEmbeddingsAndMetaFromPackage function)
- Build manifest: `index_out/build_manifest.json` (shape field)

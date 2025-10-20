# Perfect Match Test

## Overview

The `test_perfect_match.py` script verifies that querying the database with an image from the cache returns a **perfect match** (cosine similarity score ≥ 0.99).

This test ensures:
1. ✅ Embedding generation is deterministic
2. ✅ Database search finds exact matches
3. ✅ Cosine similarity scoring is correct
4. ✅ No data corruption in the index

## Quick Start

### Run with default (first cached image)
```bash
make test
```

### Run with specific image
```bash
python test_perfect_match.py --image-path image_cache/7f7b910a9ab37c62aea118e2052f8054d53c04fa.jpg
```

### Run with custom index/metadata paths
```bash
python test_perfect_match.py \
  --image-path image_cache/your_image.jpg \
  --index-path index_out/index.faiss \
  --meta-path index_out/meta.json
```

## Prerequisites

Before running the test, you need to:

1. **Download images:**
   ```bash
   make download
   ```

2. **Build the index:**
   ```bash
   make embed
   # or with contrast enhancement:
   make embed-contrast
   ```

3. **Export for browser (optional):**
   ```bash
   make export
   ```

## Expected Output

### Success (Perfect Match Found)
```
🔍 Testing perfect match with image: 7f7b910a9ab37c62aea118e2052f8054d53c04fa.jpg
   Index: /path/to/index_out/index.faiss
   Metadata: /path/to/index_out/meta.json

📊 Embedding dimension: 512
📂 Loading FAISS index...
   Index size: 18957 vectors

🖼️  Generating embedding for test image...
   Embedding shape: (512,)
   Embedding norm: 1.000000

🔎 Querying index for top-1 match...
   Top match index: 12345
   Cosine similarity score: 0.999999

✅ PASS: Perfect match found! Score 0.999999 >= 0.99
   Matched card: Lightning Bolt
   Set: LEA
```

### Failure (No Perfect Match)
```
❌ FAIL: Score 0.850000 < 0.99
   Expected a perfect match (score ~1.0)

   Top-5 matches:
   1. Lightning Bolt (score: 0.850000)
   2. Shock (score: 0.820000)
   3. Bolt (score: 0.810000)
   4. Zap (score: 0.800000)
   5. Blast (score: 0.790000)
```

## What the Test Does

1. **Validates paths:**
   - Checks that the test image exists
   - Checks that the FAISS index exists
   - Checks that metadata exists

2. **Loads metadata:**
   - Reads embedding dimension from metadata
   - Loads card information

3. **Generates embedding:**
   - Loads the test image
   - Preprocesses it (same as during index build)
   - Generates CLIP embedding
   - Normalizes to unit length

4. **Queries the index:**
   - Searches for top-1 match in FAISS index
   - Retrieves cosine similarity score

5. **Validates result:**
   - Checks if score >= 0.99 (perfect match threshold)
   - Prints matched card information
   - If failed, shows top-5 matches for debugging

## Scoring Explanation

### Cosine Similarity Scores

| Score | Meaning |
|-------|---------|
| 1.0 | Perfect match (identical embeddings) |
| 0.99+ | Near-perfect match (floating point precision) |
| 0.95-0.99 | Very similar card |
| 0.90-0.95 | Similar card |
| < 0.90 | Different card |

### Why Not Exactly 1.0?

Due to floating-point precision:
- Embeddings are normalized to unit length
- Dot product of normalized vectors should be 1.0
- But floating-point rounding can give 0.999999 or similar
- Test accepts >= 0.99 as "perfect match"

## Troubleshooting

### "Index not found"
```
❌ Index not found: index_out/index.faiss
   Run 'make build-all' or 'make embed' first
```

**Solution:** Build the index first:
```bash
make download
make embed
```

### "No images found in cache"
```
❌ No images found in cache: image_cache
   Run 'make download' first
```

**Solution:** Download images first:
```bash
make download
```

### "Score < 0.99" (No perfect match)
This could indicate:
1. **Embedding dimension mismatch** - Check that backend and frontend use same dimension
2. **Different preprocessing** - Ensure image loading/resizing is identical
3. **Index corruption** - Try rebuilding: `make clean && make embed`
4. **Model change** - If you changed the CLIP model, rebuild the index

## Test Workflow

### Complete workflow to verify everything works:
```bash
# 1. Setup environment
make conda-mps  # or conda-cpu or conda-gpu

# 2. Download images
make download

# 3. Build index with contrast enhancement
make embed-contrast

# 4. Run perfect match test
make test

# 5. Export for browser (optional)
make export
```

## Integration with CI/CD

The test can be used in CI/CD pipelines:

```bash
#!/bin/bash
set -e

# Build
make download
make embed

# Test
if ! make test; then
    echo "Perfect match test failed!"
    exit 1
fi

echo "All tests passed!"
```

## Performance Notes

- **Test time:** ~30-60 seconds (mostly CLIP inference)
- **Memory:** ~2-4 GB (CLIP model + index in memory)
- **CPU:** Single-threaded embedding generation

## Related Files

- Test script: `test_perfect_match.py`
- Makefile target: `make test`
- Build scripts: `build_embeddings.py`, `build_mtg_faiss.py`
- Embedding code: `build_mtg_faiss.py` (Embedder class)

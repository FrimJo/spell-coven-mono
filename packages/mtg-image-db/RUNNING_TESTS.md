# Running Tests

## Quick Start

### Run test in this package
```bash
cd packages/mtg-image-db
pnpm test
```

### Run test from root using turbo
```bash
pnpm test
```

### Run test with make
```bash
cd packages/mtg-image-db
make test
```

## Test Details

The test script (`test_perfect_match.py`) verifies that:
- ✅ Querying the database with a cached image returns a perfect match (score ≥ 0.99)
- ✅ Embedding generation is deterministic
- ✅ Database search finds exact matches
- ✅ Cosine similarity scoring is correct

## Prerequisites

Before running tests, you need to build the index:

```bash
cd packages/mtg-image-db

# Download images
pnpm run build  # or: make download

# Build embeddings
make embed
# or with contrast enhancement:
make embed-contrast
```

## Running Tests

### Option 1: From package directory
```bash
cd packages/mtg-image-db
pnpm test
```

### Option 2: From root with turbo (runs all packages with test script)
```bash
pnpm test
```

### Option 3: With make
```bash
cd packages/mtg-image-db
make test
```

### Option 4: Direct Python
```bash
cd packages/mtg-image-db
python3 test_perfect_match.py
```

## Test Output

### Success
```
🔍 Testing perfect match with image: 7f7b910a9ab37c62aea118e2052f8054d53c04fa.jpg
📊 Embedding dimension: 512
🖼️  Generating embedding for test image...
🔎 Querying index for top-1 match...
   Cosine similarity score: 0.999999

✅ PASS: Perfect match found! Score 0.999999 >= 0.99
   Matched card: Lightning Bolt
   Set: LEA
```

### Failure
```
❌ FAIL: Score 0.850000 < 0.99
   Expected a perfect match (score ~1.0)

   Top-5 matches:
   1. Lightning Bolt (score: 0.850000)
   2. Shock (score: 0.820000)
   ...
```

## Turbo Integration

The test is integrated with turbo, so you can:

1. **Run test in this package only:**
   ```bash
   turbo run test --filter @repo/mtg-image-db
   ```

2. **Run test in all packages:**
   ```bash
   turbo run test
   ```

3. **Run test with verbose output:**
   ```bash
   turbo run test --verbose
   ```

## CI/CD Integration

The test can be used in CI/CD pipelines:

```bash
#!/bin/bash
set -e

# Build
pnpm install
pnpm build

# Test
pnpm test

echo "All tests passed!"
```

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
1. Embedding dimension mismatch
2. Different preprocessing
3. Index corruption - try: `make clean && make embed`
4. Model change - rebuild the index

## Related Documentation

- Test script: `test_perfect_match.py`
- Test details: `TEST_PERFECT_MATCH.md`
- Build process: `README.md`
- Makefile: `Makefile`

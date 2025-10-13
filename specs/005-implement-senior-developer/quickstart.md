# Quickstart: MTG Image DB Production Hardening

**Feature**: 005-implement-senior-developer  
**Date**: 2025-10-14

## Overview

This quickstart provides manual testing scenarios for validating the production hardening improvements. Since automated tests are not required per the specification, these scenarios enable verification of each user story's acceptance criteria.

## Prerequisites

```bash
# Ensure you're on the feature branch
git checkout 005-implement-senior-developer

# Activate conda environment (choose one)
conda activate mtg-faiss-cpu   # or mtg-faiss-gpu or mtg-faiss-mps

# Navigate to package directory
cd packages/mtg-image-db
```

## Test Scenarios by User Story

### User Story 1: Reliable Large-Scale Image Downloads (P1)

#### Scenario 1.1: Rate Limiting Retry

**Objective**: Verify automatic retry with exponential backoff on 429 responses

**Steps**:
```bash
# Test with small dataset first
python download_images.py --kind unique_artwork --limit 100 --cache test_cache

# Monitor output for retry messages
# Expected: "Retrying after rate limit..." with increasing delays
```

**Success Criteria**:
- Script completes without hanging
- Retry messages show exponential backoff (1s, 2s, 4s, 8s, 16s)
- Final success rate >99% (excluding genuine 404s)

#### Scenario 1.2: Network Timeout Handling

**Objective**: Verify timeout detection and retry

**Steps**:
```bash
# Run with default timeouts (5s connect, 30s read)
python download_images.py --kind unique_artwork --limit 50 --cache test_cache

# Observe timeout behavior in logs
```

**Success Criteria**:
- Timeouts trigger retry (up to 5 attempts)
- Script doesn't hang indefinitely
- Failed downloads logged clearly

#### Scenario 1.3: Atomic File Writes

**Objective**: Verify partial files aren't treated as valid

**Steps**:
```bash
# Start download
python download_images.py --kind unique_artwork --limit 100 --cache test_cache

# Interrupt with Ctrl+C after ~10 seconds

# Check for .part files
ls test_cache/*.part

# Resume download
python download_images.py --kind unique_artwork --limit 100 --cache test_cache

# Verify no partial files remain
ls test_cache/*.part  # Should be empty
```

**Success Criteria**:
- Interrupted downloads leave .part files
- Resume re-downloads incomplete files
- No .part files after successful completion

#### Scenario 1.4: Parallel Downloads Performance

**Objective**: Verify 10x speedup with parallel workers

**Steps**:
```bash
# Sequential (1 worker)
time python download_images.py --kind unique_artwork --limit 1000 --cache test_cache --workers 1

# Parallel (16 workers)
rm -rf test_cache  # Clear cache
time python download_images.py --kind unique_artwork --limit 1000 --cache test_cache --workers 16

# Compare times
```

**Success Criteria**:
- Parallel mode at least 10x faster
- No race conditions (file count matches)
- All files valid after parallel download

---

### User Story 2: Data Integrity Validation (P1)

#### Scenario 2.1: Corrupted File Detection

**Objective**: Verify HTML error pages are rejected

**Steps**:
```bash
# Create corrupted file
echo "<html>404 Not Found</html>" > test_cache/corrupted.jpg

# Run embedding
python build_embeddings.py --kind unique_artwork --limit 100 --cache test_cache --out test_out

# Check logs for validation failure
```

**Success Criteria**:
- Corrupted file detected and logged
- File excluded from final index
- Clear warning message with filename

#### Scenario 2.2: Truncated File Detection

**Objective**: Verify incomplete downloads are rejected

**Steps**:
```bash
# Create truncated file (first 100 bytes of valid image)
head -c 100 test_cache/valid_image.jpg > test_cache/truncated.jpg

# Run embedding
python build_embeddings.py --kind unique_artwork --limit 100 --cache test_cache --out test_out

# Check validation results
```

**Success Criteria**:
- Truncated file fails PIL validation
- Logged as validation failure
- Excluded from index

#### Scenario 2.3: Validation Statistics

**Objective**: Verify accurate reporting of validation failures

**Steps**:
```bash
# Create mix of valid and corrupted files
# (use existing cache with 100 images, corrupt 5)

# Run embedding
python build_embeddings.py --kind unique_artwork --cache test_cache --out test_out

# Check summary statistics
```

**Success Criteria**:
- Summary shows "5 validation failures"
- Final index has exactly 95 entries
- Clear breakdown of failure types

---

### User Story 3: Graceful Edge Case Handling (P1)

#### Scenario 3.1: Zero Valid Images

**Objective**: Verify graceful exit when no images available

**Steps**:
```bash
# Empty cache directory
rm -rf test_cache
mkdir test_cache

# Attempt to build embeddings
python build_embeddings.py --kind unique_artwork --limit 10 --cache test_cache --out test_out
```

**Success Criteria**:
- Script exits with error code 1
- Clear message: "No valid images to embed"
- No FAISS index created
- No crash or stack trace

#### Scenario 3.2: Division by Zero Protection

**Objective**: Verify percentage calculations handle zero records

**Steps**:
```bash
# Run with --limit 0
python download_images.py --kind unique_artwork --limit 0 --cache test_cache
```

**Success Criteria**:
- Script exits gracefully or shows "0/0" or "N/A"
- No ZeroDivisionError exception
- Clear message about empty dataset

#### Scenario 3.3: Invalid CLI Arguments

**Objective**: Verify argument validation at startup

**Steps**:
```bash
# Test invalid batch size
python build_embeddings.py --batch 0 --cache test_cache --out test_out

# Test invalid image size
python build_embeddings.py --size 32 --cache test_cache --out test_out

# Test invalid worker count
python download_images.py --workers 0 --cache test_cache
```

**Success Criteria**:
- Each invalid argument rejected at startup
- Clear error message explaining constraint
- Script exits before any work done

---

### User Story 4: High-Performance Parallel Processing (P2)

#### Scenario 4.1: Performance Comparison

**Objective**: Measure speedup from parallelization

**Steps**:
```bash
# Baseline: Sequential
time python download_images.py --kind unique_artwork --limit 1000 --workers 1 --cache test_cache_seq

# Parallel: 16 workers
time python download_images.py --kind unique_artwork --limit 1000 --workers 16 --cache test_cache_par

# Calculate speedup ratio
```

**Success Criteria**:
- Speedup ratio ≥10x
- Both runs produce same file count
- No corrupted files in parallel run

#### Scenario 4.2: Thread Safety

**Objective**: Verify no race conditions in parallel mode

**Steps**:
```bash
# Run parallel download multiple times
for i in {1..3}; do
  rm -rf test_cache
  python download_images.py --kind unique_artwork --limit 500 --workers 16 --cache test_cache
  echo "Run $i: $(ls test_cache | wc -l) files"
done
```

**Success Criteria**:
- All runs produce same file count
- No duplicate or missing files
- No file corruption

---

### User Story 5: Configurable Index Quality vs Performance (P2)

#### Scenario 5.1: HNSW Parameter Tuning

**Objective**: Verify configurable parameters affect build time

**Steps**:
```bash
# Fast build (low quality)
time python build_embeddings.py --kind unique_artwork --limit 5000 \
  --hnsw-m 16 --hnsw-ef-construction 100 \
  --cache test_cache --out test_out_fast

# Balanced build (default)
time python build_embeddings.py --kind unique_artwork --limit 5000 \
  --hnsw-m 32 --hnsw-ef-construction 200 \
  --cache test_cache --out test_out_balanced

# High quality build
time python build_embeddings.py --kind unique_artwork --limit 5000 \
  --hnsw-m 64 --hnsw-ef-construction 400 \
  --cache test_cache --out test_out_quality

# Compare build times
```

**Success Criteria**:
- Fast < Balanced < Quality (build time)
- All builds complete successfully
- Index sizes reflect M parameter

#### Scenario 5.2: Default Parameters

**Objective**: Verify sensible defaults are used

**Steps**:
```bash
# Build without specifying HNSW params
python build_embeddings.py --kind unique_artwork --limit 1000 --cache test_cache --out test_out

# Check build manifest
cat test_out/build_manifest.json | grep -A 2 "hnsw"
```

**Success Criteria**:
- Manifest shows M=32, efConstruction=200
- Build completes in reasonable time
- Index quality suitable for development

---

### User Story 6: Correct Distance Metric Implementation (P1)

#### Scenario 6.1: Vector Normalization Verification

**Objective**: Verify all vectors are L2-normalized

**Steps**:
```bash
# Build index
python build_embeddings.py --kind unique_artwork --limit 1000 --cache test_cache --out test_out

# Check normalization in Python
python -c "
import numpy as np
vecs = np.load('test_out/mtg_embeddings.npy')
norms = np.linalg.norm(vecs, axis=1)
print(f'Min norm: {norms.min():.6f}')
print(f'Max norm: {norms.max():.6f}')
print(f'Mean norm: {norms.mean():.6f}')
assert np.allclose(norms, 1.0, atol=1e-3), 'Vectors not normalized!'
print('✓ All vectors normalized')
"
```

**Success Criteria**:
- All norms equal 1.0 ± 0.001
- No assertion error
- Output shows "✓ All vectors normalized"

#### Scenario 6.2: Cosine Similarity Correctness

**Objective**: Verify identical images return score ≥0.99

**Steps**:
```bash
# Build index
python build_embeddings.py --kind unique_artwork --limit 1000 --cache test_cache --out test_out

# Query an image against itself
python query_index.py test_cache/some_image.jpg --k 1

# Check top result score
```

**Success Criteria**:
- Top result is the same image
- Similarity score ≥0.99
- Distance metric shows cosine similarity behavior

#### Scenario 6.3: FAISS Metric Type

**Objective**: Verify METRIC_INNER_PRODUCT is used

**Steps**:
```bash
# Check FAISS index metric in Python
python -c "
import faiss
index = faiss.read_index('test_out/mtg_cards.faiss')
# Extract base index from IDMap wrapper
base_index = faiss.downcast_index(index.index)
print(f'Metric type: {base_index.metric_type}')
assert base_index.metric_type == faiss.METRIC_INNER_PRODUCT, 'Wrong metric!'
print('✓ Using METRIC_INNER_PRODUCT')
"
```

**Success Criteria**:
- Output shows "METRIC_INNER_PRODUCT"
- No assertion error
- Confirms correct metric for cosine similarity

---

### User Story 7: Progress Tracking and Resumability (P3)

#### Scenario 7.1: Checkpoint Creation

**Objective**: Verify checkpoints saved every 500 images

**Steps**:
```bash
# Start long embedding job
python build_embeddings.py --kind unique_artwork --limit 5000 --cache test_cache --out test_out

# Monitor checkpoint files
watch -n 5 'ls -lh test_out/checkpoint*'
```

**Success Criteria**:
- checkpoint.npz appears after ~500 images
- checkpoint_meta.json created alongside
- Checkpoints updated every ~500 images

#### Scenario 7.2: Resume from Checkpoint

**Objective**: Verify interrupted jobs can resume

**Steps**:
```bash
# Start embedding job
python build_embeddings.py --kind unique_artwork --limit 5000 --cache test_cache --out test_out

# Interrupt after ~2000 images (Ctrl+C)

# Check checkpoint
cat test_out/checkpoint_meta.json

# Resume
python build_embeddings.py --kind unique_artwork --limit 5000 --cache test_cache --out test_out

# Verify it skips already-processed images
```

**Success Criteria**:
- Resume detects checkpoint
- Skips first ~2000 images
- Completes remaining ~3000 images
- Final index has all 5000 embeddings

#### Scenario 7.3: Progress Display

**Objective**: Verify detailed progress information

**Steps**:
```bash
# Run embedding with progress tracking
python build_embeddings.py --kind unique_artwork --limit 5000 --cache test_cache --out test_out

# Observe progress output
```

**Success Criteria**:
- Shows current throughput (images/sec)
- Shows estimated time remaining
- Progress bar updates smoothly
- Final summary shows statistics

---

## Build Manifest Verification

After any successful build, verify the manifest:

```bash
# Check manifest exists
ls -lh test_out/build_manifest.json

# Validate structure
python -c "
import json
with open('test_out/build_manifest.json') as f:
    manifest = json.load(f)
    
print('Version:', manifest['version'])
print('Timestamp:', manifest['timestamp'])
print('Parameters:', manifest['parameters'])
print('Statistics:', manifest['statistics'])
print('Environment:', manifest['environment'])

# Verify success rate
stats = manifest['statistics']
success_rate = stats['successful_embeddings'] / stats['total_records']
print(f'Success rate: {success_rate:.2%}')
"
```

**Success Criteria**:
- Manifest is valid JSON
- Contains all required sections
- Success rate matches expected value
- Environment versions captured

---

## Cleanup

```bash
# Remove test artifacts
rm -rf test_cache test_cache_seq test_cache_par
rm -rf test_out test_out_fast test_out_balanced test_out_quality
```

## Performance Benchmarks

Expected performance on typical hardware:

| Operation | Sequential | Parallel (16 workers) | Speedup |
|-----------|-----------|----------------------|---------|
| Download 1,000 images | ~300s | ~25s | 12x |
| Download 5,000 images | ~1500s | ~120s | 12.5x |
| Embed 1,000 images (CPU) | ~180s | N/A | - |
| Embed 1,000 images (GPU) | ~30s | N/A | - |

## Troubleshooting

### Rate Limiting

If you see many 429 errors:
- Reduce worker count: `--workers 8`
- Increase delays in retry logic
- Wait a few minutes before retrying

### Validation Failures

If many images fail validation:
- Check cache directory for corrupted files
- Re-run download to refresh cache
- Check disk space (full disk can corrupt writes)

### Checkpoint Issues

If resume doesn't work:
- Delete checkpoint files and restart
- Check checkpoint_meta.json for parameter mismatches
- Ensure output directory is writable

### Performance Issues

If parallel downloads aren't faster:
- Check network bandwidth (may be bottleneck)
- Try different worker counts (8, 16, 32)
- Verify CPU isn't bottlenecked (use `htop`)

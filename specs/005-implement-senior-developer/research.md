# Research: MTG Image DB Production Hardening

**Feature**: 005-implement-senior-developer  
**Date**: 2025-10-14  
**Status**: Complete

## Overview

This document consolidates research findings for hardening the MTG image database Python package. Since this is a **code quality improvement** based on senior developer feedback, most technical decisions are already specified. Research focuses on implementation patterns and best practices.

## Decisions

### 1. HTTP Retry Strategy with Exponential Backoff

**Decision**: Use `urllib3.util.Retry` with `requests.Session()` for automatic retry logic

**Rationale**:
- `urllib3.Retry` is the standard Python library for retry logic with exponential backoff
- Integrates seamlessly with `requests.Session()`
- Supports status-based retries (429, 5xx) and backoff configuration
- Well-tested and maintained by the requests ecosystem

**Implementation**:
```python
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

retry_strategy = Retry(
    total=5,
    backoff_factor=1,  # 1s, 2s, 4s, 8s, 16s
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
    respect_retry_after_header=True
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session = requests.Session()
session.mount("http://", adapter)
session.mount("https://", adapter)
```

**Alternatives Considered**:
- Manual retry loops: More control but reinvents the wheel
- `tenacity` library: More features but adds dependency
- `backoff` library: Good but urllib3.Retry is already available

### 2. Parallel Downloads with ThreadPoolExecutor

**Decision**: Use `concurrent.futures.ThreadPoolExecutor` with shared session

**Rationale**:
- Standard library (no new dependencies)
- Thread-safe when using session with proper connection pooling
- Simple API with `map()` and `submit()`
- Works well with I/O-bound tasks like HTTP downloads

**Implementation**:
```python
from concurrent.futures import ThreadPoolExecutor
from functools import partial

def download_with_session(record, session, cache_dir):
    return download_image(record["image_url"], cache_dir, session)

with ThreadPoolExecutor(max_workers=16) as executor:
    download_fn = partial(download_with_session, session=session, cache_dir=cache_dir)
    results = list(tqdm(executor.map(download_fn, records), total=len(records)))
```

**Alternatives Considered**:
- `multiprocessing.Pool`: Overkill for I/O-bound tasks, higher overhead
- `asyncio` with `aiohttp`: Requires rewriting all HTTP code, adds complexity
- `grequests`: Adds dependency, less control over session management

### 3. Atomic File Writes

**Decision**: Write to `.part` temporary file, then `os.replace()` on success

**Rationale**:
- `os.replace()` is atomic on POSIX systems (macOS, Linux)
- Prevents partial files from being treated as valid cache entries
- Simple pattern with minimal code changes
- Works with existing file-based caching

**Implementation**:
```python
temp_path = cache_path.with_suffix(cache_path.suffix + ".part")
with open(temp_path, "wb") as f:
    for chunk in response.iter_content(chunk_size=16384):
        if chunk:
            f.write(chunk)
    f.flush()
    os.fsync(f.fileno())  # Ensure data written to disk
os.replace(temp_path, cache_path)  # Atomic rename
```

**Alternatives Considered**:
- `tempfile.NamedTemporaryFile`: More complex, same result
- Write-then-validate: Doesn't prevent partial files from interruption
- File locking: Overkill for single-process writes

### 4. Image Validation Strategy

**Decision**: Use `PIL.Image.verify()` followed by `Image.open()` for validation

**Rationale**:
- `verify()` checks file integrity without full decode (fast)
- `open()` confirms the file can actually be loaded
- Catches corrupted files, HTML error pages, truncated downloads
- Already using Pillow, no new dependencies

**Implementation**:
```python
def validate_image(path: Path) -> bool:
    try:
        with Image.open(path) as img:
            img.verify()  # Check integrity
        with Image.open(path) as img:
            img.load()  # Ensure decodable
        return True
    except (UnidentifiedImageError, OSError, SyntaxError):
        return False
```

**Alternatives Considered**:
- File size check only: Doesn't catch corrupted data
- Magic number check: Doesn't validate full file integrity
- Full decode to numpy: Too slow for validation-only purpose

### 5. FAISS Metric Type for Cosine Similarity

**Decision**: Use `faiss.METRIC_INNER_PRODUCT` with L2-normalized vectors

**Rationale**:
- For L2-normalized vectors, inner product = cosine similarity
- Current code uses `IndexHNSWFlat` with default L2 metric (incorrect)
- CLIP embeddings are already normalized (line 129 in build_mtg_faiss.py)
- This is a **correctness fix**, not an optimization

**Implementation**:
```python
# Verify normalization
norms = np.linalg.norm(X, axis=1)
assert np.allclose(norms, 1.0, atol=1e-5), "Vectors must be L2-normalized"

# Create index with inner product metric
hnsw_index = faiss.IndexHNSWFlat(d, M, faiss.METRIC_INNER_PRODUCT)
```

**Alternatives Considered**:
- Keep L2 metric: Mathematically incorrect for cosine similarity
- Use `IndexFlatIP`: Slower than HNSW, defeats purpose of ANN index
- Normalize at query time: Doesn't fix index-time metric mismatch

### 6. Checkpoint Format

**Decision**: Use numpy `.npz` format with metadata JSON sidecar

**Rationale**:
- `.npz` supports multiple arrays (embeddings + indices) in one file
- Compressed format saves disk space
- Easy to load/save with `np.savez_compressed()`
- JSON sidecar stores checkpoint metadata (timestamp, count, params)

**Implementation**:
```python
checkpoint_path = out_dir / "checkpoint.npz"
metadata_path = out_dir / "checkpoint_meta.json"

# Save checkpoint
np.savez_compressed(
    checkpoint_path,
    embeddings=vecs[:processed_count],
    indices=kept[:processed_count],
    good_mask=good[:processed_count]
)

# Save metadata
with open(metadata_path, "w") as f:
    json.dump({
        "timestamp": time.time(),
        "processed_count": processed_count,
        "total_count": len(records),
        "batch_size": batch_size
    }, f)
```

**Alternatives Considered**:
- Pickle: Less portable, security concerns
- HDF5: Adds dependency, overkill for simple checkpoints
- SQLite: Overkill, adds complexity

### 7. CLI Argument Validation

**Decision**: Add validation function called at start of `main()`

**Rationale**:
- Fail fast with clear error messages
- Prevents cryptic errors deep in execution
- Simple to implement with basic conditionals
- Follows "parse, don't validate" principle

**Implementation**:
```python
def validate_args(args):
    errors = []
    if args.limit is not None and args.limit < 0:
        errors.append("--limit must be >= 0")
    if args.batch < 1:
        errors.append("--batch must be >= 1")
    if args.size < 64:
        errors.append("--size must be >= 64")
    if args.workers < 1 or args.workers > 128:
        errors.append("--workers must be between 1 and 128")
    
    if errors:
        print("ERROR: Invalid arguments:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
```

**Alternatives Considered**:
- argparse type validators: Less flexible for cross-argument validation
- Pydantic: Adds dependency, overkill for simple CLI
- No validation: Leads to confusing errors later

### 8. Build Manifest Format

**Decision**: JSON file with semantic versioning and provenance metadata

**Rationale**:
- Human-readable for debugging
- Easy to parse in any language
- Supports versioning for future schema changes
- Aligns with constitution's data contract discipline

**Implementation**:
```python
manifest = {
    "version": "1.0.0",
    "timestamp": datetime.now().isoformat(),
    "parameters": {
        "kind": args.kind,
        "batch_size": args.batch,
        "target_size": args.size,
        "hnsw_m": args.hnsw_m,
        "hnsw_ef_construction": args.hnsw_ef_construction
    },
    "statistics": {
        "total_records": len(records),
        "successful_embeddings": X.shape[0],
        "failed_embeddings": len(records) - X.shape[0],
        "success_rate": X.shape[0] / len(records)
    },
    "environment": {
        "python_version": sys.version,
        "numpy_version": np.__version__,
        "faiss_version": faiss.__version__
    }
}
```

**Alternatives Considered**:
- YAML: Adds dependency, no significant benefit
- Binary format: Not human-readable, harder to debug
- Embedded in JSONL: Pollutes metadata file

## Implementation Notes

### Thread Safety Considerations

- **requests.Session()**: Thread-safe for reading, use one session per thread pool
- **tqdm**: Thread-safe with `lock` parameter
- **File writes**: Each thread writes to unique file (no locking needed)
- **CLIP model**: Already has threading.Lock in Embedder class

### Backward Compatibility

- All new CLI flags have defaults matching current behavior
- Existing index format unchanged (FAISS, JSONL, NPY)
- Build manifest is additive (doesn't break existing consumers)
- Checkpoint files are optional (don't block normal operation)

### Testing Strategy

Per spec, automated tests are not required. Manual testing approach:

1. **Networking**: Test with `--limit 100` and intentional network issues
2. **Validation**: Place corrupted files in cache, verify rejection
3. **Edge cases**: Test with `--limit 0`, empty cache, all 404s
4. **Performance**: Compare sequential vs parallel on 1,000 images
5. **Correctness**: Query identical image, verify score ≥0.99

### Documentation Updates

README.md sections to add/update:

1. **Parallel Downloads**: Document `--workers` flag, tuning guidelines
2. **Retry Behavior**: Explain exponential backoff, rate limit handling
3. **HNSW Parameters**: Document `--hnsw-m` and `--hnsw-ef-construction` flags
4. **Checkpointing**: Explain resumability, checkpoint frequency
5. **Troubleshooting**: Add section on validation failures, retry exhaustion

## References

- [urllib3 Retry Documentation](https://urllib3.readthedocs.io/en/stable/reference/urllib3.util.html#urllib3.util.Retry)
- [FAISS Metrics Documentation](https://github.com/facebookresearch/faiss/wiki/MetricType-and-distances)
- [Python ThreadPoolExecutor](https://docs.python.org/3/library/concurrent.futures.html#threadpoolexecutor)
- [Atomic File Operations](https://docs.python.org/3/library/os.html#os.replace)
- [Pillow Image Verification](https://pillow.readthedocs.io/en/stable/reference/Image.html#PIL.Image.Image.verify)

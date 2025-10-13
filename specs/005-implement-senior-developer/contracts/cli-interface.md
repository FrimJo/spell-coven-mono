# CLI Interface Contracts

**Feature**: 005-implement-senior-developer  
**Date**: 2025-10-14  
**Version**: 1.0.0

## Overview

This document specifies the command-line interfaces for the hardened MTG image database scripts. All changes maintain backward compatibility with existing usage patterns while adding new optional parameters.

## download_images.py

### Purpose
Download and cache MTG card images from Scryfall with robust error handling and parallel processing.

### Usage
```bash
python download_images.py [OPTIONS]
```

### Arguments

#### Existing Arguments (Unchanged)
- `--kind` (string, default: "unique_artwork")
  - Choices: "unique_artwork", "default_cards", "all_cards"
  - Which Scryfall bulk dataset to use
  
- `--cache` (string, default: "image_cache")
  - Directory to cache downloaded images
  
- `--limit` (int, optional)
  - Limit number of faces for testing
  - Must be >= 0 or null

#### New Arguments
- `--workers` (int, default: 16)
  - Number of parallel download workers
  - Must be between 1 and 128
  - Use 1 for sequential downloads
  - Recommended: 10-32 for most systems

- `--timeout-connect` (int, default: 5)
  - Connection timeout in seconds
  - Must be >= 1

- `--timeout-read` (int, default: 30)
  - Read timeout in seconds
  - Must be >= 5

- `--max-retries` (int, default: 5)
  - Maximum retry attempts for failed downloads
  - Must be >= 0

### Exit Codes
- `0`: Success
- `1`: Invalid arguments or configuration error
- `2`: All downloads failed (zero successful)

### Output
Prints to stdout:
- Progress bar during downloads
- Summary statistics:
  - Total faces attempted
  - Successfully cached
  - Failed downloads
  - Success rate percentage

### Examples
```bash
# Basic usage (default settings)
python download_images.py

# Fast test with 100 images
python download_images.py --limit 100

# Sequential downloads (debugging)
python download_images.py --workers 1

# High-throughput parallel downloads
python download_images.py --workers 32

# Conservative timeouts for slow networks
python download_images.py --timeout-read 60
```

---

## build_embeddings.py

### Purpose
Build FAISS index from cached images with validation, checkpointing, and configurable parameters.

### Usage
```bash
python build_embeddings.py [OPTIONS]
```

### Arguments

#### Existing Arguments (Unchanged)
- `--kind` (string, default: "unique_artwork")
  - Choices: "unique_artwork", "default_cards", "all_cards"
  - Which Scryfall bulk dataset to use
  
- `--out` (string, default: "index_out")
  - Directory to write index and metadata
  
- `--cache` (string, default: "image_cache")
  - Directory with cached images
  
- `--limit` (int, optional)
  - Limit number of faces for testing
  - Must be >= 0 or null

- `--batch` (int, default: 64)
  - Embedding batch size
  - Must be >= 1
  
- `--size` (int, default: 384)
  - Square resize for images before CLIP preprocess
  - Must be >= 64

#### New Arguments
- `--hnsw-m` (int, default: 32)
  - HNSW connectivity parameter
  - Must be between 4 and 128
  - Higher = better recall, larger index, slower build
  - Recommended: 16 (fast), 32 (balanced), 64 (quality)

- `--hnsw-ef-construction` (int, default: 200)
  - HNSW build-time accuracy parameter
  - Must be >= hnsw-m and <= 2000
  - Higher = better recall, slower build
  - Recommended: 100 (fast), 200 (balanced), 400 (quality)

- `--checkpoint-frequency` (int, default: 500)
  - Save checkpoint every N images
  - Must be >= 100
  - Set to 0 to disable checkpointing

- `--validate-cache` (flag, default: true)
  - Validate cached images before embedding
  - Use --no-validate-cache to skip (not recommended)

- `--resume` (flag, default: true)
  - Resume from checkpoint if available
  - Use --no-resume to start fresh

### Exit Codes
- `0`: Success
- `1`: Invalid arguments or configuration error
- `2`: No valid images to embed (zero vectors)
- `3`: Cache directory does not exist

### Output
Prints to stdout:
- Progress bar during embedding
- Validation warnings for corrupted files
- Checkpoint save notifications
- Summary statistics:
  - Total records
  - Missing from cache
  - Validation failures
  - Successfully indexed
  - Success rate percentage

Writes to output directory:
- `mtg_embeddings.npy`: Raw float32 embeddings
- `mtg_cards.faiss`: HNSW index
- `mtg_meta.jsonl`: Card metadata (one JSON per line)
- `build_manifest.json`: Provenance metadata
- `checkpoint.npz`: Checkpoint data (if interrupted)
- `checkpoint_meta.json`: Checkpoint metadata

### Examples
```bash
# Basic usage (default settings)
python build_embeddings.py

# Fast development build
python build_embeddings.py --limit 1000 --hnsw-m 16 --hnsw-ef-construction 100

# High-quality production build
python build_embeddings.py --hnsw-m 64 --hnsw-ef-construction 400

# Disable checkpointing for small datasets
python build_embeddings.py --limit 500 --checkpoint-frequency 0

# Resume interrupted build
python build_embeddings.py  # Automatically detects checkpoint

# Force fresh build (ignore checkpoint)
python build_embeddings.py --no-resume
```

---

## build_mtg_faiss.py (Legacy)

### Purpose
Legacy single-step builder that downloads and embeds in one pass. Updated with same hardening improvements.

### Usage
```bash
python build_mtg_faiss.py [OPTIONS]
```

### Arguments
Combines arguments from both download_images.py and build_embeddings.py (see above for details).

### Notes
- Maintained for backward compatibility
- Two-step process (download_images.py → build_embeddings.py) is recommended
- Applies same fixes: retry logic, validation, configurable FAISS params

---

## validate_cache.py (New Utility)

### Purpose
Standalone tool to validate cached images without building embeddings.

### Usage
```bash
python scripts/validate_cache.py [OPTIONS]
```

### Arguments
- `--cache` (string, required)
  - Directory with cached images to validate

- `--fix` (flag, default: false)
  - Remove invalid files automatically
  - Use with caution

- `--report` (string, optional)
  - Write validation report to JSON file

### Exit Codes
- `0`: All files valid
- `1`: Some files invalid (see report)
- `2`: Cache directory does not exist

### Output
Prints to stdout:
- Validation progress bar
- List of invalid files with reasons
- Summary statistics

Optional JSON report:
```json
{
  "version": "1.0.0",
  "timestamp": "2025-10-14T00:00:00Z",
  "cache_directory": "/path/to/cache",
  "total_files": 1000,
  "valid_files": 995,
  "invalid_files": 5,
  "failures": [
    {
      "filename": "abc123.jpg",
      "reason": "Truncated file",
      "size_bytes": 1024
    }
  ]
}
```

### Examples
```bash
# Validate cache
python scripts/validate_cache.py --cache image_cache

# Validate and generate report
python scripts/validate_cache.py --cache image_cache --report validation_report.json

# Validate and remove invalid files
python scripts/validate_cache.py --cache image_cache --fix
```

---

## Build Manifest Schema

### File: build_manifest.json

Generated by build_embeddings.py in the output directory.

### Schema Version: 1.0.0

```json
{
  "version": "1.0.0",
  "timestamp": "2025-10-14T00:00:00Z",
  "parameters": {
    "kind": "unique_artwork",
    "batch_size": 64,
    "target_size": 384,
    "hnsw_m": 32,
    "hnsw_ef_construction": 200
  },
  "statistics": {
    "total_records": 20000,
    "successful_embeddings": 19800,
    "failed_embeddings": 200,
    "success_rate": 0.99,
    "missing_from_cache": 150,
    "validation_failures": 50
  },
  "environment": {
    "python_version": "3.10.12",
    "numpy_version": "1.26.4",
    "torch_version": "2.4.1",
    "faiss_version": "1.7.4",
    "clip_model": "ViT-B/32"
  },
  "git_commit": "abc123def456" // optional
}
```

### Field Descriptions

- `version`: Semantic version of manifest schema
- `timestamp`: ISO 8601 timestamp of build completion
- `parameters`: Build configuration used
  - `kind`: Scryfall bulk dataset type
  - `batch_size`: CLIP embedding batch size
  - `target_size`: Image resize dimension
  - `hnsw_m`: FAISS connectivity parameter
  - `hnsw_ef_construction`: FAISS build accuracy parameter
- `statistics`: Build outcome metrics
  - `total_records`: Total card faces in dataset
  - `successful_embeddings`: Successfully embedded images
  - `failed_embeddings`: Failed to embed (missing or invalid)
  - `success_rate`: Ratio of successful to total (0.0 to 1.0)
  - `missing_from_cache`: Images not found in cache
  - `validation_failures`: Images that failed validation
- `environment`: Software versions used
  - `python_version`: Python interpreter version
  - `numpy_version`: NumPy library version
  - `torch_version`: PyTorch library version
  - `faiss_version`: FAISS library version
  - `clip_model`: CLIP model identifier
- `git_commit`: Git commit hash (optional, if available)

### Versioning

- **1.0.0**: Initial schema
- Future versions will follow semantic versioning:
  - MAJOR: Breaking changes (field removal, type changes)
  - MINOR: Additions (new optional fields)
  - PATCH: Documentation clarifications

---

## Checkpoint Schema

### Files: checkpoint.npz, checkpoint_meta.json

Generated during long-running embedding jobs.

### checkpoint.npz (NumPy compressed archive)

Contains:
- `embeddings`: np.ndarray, shape=(processed_count, 512), dtype=float32
- `indices`: np.ndarray, shape=(valid_count,), dtype=int64
- `good_mask`: np.ndarray, shape=(processed_count,), dtype=bool

### checkpoint_meta.json

```json
{
  "timestamp": 1697241600.0,
  "processed_count": 2500,
  "total_count": 5000,
  "parameters": {
    "batch_size": 64,
    "target_size": 384
  }
}
```

### Field Descriptions

- `timestamp`: Unix timestamp of checkpoint creation
- `processed_count`: Number of images processed so far
- `total_count`: Total images to process
- `parameters`: Build parameters (must match for resume)

### Resume Logic

1. Check if checkpoint files exist in output directory
2. Load checkpoint_meta.json
3. Verify parameters match current run (warn if mismatch)
4. Load checkpoint.npz
5. Skip first `processed_count` images
6. Continue from where left off

---

## Error Messages

### Standard Error Format

All scripts use consistent error message format:

```
ERROR: <category>: <specific message>
  Details: <additional context>
  Suggestion: <how to fix>
```

### Common Error Categories

- **Invalid Arguments**: CLI parameter validation failures
- **Configuration Error**: Environment or dependency issues
- **Network Error**: HTTP request failures (after retries)
- **Validation Error**: Image file validation failures
- **Build Error**: FAISS index creation failures

### Examples

```
ERROR: Invalid Arguments: --batch must be >= 1
  Details: Received --batch 0
  Suggestion: Use --batch 64 or higher

ERROR: Build Error: No valid images to embed
  Details: 0 images passed validation out of 100 total
  Suggestion: Check cache directory for corrupted files, re-run download

ERROR: Network Error: Max retries exceeded for https://example.com/image.jpg
  Details: HTTP 503 Service Unavailable after 5 attempts
  Suggestion: Wait a few minutes and retry, or check Scryfall status
```

---

## Backward Compatibility

### Guaranteed Compatibility

- All existing CLI arguments work unchanged
- Default behavior matches previous version (except correctness fixes)
- Output file formats unchanged (FAISS, JSONL, NPY)
- Scripts can be run without new arguments

### New Behavior (Opt-In)

- Parallel downloads: Use `--workers 1` for old sequential behavior
- Checkpointing: Use `--checkpoint-frequency 0` to disable
- Validation: Use `--no-validate-cache` to skip (not recommended)

### Breaking Changes

None. All changes are additive or correctness fixes.

---

## Version History

- **1.0.0** (2025-10-14): Initial hardened version
  - Added retry logic with exponential backoff
  - Added parallel downloads
  - Added image validation
  - Added configurable FAISS parameters
  - Added checkpointing
  - Added build manifest
  - Fixed cosine similarity metric

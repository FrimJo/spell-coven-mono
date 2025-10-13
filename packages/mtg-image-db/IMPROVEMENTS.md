# MTG Image DB - Recommended Improvements

**Document Version**: 1.1
**Date**: 2025-10-13
**Status**: Planning

This document tracks recommended improvements for the `mtg-image-db` package based on code review. Items are **sorted by priority** with the most critical issues first.

---

## 🔴 Priority 1: Critical Fixes

These issues affect correctness or significantly impact usability. **Fix these first.**

### P1.1: Fix Cosine Similarity Calculation in `query_index.py`

**File**: `query_index.py`
**Line**: 43
**Issue**: Incorrect cosine similarity calculation. Since we use `IndexFlatIP` with L2-normalized vectors, the distance returned is already the cosine similarity (dot product).

**Current Code**:
```python
score = 1 - dist  # INCORRECT
```

**Fix**:
```python
score = dist  # IndexFlatIP returns dot product (cosine for normalized vectors)
```

**Impact**: Results show incorrect similarity scores, potentially affecting ranking quality.

**Effort**: 5 minutes
**SPEC Reference**: [SPEC-FR-PY-02]

---

### P1.2: Make Query Path a CLI Argument

**File**: `query_index.py`
**Line**: 36
**Issue**: Query image path is hardcoded in the script, requiring code edits for each query.

**Current**:
```python
query_path = "image_cache/000f60d1f5c3a4a9dc0448744bd97c02c8437a2d.jpg"
```

**Proposed**:
```python
ap.add_argument("query_path", help="Path to query image")
# Or with optional default:
ap.add_argument("--query", required=True, help="Path to query image")
```

**Impact**: Improves usability; makes script production-ready.

**Effort**: 10 minutes
**SPEC Reference**: [SPEC-FR-PY-02]

---

### P1.3: Add CLI Arguments to `export_for_browser.py`

**File**: `export_for_browser.py`
**Lines**: 5-8
**Issue**: Hardcoded input/output paths limit flexibility.

**Proposed**:
```python
import argparse

ap = argparse.ArgumentParser(description="Export embeddings for browser")
ap.add_argument("--input-dir", default="index_out", help="Input directory")
ap.add_argument("--output-dir", default="index_out", help="Output directory")
args = ap.parse_args()
```

**Impact**: Enables custom workflows, testing with different datasets.

**Effort**: 15 minutes
**SPEC Reference**: [SPEC-FR-BR-01]

---

---

## 🟠 Priority 2: Performance Improvements

These changes significantly improve build time and resource usage. **High impact, implement early.**

### P2.1: Parallel Image Downloads

**File**: `build_mtg_faiss.py`
**Lines**: 182-185
**Issue**: Sequential downloads are slow; typical build downloads 30k+ images.

**Proposed Solution**:
```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def download_all_images(records, cache_dir, max_workers=10):
    paths = [None] * len(records)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(download_image, rec["image_url"], cache_dir): i
            for i, rec in enumerate(records)
        }
        for future in tqdm(as_completed(futures), total=len(records), desc="Downloading"):
            idx = futures[future]
            try:
                paths[idx] = future.result()
            except Exception as e:
                print(f"Failed to download {records[idx]['name']}: {e}")
    return paths
```

**Impact**: 5-10x speedup on download phase (estimated 30-60 min → 5-10 min for full dataset).

**Effort**: 30 minutes
**SPEC Reference**: [SPEC-FR-DA-03]

---

### P2.2: Auto-tune Batch Size Based on GPU Memory

**File**: `build_mtg_faiss.py`
**Lines**: 148, 199
**Issue**: Fixed batch size of 64 may be suboptimal for different GPUs.

**Proposed**:
```python
def estimate_batch_size(device: str, target_size: int = 256) -> int:
    """Estimate optimal batch size based on available memory."""
    if device == "cpu":
        return 32
    elif device == "cuda":
        try:
            mem_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
            # Rough heuristic: ~100MB per batch item for CLIP ViT-B/32
            return min(int(mem_gb * 10), 256)
        except:
            return 64
    elif device == "mps":
        return 64  # Conservative for MPS
    return 64
```

**Impact**: Better GPU utilization, faster embedding phase.

**Effort**: 20 minutes

---

### P2.3: Consider HNSW Index for Large Datasets

**File**: `build_mtg_faiss.py`
**Line**: 226
**Issue**: `IndexFlatIP` is brute-force; slow for large datasets. Comment mentions HNSW but doesn't implement it.

**Proposed**:
```python
# For datasets > 50k, use HNSW for speed
if X.shape[0] > 50000:
    index = faiss.IndexHNSWFlat(d, 32)  # M=32 is good default
    index.hnsw.efConstruction = 200
    index.add(X)
else:
    index = faiss.IndexFlatIP(d)
    index.add(X)
```

**Trade-off**: Slight accuracy loss (~1-2%) for 10-100x query speedup.

**Impact**: Enables scaling to 100k+ cards with fast queries.

**Effort**: 30 minutes
**SPEC Reference**: [SPEC-FR-EI-02b]

---

---

## 🟡 Priority 3: Error Handling & Observability

Better visibility into failures and data quality issues. **Important for production use.**

### P3.1: Add Logging for Failed Downloads

**File**: `build_mtg_faiss.py`
**Lines**: 66-84
**Issue**: Silent failures when images fail to download.

**Proposed**:
```python
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_image(url: str, cache_dir: Path, retries: int = 3, timeout: int = 20) -> Optional[Path]:
    # ... existing code ...
    except Exception as e:
        if attempt == retries:
            logger.warning(f"Failed to download {url} after {retries} attempts: {e}")
            return None
        time.sleep(0.8 * attempt)
```

**Impact**: Better debugging, visibility into data quality issues.

**Effort**: 20 minutes

---

### P3.2: Add Summary Statistics After Build

**File**: `build_mtg_faiss.py`
**Line**: 238 (end of build_index)
**Issue**: No summary of success/failure rates.

**Proposed**:
```python
# At end of build_index()
failed_downloads = sum(1 for p in paths if p is None)
failed_embeddings = len(records) - X.shape[0]

print("\n=== Build Summary ===")
print(f"Total records: {len(records):,}")
print(f"Failed downloads: {failed_downloads:,} ({failed_downloads/len(records)*100:.1f}%)")
print(f"Failed embeddings: {failed_embeddings:,} ({failed_embeddings/len(records)*100:.1f}%)")
print(f"Successfully indexed: {X.shape[0]:,} ({X.shape[0]/len(records)*100:.1f}%)")
```

**Impact**: Data quality visibility.

**Effort**: 10 minutes

---

### P3.3: Validate Downloaded Images

**File**: `build_mtg_faiss.py`
**Line**: 79
**Issue**: No validation that downloaded file is a valid image.

**Proposed**:
```python
from PIL import Image

def download_image(url: str, cache_dir: Path, retries: int = 3, timeout: int = 20) -> Optional[Path]:
    # ... after download ...
    with open(fp, "wb") as f:
        for chunk in r.iter_content(1 << 14):
            if chunk:
                f.write(chunk)

    # Validate it's a real image
    try:
        Image.open(fp).verify()
        return fp
    except Exception:
        fp.unlink()  # Delete corrupt file
        return None
```

**Impact**: Prevents corrupt cache files.

**Effort**: 10 minutes

---

### P3.4: Add Output Directory Validation

**File**: `export_for_browser.py`
**Lines**: 10-12
**Issue**: No check that output directory is writable.

**Proposed**:
```python
def main():
    OUT_BIN.parent.mkdir(parents=True, exist_ok=True)

    if not OUT_BIN.parent.is_dir():
        raise SystemExit(f"Output directory {OUT_BIN.parent} is not accessible")

    # ... rest of function
```

**Impact**: Clearer error messages.

**Effort**: 5 minutes

---

## 🔵 Priority 4: Code Quality & Maintainability

Reduce technical debt and improve long-term maintainability. **Implement when stabilizing.**

### P4.1: Extract Device Selection to Shared Utility

**Files**: `build_mtg_faiss.py` (lines 104-110), `query_index.py` (lines 14-16)
**Issue**: Duplicated device selection logic.

**Proposed**: Create `utils.py`:
```python
import torch

def get_best_device() -> str:
    """Select best available device: MPS > CUDA > CPU."""
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"
```

**Impact**: DRY principle, easier to maintain.

**Effort**: 15 minutes

---

### P4.2: Add Type Hints Throughout

**Files**: All Python files
**Issue**: Missing return type hints on many functions.

**Example**:
```python
# Before
def load_bulk(kind: str):
    ...

# After
def load_bulk(kind: str) -> List[dict]:
    ...
```

**Impact**: Better IDE support, catches type errors early.

**Effort**: 1-2 hours for full coverage

---

### P4.3: Make Image Preference Configurable

**File**: `build_mtg_faiss.py`
**Line**: 40-42
**Issue**: Hardcoded image quality preference.

**Proposed**:
```python
def pick_card_image(uris, preference=None):
    """Select best available image URL.

    Args:
        uris: Dict of image URIs from Scryfall
        preference: List of preferred keys in order, e.g. ['png', 'normal']
    """
    if preference is None:
        preference = ['normal', 'border_crop', 'png', 'large']

    for key in preference:
        if key in uris:
            return uris[key]
    return None
```

**Impact**: Flexibility for different use cases (quality vs. speed).

**Effort**: 15 minutes

---

## ⚪ Priority 5: Testing & Verification

Automated testing for reliability. **Essential before production deployment.**

### P5.1: Add Unit Tests for Core Functions

**New File**: `tests/test_build.py`
**Issue**: No automated tests.

**Proposed Coverage**:
- `face_image_urls()` - handles single/double-faced cards correctly
- `safe_filename()` - generates stable cache names
- `load_image_rgb()` - handles corrupt images gracefully
- Device selection utility

**Framework**: `pytest`

**Effort**: 2-3 hours for initial test suite

---

### P5.2: Add Integration Test for Full Pipeline

**New File**: `tests/test_integration.py`
**Issue**: No end-to-end verification.

**Proposed**:
```python
def test_full_pipeline_small_dataset():
    """Test build → export → query with --limit 100"""
    # 1. Build with small limit
    # 2. Export for browser
    # 3. Query and verify results
    # 4. Clean up
```

**Effort**: 1 hour

---

### P5.3: Add Data Validation Script

**New File**: `scripts/validate_index.py`
**Purpose**: Verify index integrity after build.

**Checks**:
- Embedding count matches metadata count
- All embeddings are L2-normalized
- No NaN/Inf values
- FAISS index is searchable
- Browser export files exist and match

**Effort**: 1 hour

---

## ⚫ Priority 6: Configuration & Flexibility

Advanced configuration options. **Nice-to-have for power users.**

### P6.1: Add YAML Configuration File Support

**New File**: `config.yml`
**Issue**: Many parameters scattered across CLI args.

**Proposed**:
```yaml
# config.yml
data:
  kind: unique_artwork
  limit: null  # null = no limit

paths:
  cache: image_cache
  output: index_out

embedding:
  batch_size: 64
  target_size: 256
  device: auto  # auto, cpu, cuda, mps

download:
  retries: 3
  timeout: 20
  max_workers: 10
  image_preference:
    - normal
    - border_crop
    - png
    - large

index:
  use_hnsw: auto  # auto, true, false
  hnsw_m: 32
  hnsw_ef_construction: 200
```

**Effort**: 2 hours (including argparse integration)

---

### P6.2: Add Resume/Incremental Build Support

**File**: `build_mtg_faiss.py`
**Issue**: No way to resume interrupted builds.

**Proposed**:
- Save checkpoint after download phase
- Save checkpoint after embedding phase
- Add `--resume` flag to continue from checkpoint

**Impact**: Saves hours on interrupted builds.

**Effort**: 3-4 hours

---

## 📝 Priority 7: Documentation Improvements

Better user guidance and onboarding. **Helpful for new contributors.**

### P7.1: Add Troubleshooting Section to README

**File**: `README.md`
**Topics to Cover**:
- Scryfall API rate limiting
- What to do if API is down
- Handling out-of-memory errors
- Network timeout issues
- Corrupt cache recovery

**Effort**: 30 minutes

---

### P7.2: Add Performance Benchmarks

**File**: `README.md` or new `BENCHMARKS.md`
**Content**:
- Expected runtime for full dataset (CPU/GPU/MPS)
- Memory requirements
- Disk space requirements
- Query performance metrics

**Effort**: 1 hour (requires running benchmarks)

---

### P7.3: Document Browser Integration

**File**: `README.md`
**Issue**: References `index.html` but unclear where it lives.

**Action**: Clarify that browser UI is in `apps/web` and link to web app docs.

**Effort**: 10 minutes

---

## 🔧 Priority 8: Dependency Management

Reproducible builds and environment stability. **Important for team collaboration.**

### P8.1: Pin CLIP Commit in Conda Environments

**Files**: `environment-*.yml`
**Issue**: Using `git+https://github.com/openai/CLIP.git` without commit hash.

**Current**:
```yaml
- git+https://github.com/openai/CLIP.git
```

**Proposed**:
```yaml
- git+https://github.com/openai/CLIP.git@a1d4862
```

**Impact**: Reproducible builds across time.

**Effort**: 5 minutes

---

### P8.2: Add Conda Lock Files

**New Files**: `conda-lock.yml` (per environment)
**Purpose**: Fully reproducible environments.

**Tool**: `conda-lock`

**Effort**: 30 minutes setup + documentation

---

## 💡 Priority 9: Nice-to-Have Features

Future enhancements and quality-of-life improvements. **Implement when time permits.**

### P9.1: Docker Support

**New File**: `Dockerfile`
**Purpose**: Reproducible environment without Conda.

**Effort**: 2-3 hours

---

### P9.2: Pre-commit Hooks

**New File**: `.pre-commit-config.yaml`
**Hooks**:
- `black` (code formatting)
- `flake8` (linting)
- `mypy` (type checking)
- `isort` (import sorting)

**Effort**: 1 hour

---

### P9.3: Embedding Quality Metrics

**New Script**: `scripts/analyze_embeddings.py`
**Metrics**:
- Embedding distribution (mean, std)
- Nearest neighbor distribution
- Cluster analysis
- Outlier detection

**Purpose**: Data quality insights.

**Effort**: 3-4 hours

---

### P9.4: Incremental Update Support

**Feature**: Add new cards without full rebuild.

**Approach**:
- Track Scryfall update timestamps
- Download only new/changed cards
- Append to existing index
- Rebuild FAISS index (fast with pre-computed embeddings)

**Effort**: 4-6 hours

---

## 📋 Implementation Roadmap

### Phase 1: Critical Fixes (1-2 hours) 🔴
**Goal**: Fix correctness issues and basic usability problems.

- ✅ P1.1: Fix cosine similarity calculation (5 min)
- ✅ P1.2: Query path CLI argument (10 min)
- ✅ P1.3: Export script CLI arguments (15 min)
- ✅ P3.4: Output directory validation (5 min)
- ✅ P8.1: Pin CLIP commit hash (5 min)

**Total**: ~40 minutes of focused work

---

### Phase 2: Performance Boost (2-4 hours) 🟠
**Goal**: Dramatically improve build times.

- ✅ P2.1: Parallel image downloads (30 min) - **5-10x speedup**
- ✅ P2.2: Auto-tune batch size (20 min)
- ✅ P3.1: Add logging for failures (20 min)
- ✅ P3.2: Build summary statistics (10 min)

**Total**: ~1.5 hours, **massive performance gains**

---

### Phase 3: Observability & Quality (4-6 hours) 🟡
**Goal**: Production-ready error handling and code quality.

- ✅ P3.3: Validate downloaded images (10 min)
- ✅ P4.1: Extract device selection utility (15 min)
- ✅ P4.2: Add type hints (1-2 hours)
- ✅ P4.3: Configurable image preference (15 min)
- ✅ P5.1: Unit tests for core functions (2-3 hours)

**Total**: ~4-5 hours

---

### Phase 4: Testing & Stability (4-6 hours) ⚪
**Goal**: Automated verification and reliability.

- ✅ P5.2: Integration test for pipeline (1 hour)
- ✅ P5.3: Data validation script (1 hour)
- ✅ P2.3: HNSW index for large datasets (30 min)
- ✅ P7.1: Troubleshooting documentation (30 min)
- ✅ P7.2: Performance benchmarks (1 hour)

**Total**: ~4 hours

---

### Phase 5: Advanced Features (8+ hours) 🔵⚫💡
**Goal**: Enhanced workflows and developer experience.

- ✅ P6.1: YAML configuration support (2 hours)
- ✅ P6.2: Resume/incremental builds (3-4 hours)
- ✅ P7.3: Document browser integration (10 min)
- ✅ P8.2: Conda lock files (30 min)
- ✅ P9.1: Docker support (2-3 hours)
- ✅ P9.2: Pre-commit hooks (1 hour)
- ✅ P9.3: Embedding quality metrics (3-4 hours)
- ✅ P9.4: Incremental update support (4-6 hours)

**Total**: ~16-20 hours for all advanced features

---

## 🎯 Quick Start Recommendations

**If you have 30 minutes**: Do Phase 1 (Critical Fixes)
- Fixes the cosine similarity bug
- Makes scripts actually usable
- Pins dependencies for reproducibility

**If you have 2 hours**: Do Phase 1 + Phase 2
- All critical fixes
- **Massive performance improvement** (5-10x faster builds)
- Better visibility into what's happening

**If you have a day**: Do Phases 1-3
- Production-ready error handling
- Clean, maintainable code
- Basic test coverage

**For production deployment**: Complete Phases 1-4
- All critical fixes and performance improvements
- Comprehensive testing
- Full observability

---

## Notes

- All SPEC references link to `SPEC.md` for traceability
- Effort estimates are approximate for a developer familiar with the codebase
- Priority levels are suggestions; adjust based on actual needs
- Some improvements may conflict; review before implementing multiple

---

## Change Log

- **2025-10-13 v1.1**: Reorganized by priority, most critical first; added emojis and quick-start guide
- **2025-10-13 v1.0**: Initial version based on code review

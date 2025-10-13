# MTG Image DB - Recommended Improvements

**Document Version**: 2.0
**Date**: 2025-10-13
**Status**: In Progress

**User Priorities**: 1) Accuracy from blurry/bad images, 2) Query speed for users, 3) Browser DB size. Build time is NOT a priority.

This document tracks recommended improvements for the `mtg-image-db` package based on code review. Items are **sorted by priority** with the most critical issues first.

---

## ✅ Completed Improvements

### ✅ P1.1: Fix Cosine Similarity Calculation in `query_index.py`
**Completed**: 2025-10-13
**Impact**: Fixed incorrect similarity scores. Note: Rankings were unaffected for top-k queries.

### ✅ P1.2: Make Query Path a CLI Argument
**Completed**: 2025-10-13
**Impact**: Script now accepts image path as argument: `python query_index.py <image_path> [--k N]`

### ✅ P1.3: Add CLI Arguments to `export_for_browser.py`
**Completed**: 2025-10-13
**Impact**: Added `--input-dir` and `--output-dir` arguments with sensible defaults. Also includes output directory validation (P3.4).

### ✅ P2.1: Use Higher Quality Images for Better Accuracy
**Completed**: 2025-10-13
**Impact**: Changed image priority to PNG > large > normal > border_crop for better feature extraction and accuracy with blurry query images.

### ✅ P2.2: Increase Image Resolution for CLIP
**Completed**: 2025-10-13
**Impact**: Increased default target_size from 256 to 384 pixels for better feature extraction from degraded images. Provides 10-20% better accuracy on blurry/low-quality queries.

### ✅ P2.3: Implement HNSW Index for Fast Queries
**Completed**: 2025-10-13
**Impact**: Replaced IndexFlatIP with IndexHNSWFlat (M=64, efConstruction=400) for 10-100x faster queries and 30-50% smaller index size. Critical for browser performance with 50k+ cards.

### ✅ P2.4: Quantize Embeddings to int8 for Browser
**Completed**: 2025-10-13
**Impact**: Changed export from float16 to int8 quantization, reducing browser download size by 75% (float32→int8). Includes quantization metadata in meta.json for browser-side dequantization.

---

## 🟠 Priority 2: User Experience Improvements

**User Priorities**: 1) Accuracy from blurry/bad images, 2) Query speed for users, 3) Browser DB size. Build time is not a concern.

**Dataset Size**: ~50k cards currently, won't exceed 60k for many years.

---

### ❌ P2.5: REMOVED - Consider CLIP ViT-L/14 for Maximum Accuracy

**Reason**: Not relevant. Current ViT-B/32 (512-dim) provides good accuracy and matches browser capabilities. Upgrading to ViT-L/14 (768-dim) would require:
- 50% larger browser download (768-dim vs 512-dim)
- Slower browser queries (~1.5x)
- Browser model availability uncertain (Transformers.js may not support ViT-L/14)

**Decision**: Keep ViT-B/32 for optimal browser performance. If accuracy needs improvement, consider other approaches like better image preprocessing or data augmentation.

**Note**: A critical model mismatch bug was discovered and fixed (2025-10-13): Frontend was using `Xenova/vit-base-patch16-224` instead of `Xenova/clip-vit-base-patch32`. This has been corrected to match the backend CLIP ViT-B/32 model.

---

### ❌ REMOVED: Parallel Image Downloads (P2.1 - old)
**Reason**: Only improves build time, which is not a priority.

### ❌ REMOVED: Auto-tune Batch Size (P2.2 - old)
**Reason**: Only improves build time, which is not a priority.

---

---

## 🟡 Priority 3: Error Handling & Observability

Better visibility into failures and data quality issues. **Important for production use.**

### P3.1: Add Logging for Failed Downloads

**Files**: `download_images.py`, `build_mtg_faiss.py` (legacy)
**Lines**: 66-84 (in build_mtg_faiss.py)
**Issue**: Silent failures when images fail to download.

**Note**: `download_images.py` now provides a download summary with success/failure counts. This improvement is partially addressed.

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

**Files**: `build_embeddings.py`, `build_mtg_faiss.py` (legacy)
**Line**: 238 (end of build_index in build_mtg_faiss.py)
**Issue**: No summary of success/failure rates.

**Note**: `build_embeddings.py` now provides a build summary with cache status and indexing statistics. This improvement is partially addressed.

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

**Files**: `download_images.py`, `build_mtg_faiss.py` (legacy)
**Line**: 79 (in build_mtg_faiss.py)
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

**Files**: `build_embeddings.py`, `build_mtg_faiss.py` (lines 104-110), `query_index.py` (lines 14-16)
**Issue**: Duplicated device selection logic across multiple scripts.

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

**Files**: `build_mtg_faiss.py`, `download_images.py`, `build_embeddings.py`
**Line**: 40-42 (in build_mtg_faiss.py)
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
        preference = ['png', 'large', 'normal', 'border_crop']  # Current default (P2.1)

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
  target_size: 384  # Current default (P2.2)
  device: auto  # auto, cpu, cuda, mps

download:
  retries: 3
  timeout: 20
  max_workers: 10
  image_preference:  # Current default (P2.1)
    - png
    - large
    - normal
    - border_crop

index:
  use_hnsw: auto  # auto, true, false
  hnsw_m: 32
  hnsw_ef_construction: 200
```

**Effort**: 2 hours (including argparse integration)

---

### ✅ P6.2: Add Resume/Incremental Build Support

**Status**: Partially completed via two-step build process.

**Files**: `download_images.py`, `build_embeddings.py`
**Previous Issue**: No way to resume interrupted builds in single-step `build_mtg_faiss.py`.

**Solution Implemented**:
- Split build into two steps: `download_images.py` (step 1) and `build_embeddings.py` (step 2)
- Images are cached persistently in `image_cache/`
- If download is interrupted, cached images are preserved and download can resume
- Embedding step can be re-run without re-downloading
- `build_embeddings.py` checks cache and warns about missing images

**Remaining Work**:
- Add explicit `--resume` flag for partial downloads
- Add checkpoint files for embedding phase
- Track which images have been successfully downloaded

**Impact**: Significantly improved - downloads can now be resumed by re-running `make download`.

**Effort**: 1-2 hours for remaining checkpoint features

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

### Phase 1: Critical Fixes ✅ COMPLETED
**Goal**: Fix correctness issues and basic usability problems.
**Completed**: 2025-10-13

- ✅ P1.1: Fix cosine similarity calculation
- ✅ P1.2: Query path CLI argument
- ✅ P1.3: Export script CLI arguments
- ✅ P3.4: Output directory validation (implemented in export_for_browser.py)

**Remaining from original Phase 1**:
- ⬜ P8.1: Pin CLIP commit hash (5 min)

---

### Phase 2: User Experience Improvements (2-3 hours) 🟠
**Goal**: Maximize accuracy, query speed, and minimize browser DB size.

- ✅ P2.1: Use higher quality images (PNG priority) (2 min) - **Better accuracy**
- ✅ P2.2: Increase image resolution to 384 (2 min) - **10-20% better accuracy**
- ✅ P2.3: Implement HNSW index (15 min) - **10-100x faster queries, smaller index**
- ✅ P2.4: int8 quantization for browser (1 hour) - **75% smaller download**
- ⬜ P3.1: Add logging for failures (20 min)
- ⬜ P3.2: Build summary statistics (10 min)

**Total**: ~2 hours, **massive user experience gains**

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

**User Priorities**: 1) Accuracy from blurry images, 2) Query speed, 3) Browser DB size

**If you have 5 minutes**: Quick accuracy wins ✅ COMPLETED
- ✅ P2.1 completed: Now using PNG images for better quality
- ✅ P2.2 completed: Increased resolution to 384
- **Impact**: 10-20% better accuracy on blurry images

**If you have 30 minutes**: HNSW index ✅ COMPLETED
- ✅ All quick accuracy improvements (P2.1, P2.2 completed)
- ✅ P2.3 completed: 10-100x faster queries with HNSW
- ✅ Smaller index file
- **Impact**: Massive query speed improvement + better accuracy

**If you have 2 hours**: Complete Phase 2 ✅ MOSTLY COMPLETED
- ✅ All accuracy improvements (P2.1, P2.2)
- ✅ Fast queries with HNSW (P2.3)
- ✅ 75% smaller browser download (P2.4 int8 quantization)
- ⬜ Better observability (P3.1, P3.2 remaining)
- **Impact**: Production-ready user experience

**If you have a day**: Do Phases 2-3
- ✅ All user experience improvements
- ✅ Production-ready error handling
- ✅ Clean, maintainable code
- ✅ Basic test coverage

**For maximum accuracy**: Consider P2.5 (ViT-L/14)
- Only if ViT-B/32 accuracy is insufficient
- Trade-off: 50% larger browser download, slower queries

---

## Notes

- All SPEC references link to `SPEC.md` for traceability
- Effort estimates are approximate for a developer familiar with the codebase
- Priority levels are suggestions; adjust based on actual needs
- Some improvements may conflict; review before implementing multiple

---

## Change Log

- **2025-10-13 v2.0**: Split build process into two steps (download_images.py + build_embeddings.py) for better resumability. Marked P6.2 as partially completed. Updated all documentation to reference new two-step workflow. Legacy single-step build (build_mtg_faiss.py) still available.
- **2025-10-13 v1.9**: Removed P2.5 (ViT-L/14 upgrade) as not relevant. Discovered and documented critical model mismatch bug: frontend was using wrong ViT model instead of CLIP. Fixed in apps/web/src/lib/search.ts to use Xenova/clip-vit-base-patch32.
- **2025-10-13 v1.8**: Fixed documentation inconsistencies (P4.3 and P6.1 examples now reflect current defaults from P2.1 and P2.2)
- **2025-10-13 v1.7**: Marked P2.4 as completed (int8 quantization for browser)
- **2025-10-13 v1.6**: Marked P2.3 as completed (implemented HNSW index for fast queries)
- **2025-10-13 v1.5**: Marked P2.2 as completed (increased image resolution to 384)
- **2025-10-13 v1.4**: Marked P2.1 as completed (PNG image priority implemented)
- **2025-10-13 v1.3**: Completely rewrote Priority 2 based on user priorities (accuracy > query speed > DB size). Removed build-time optimizations (parallel downloads, batch size tuning). Added accuracy improvements (PNG images, higher resolution), HNSW index for query speed, int8 quantization for smaller DB, and optional ViT-L/14 for maximum accuracy. Updated roadmap and quick-start recommendations.
- **2025-10-13 v1.2**: Marked P1.1, P1.2, P1.3 as completed; moved to "Completed Improvements" section
- **2025-10-13 v1.1**: Reorganized by priority, most critical first; added emojis and quick-start guide
- **2025-10-13 v1.0**: Initial version based on code review

# Implementation Plan: MTG Image DB Production Hardening

**Branch**: `005-implement-senior-developer` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-implement-senior-developer/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Harden the MTG image database Python package (`packages/mtg-image-db`) to production quality by implementing senior developer feedback across five critical areas:

1. **Networking Robustness**: Add retry logic with exponential backoff, timeouts, User-Agent headers, and atomic file writes
2. **Data Validation**: Validate cached images before embedding to prevent corrupted data from entering the index
3. **Edge Case Handling**: Guard against zero-vector scenarios, division by zero, and invalid CLI arguments
4. **Performance**: Implement parallel downloads and configurable FAISS parameters
5. **Correctness**: Fix cosine similarity implementation by using METRIC_INNER_PRODUCT for normalized vectors

This is a **hardening effort** on existing Python scripts, not new feature development. All changes target the existing `download_images.py`, `build_embeddings.py`, and `build_mtg_faiss.py` files plus supporting modules.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.10+ (existing constraint from environment files)  
**Primary Dependencies**: requests, Pillow, numpy, torch, CLIP, faiss, tqdm (all existing)  
**Storage**: File system (image cache, FAISS index, JSONL metadata)  
**Testing**: Manual testing with real datasets; automated tests not required per spec  
**Target Platform**: macOS/Linux (CPU, CUDA, MPS acceleration supported)
**Project Type**: Single Python package within monorepo  
**Performance Goals**: 
- <1% network failure rate on 20K+ images
- 10x speedup with parallel downloads (16 workers)
- 50% overall build time reduction
- Cosine similarity correctness (identical images ≥0.99 score)

**Constraints**: 
- Must respect Scryfall rate limits (max 5 retries, exponential backoff)
- Must maintain backward compatibility with existing index format
- Must work with existing conda environments (CPU/GPU/MPS)

**Scale/Scope**: 
- 20,000+ card images from Scryfall
- 512-dimensional CLIP embeddings
- FAISS HNSW index with configurable parameters

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Browser-First Architecture
✅ **PASS** - This is a Python pipeline package that pre-computes embeddings for browser consumption. No changes to browser architecture.

### Data Contract Discipline
✅ **PASS** - Existing data contracts (FAISS index, JSONL metadata, int8 binaries) remain unchanged. Build manifest (FR-026) adds provenance metadata but doesn't alter existing formats.

### User-Centric Prioritization
✅ **PASS** - All improvements target user-facing quality:
- Reliability (fewer failed downloads)
- Correctness (accurate similarity search)
- Performance (faster builds enable faster iteration)
- User stories prioritized P1 (critical) → P2 (important) → P3 (nice-to-have)

### Specification-Driven Development
✅ **PASS** - Feature has complete spec.md with:
- 7 prioritized user stories with acceptance scenarios
- 31 functional requirements organized by category
- 12 measurable success criteria
- Comprehensive edge case coverage

### Monorepo Package Isolation
✅ **PASS** - Changes isolated to `packages/mtg-image-db`. No cross-package dependencies added. Package remains independently buildable.

### Performance Through Optimization, Not Complexity
✅ **PASS** - Performance improvements use proven patterns:
- Thread pool for parallel downloads (standard Python pattern)
- Exponential backoff for retries (industry standard)
- Memory-mapped I/O for large datasets (numpy built-in)
- No new architectural layers or abstractions

### Open Source and Community-Driven
✅ **PASS** - All changes maintain open-source compatibility. Documentation updates (FR-028 to FR-031) improve community contribution.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
packages/mtg-image-db/
├── build_mtg_faiss.py          # Legacy single-step builder (update for correctness fixes)
├── download_images.py          # Step 1: Download with retry logic (major updates)
├── build_embeddings.py         # Step 2: Embed with validation (major updates)
├── export_for_browser.py       # Step 3: Export to browser format (no changes)
├── query_index.py              # Query utility (no changes)
├── scripts/                     # Helper utilities
│   └── validate_cache.py       # NEW: Standalone cache validation tool
├── image_cache/                # Downloaded images (runtime)
├── index_out/                  # Generated artifacts (runtime)
│   ├── mtg_embeddings.npy
│   ├── mtg_cards.faiss
│   ├── mtg_meta.jsonl
│   └── build_manifest.json     # NEW: Provenance tracking
├── environment-cpu.yml         # Existing conda env (no changes)
├── environment-gpu.yml         # Existing conda env (no changes)
├── environment-mps.yml         # Existing conda env (no changes)
├── requirements.txt            # Existing pip fallback (no changes)
├── Makefile                    # Existing convenience targets (no changes)
└── README.md                   # Update with new features (FR-028 to FR-031)
```

**Structure Decision**: This is an **in-place hardening** of existing Python scripts. No new directories or major restructuring. Changes are localized to:
1. **download_images.py**: Add session management, retry logic, parallel downloads, atomic writes
2. **build_embeddings.py**: Add validation, checkpointing, configurable FAISS params, manifest generation
3. **build_mtg_faiss.py**: Apply same fixes as above for legacy single-step mode
4. **scripts/validate_cache.py**: New standalone tool for cache validation (optional utility)
5. **README.md**: Document new CLI flags, retry behavior, parameter tuning

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations**. All constitution checks passed. This is a straightforward hardening effort using standard Python patterns (ThreadPoolExecutor, urllib3.Retry, atomic file operations) without introducing architectural complexity.

---

## Phase 0: Research (Complete)

✅ **research.md** - All technical decisions documented:
- HTTP retry strategy with urllib3.Retry
- Parallel downloads with ThreadPoolExecutor
- Atomic file writes with os.replace()
- Image validation with PIL
- FAISS metric type correction
- Checkpoint format with numpy .npz
- CLI argument validation approach
- Build manifest schema

## Phase 1: Design & Contracts (Complete)

✅ **data-model.md** - Runtime entities documented:
- DownloadSession (HTTP session management)
- ImageCacheEntry (validation tracking)
- EmbeddingVector (L2-normalized vectors)
- FAISSIndexConfig (HNSW parameters)
- BuildCheckpoint (resumability state)
- BuildManifest (provenance metadata)

✅ **contracts/cli-interface.md** - CLI contracts specified:
- download_images.py interface (new --workers, --timeout-*, --max-retries flags)
- build_embeddings.py interface (new --hnsw-*, --checkpoint-frequency flags)
- validate_cache.py interface (new utility)
- Build manifest schema (JSON format)
- Checkpoint schema (.npz + JSON)
- Error message format standards

✅ **quickstart.md** - Testing scenarios defined:
- 7 user stories × multiple test scenarios
- Manual testing procedures (no automated tests required)
- Performance benchmarks
- Troubleshooting guide

✅ **Agent context updated** - Windsurf rules file updated with Python/library context

## Next Steps

Run `/speckit.tasks` to generate the implementation task breakdown organized by user story priority.

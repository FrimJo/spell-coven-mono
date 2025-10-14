# Tasks: MTG Image DB Production Hardening

**Input**: Design documents from `/specs/005-implement-senior-developer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-interface.md

**Tests**: No automated tests required per specification. Manual testing scenarios provided in quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- All changes in `packages/mtg-image-db/`
- This is in-place hardening of existing Python scripts
- No new directory structure needed

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared utilities and helper functions needed across all user stories

- [x] T001 [P] Create helper module `packages/mtg-image-db/helpers/session.py` for HTTP session management with retry logic
- [x] T002 [P] Create helper module `packages/mtg-image-db/helpers/validation.py` for image validation functions
- [x] T003 [P] Create helper module `packages/mtg-image-db/helpers/cli_validation.py` for CLI argument validation
- [x] T004 [P] Create helper module `packages/mtg-image-db/helpers/atomic_io.py` for atomic file write operations

**Checkpoint**: Helper modules ready for use in user story implementations

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core fixes that MUST be complete before user stories can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Remove unused imports from `packages/mtg-image-db/download_images.py` (io, json, gzip)
- [x] T006 Remove unused imports from `packages/mtg-image-db/build_embeddings.py` (io, json, gzip, glob)
- [x] T007 Update `packages/mtg-image-db/build_mtg_faiss.py` safe_filename() to include URL hash for collision prevention
- [x] T008 Fix FAISS metric type in `packages/mtg-image-db/build_mtg_faiss.py` line 227: change IndexHNSWFlat to use METRIC_INNER_PRODUCT
- [x] T009 Fix FAISS metric type in `packages/mtg-image-db/build_embeddings.py`: use METRIC_INNER_PRODUCT for IndexHNSWFlat
- [x] T010 Add vector normalization verification in `packages/mtg-image-db/build_mtg_faiss.py` before FAISS index creation
- [x] T011 Add vector normalization verification in `packages/mtg-image-db/build_embeddings.py` before FAISS index creation

**Checkpoint**: Foundation ready - correctness fixes applied, user story implementation can now begin

---

## Phase 3: User Story 1 - Reliable Large-Scale Image Downloads (Priority: P1) 🎯 MVP

**Goal**: Enable robust, resumable image downloads with retry logic, timeouts, and atomic writes

**Independent Test**: Run `python download_images.py --kind unique_artwork --limit 1000` and verify <1% failure rate, no hangs, atomic file writes

### Implementation for User Story 1

- [x] T012 [US1] Add CLI arguments to `packages/mtg-image-db/download_images.py`: --workers (default 16), --timeout-connect (default 5), --timeout-read (default 30), --max-retries (default 5)
- [x] T013 [US1] Create DownloadSession class in `packages/mtg-image-db/helpers/session.py` using requests.Session() with urllib3.Retry strategy (max 5 retries, exponential backoff 1s/2s/4s/8s/16s, status_forcelist=[429,500,502,503,504])
- [x] T014 [US1] Add User-Agent header to session in `packages/mtg-image-db/helpers/session.py`: "MTG-Image-DB/1.0 (+https://github.com/FrimJo/spell-coven-mono; ifrim@me.com)"
- [x] T015 [US1] Implement atomic file write in `packages/mtg-image-db/helpers/atomic_io.py`: write to .part file, fsync, then os.replace()
- [x] T016 [US1] Update download_image() in `packages/mtg-image-db/build_mtg_faiss.py` to use DownloadSession and atomic writes
- [x] T017 [US1] Implement parallel downloads in `packages/mtg-image-db/download_images.py` using ThreadPoolExecutor with configurable worker count
- [x] T018 [US1] Add progress tracking with tqdm for parallel downloads in `packages/mtg-image-db/download_images.py`
- [x] T019 [US1] Add guard for division by zero in download summary statistics in `packages/mtg-image-db/download_images.py` (handle len(records)==0)
- [x] T020 [US1] Update `packages/mtg-image-db/build_mtg_faiss.py` download_image() to use same session management and atomic writes

**Checkpoint**: Downloads are robust, parallel, and resumable. Test with quickstart.md scenarios 1.1-1.4

---

## Phase 4: User Story 2 - Data Integrity Validation (Priority: P1)

**Goal**: Validate all cached images before embedding to prevent corrupted data from entering the index

**Independent Test**: Place corrupted files in cache, run `python build_embeddings.py`, verify they are detected and excluded

### Implementation for User Story 2

- [x] T021 [US2] Implement validate_image() function in `packages/mtg-image-db/helpers/validation.py` using PIL.Image.verify() and Image.load()
- [x] T022 [US2] Add validation pass in `packages/mtg-image-db/build_embeddings.py` before embedding phase: validate all cached files
- [x] T023 [US2] Add validation logging in `packages/mtg-image-db/build_embeddings.py`: log filename and reason for each validation failure
- [x] T024 [US2] Update statistics reporting in `packages/mtg-image-db/build_embeddings.py` to include validation failure count
- [x] T025 [US2] Add --validate-cache / --no-validate-cache flag to `packages/mtg-image-db/build_embeddings.py` (default: true)
- [x] T026 [US2] Add validation pass in `packages/mtg-image-db/build_mtg_faiss.py` before embedding phase
- [x] T027 [P] [US2] Create standalone validation utility `packages/mtg-image-db/scripts/validate_cache.py` with --cache, --fix, --report arguments
- [x] T028 [US2] Verify safe_filename() in `packages/mtg-image-db/build_mtg_faiss.py` includes URL hash (completed in T007)

**Checkpoint**: All corrupted files are detected and excluded. Test with quickstart.md scenarios 2.1-2.3

---

## Phase 5: User Story 3 - Graceful Edge Case Handling (Priority: P1)

**Goal**: Handle edge cases (zero images, empty datasets, invalid args) with clear error messages and clean exits

**Independent Test**: Run scripts with edge case inputs (--limit 0, empty cache, all 404s) and verify graceful exits with clear messages

### Implementation for User Story 3

- [x] T029 [US3] Implement validate_args() in `packages/mtg-image-db/helpers/cli_validation.py` to check: limit>=0, batch>=1, size>=64, workers 1-128
- [x] T030 [US3] Add validate_args() call at start of main() in `packages/mtg-image-db/download_images.py`
- [x] T031 [US3] Add validate_args() call at start of main() in `packages/mtg-image-db/build_embeddings.py`
- [x] T032 [US3] Add validate_args() call at start of main() in `packages/mtg-image-db/build_mtg_faiss.py`
- [x] T033 [US3] Add zero-vector check in `packages/mtg-image-db/build_embeddings.py` before FAISS index creation: if X.shape[0] == 0, exit with error "No valid images to embed"
- [x] T034 [US3] Add zero-vector check in `packages/mtg-image-db/build_mtg_faiss.py` before FAISS index creation
- [x] T035 [US3] Guard all percentage calculations in `packages/mtg-image-db/download_images.py`: check len(records) > 0 before division
- [x] T036 [US3] Guard all percentage calculations in `packages/mtg-image-db/build_embeddings.py`: check len(records) > 0 before division
- [x] T037 [US3] Guard all percentage calculations in `packages/mtg-image-db/build_mtg_faiss.py`: check len(records) > 0 before division

**Checkpoint**: All edge cases handled gracefully. Test with quickstart.md scenarios 3.1-3.3

---

## Phase 6: User Story 4 - High-Performance Parallel Processing (Priority: P2)

**Goal**: Achieve 10x+ speedup with parallel downloads while maintaining data integrity

**Independent Test**: Compare download times: sequential (--workers 1) vs parallel (--workers 16) on 1,000 images

### Implementation for User Story 4

- [x] T038 [US4] Ensure ThreadPoolExecutor implementation in `packages/mtg-image-db/download_images.py` uses shared session (from T017)
- [x] T039 [US4] Add worker count validation in `packages/mtg-image-db/helpers/cli_validation.py`: 1 <= workers <= 128
- [x] T040 [US4] Add thread-safe progress tracking in `packages/mtg-image-db/download_images.py` using tqdm with lock parameter
- [x] T041 [US4] Test and verify no race conditions in parallel downloads: all files written atomically via .part files

**Checkpoint**: Parallel downloads achieve 10x+ speedup. Test with quickstart.md scenarios 4.1-4.2

---

## Phase 7: User Story 5 - Configurable Index Quality vs Performance (Priority: P2)

**Goal**: Expose HNSW parameters as CLI flags with sensible defaults for different use cases

**Independent Test**: Build indexes with different parameters (M=16 vs M=64) and measure build time differences

### Implementation for User Story 5

- [x] T042 [US5] Add CLI arguments to `packages/mtg-image-db/build_embeddings.py`: --hnsw-m (default 32), --hnsw-ef-construction (default 200)
- [x] T043 [US5] Add HNSW parameter validation in `packages/mtg-image-db/helpers/cli_validation.py`: 4 <= M <= 128, efConstruction >= M
- [x] T044 [US5] Update FAISS index creation in `packages/mtg-image-db/build_embeddings.py` to use CLI-provided M and efConstruction values
- [x] T045 [US5] Add CLI arguments to `packages/mtg-image-db/build_mtg_faiss.py`: --hnsw-m (default 32), --hnsw-ef-construction (default 200)
- [x] T046 [US5] Update FAISS index creation in `packages/mtg-image-db/build_mtg_faiss.py` to use CLI-provided M and efConstruction values
- [x] T047 [US5] Update build summary output in `packages/mtg-image-db/build_embeddings.py` to display HNSW parameters used

**Checkpoint**: HNSW parameters are configurable. Test with quickstart.md scenarios 5.1-5.2

---

## Phase 8: User Story 6 - Correct Distance Metric Implementation (Priority: P1)

**Goal**: Ensure cosine similarity is correctly implemented using METRIC_INNER_PRODUCT for normalized vectors

**Independent Test**: Query identical image against itself and verify similarity score ≥0.99

### Implementation for User Story 6

- [x] T048 [US6] Verify T008 and T009 (METRIC_INNER_PRODUCT fix) are complete
- [x] T049 [US6] Verify T010 and T011 (normalization verification) are complete
- [x] T050 [US6] Add assertion in `packages/mtg-image-db/build_embeddings.py` after embedding: verify all vector norms are 1.0 ± 1e-5
- [x] T051 [US6] Add assertion in `packages/mtg-image-db/build_mtg_faiss.py` after embedding: verify all vector norms are 1.0 ± 1e-5
- [ ] T052 [US6] Update `packages/mtg-image-db/query_index.py` to display distance metric type from loaded index

**Checkpoint**: Cosine similarity is mathematically correct. Test with quickstart.md scenarios 6.1-6.3

---

## Phase 9: User Story 7 - Progress Tracking and Resumability (Priority: P3)

**Goal**: Enable long-running jobs to resume from checkpoints and display detailed progress

**Independent Test**: Start embedding job, interrupt at 50%, restart, verify it resumes from checkpoint

### Implementation for User Story 7

- [x] T053 [US7] Add CLI argument to `packages/mtg-image-db/build_embeddings.py`: --checkpoint-frequency (default 500)
- [ ] T054 [US7] Implement checkpoint save in `packages/mtg-image-db/build_embeddings.py`: save checkpoint.npz every N images
- [ ] T055 [US7] Implement checkpoint metadata save in `packages/mtg-image-db/build_embeddings.py`: save checkpoint_meta.json with timestamp, counts, parameters
- [x] T056 [US7] Add CLI argument to `packages/mtg-image-db/build_embeddings.py`: --resume / --no-resume (default: true)
- [ ] T057 [US7] Implement checkpoint loading in `packages/mtg-image-db/build_embeddings.py`: detect and load checkpoint on startup if --resume
- [ ] T058 [US7] Add parameter mismatch warning in `packages/mtg-image-db/build_embeddings.py`: warn if checkpoint parameters differ from current run
- [x] T059 [US7] Enhance progress display in `packages/mtg-image-db/build_embeddings.py`: show throughput (images/sec) and ETA
- [ ] T060 [US7] Delete checkpoint files in `packages/mtg-image-db/build_embeddings.py` on successful completion
- [ ] T060a [US7] (Optional) Implement memory-mapped output in `packages/mtg-image-db/build_embeddings.py` using np.memmap for embeddings array to reduce RAM usage on very large datasets

**Checkpoint**: Checkpointing works and saves 80%+ of work on interruption. Test with quickstart.md scenarios 7.1-7.3

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, build manifest, and final cleanup

- [x] T061 [P] Implement build manifest generation in `packages/mtg-image-db/build_embeddings.py`: create build_manifest.json with version, timestamp, parameters, statistics, environment
- [x] T062 [P] Implement build manifest generation in `packages/mtg-image-db/build_mtg_faiss.py`: create build_manifest.json
- [x] T063 [P] Update `packages/mtg-image-db/README.md`: document --workers flag and parallel download tuning (FR-028)
- [x] T064 [P] Update `packages/mtg-image-db/README.md`: document retry behavior and rate limiting courtesy (FR-029)
- [x] T065 [P] Update `packages/mtg-image-db/README.md`: document HNSW parameter tuning guidelines (FR-030)
- [x] T066 [P] Update `packages/mtg-image-db/README.md`: document query-time efSearch parameter (FR-031)
- [x] T067 [P] Update `packages/mtg-image-db/README.md`: add troubleshooting section for validation failures, rate limiting, checkpoint issues
- [x] T068 [P] Add docstrings to all new helper modules in `packages/mtg-image-db/helpers/`
- [x] T069 Verify all unused imports removed (double-check T005, T006)
- [ ] T070 Run manual tests from `specs/005-implement-senior-developer/quickstart.md` for all user stories
- [x] T070a Verify kept indices alignment: confirm embeddings, metadata, and FAISS index all use same kept indices array

**Checkpoint**: All documentation complete, ready for production use

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - US1, US2, US3, US6 are P1 (critical) - should be done first
  - US4, US5 are P2 (important) - can be done in parallel with P1 or after
  - US7 is P3 (nice-to-have) - can be done last
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Reliable Downloads)**: Can start after Foundational - No dependencies on other stories
- **US2 (Data Validation)**: Can start after Foundational - Independent of US1 but logically follows
- **US3 (Edge Cases)**: Can start after Foundational - Independent of US1/US2
- **US4 (Parallel Processing)**: Depends on US1 (uses same download infrastructure)
- **US5 (Configurable HNSW)**: Can start after Foundational - Independent of all others
- **US6 (Correct Metrics)**: Foundational phase includes the core fix - this phase adds verification
- **US7 (Checkpointing)**: Can start after Foundational - Independent of all others

### Within Each User Story

- Helper modules (Phase 1) before user story implementations
- Foundational fixes (Phase 2) before any user story work
- Within each story: utilities → core implementation → integration → testing

### Parallel Opportunities

- **Phase 1**: All helper modules (T001-T004) can be created in parallel
- **Phase 2**: T005-T006 (import cleanup) can run in parallel; T007-T011 (correctness fixes) are sequential within same files
- **Phase 3 (US1)**: T013-T014 (session setup) can run in parallel; T016 and T020 are sequential (same file)
- **Phase 4 (US2)**: T021 (validation function) can run in parallel with T027 (standalone utility)
- **Phase 5 (US3)**: T029 (validation function) can run before T030-T032 (usage); T033-T037 are sequential within files
- **Phase 10**: All README updates (T063-T067) and docstrings (T068) can run in parallel

---

## Parallel Example: User Story 1 (Reliable Downloads)

```bash
# These can run in parallel (different modules):
Task T013: "Create DownloadSession class in helpers/session.py"
Task T014: "Add User-Agent header to session in helpers/session.py"
Task T015: "Implement atomic file write in helpers/atomic_io.py"

# These must run sequentially (same file):
Task T016: "Update download_image() in build_mtg_faiss.py"
Task T020: "Update build_mtg_faiss.py download_image()"
```

---

## Parallel Example: User Story 2 (Data Validation)

```bash
# These can run in parallel (different files):
Task T021: "Implement validate_image() in helpers/validation.py"
Task T027: "Create standalone validation utility scripts/validate_cache.py"

# These must run sequentially (same file):
Task T022: "Add validation pass in build_embeddings.py"
Task T023: "Add validation logging in build_embeddings.py"
Task T024: "Update statistics in build_embeddings.py"
```

---

## Implementation Strategy

### MVP First (P1 User Stories Only)

1. Complete Phase 1: Setup (helper modules)
2. Complete Phase 2: Foundational (correctness fixes - CRITICAL)
3. Complete Phase 3: US1 (Reliable Downloads)
4. Complete Phase 4: US2 (Data Validation)
5. Complete Phase 5: US3 (Edge Cases)
6. Complete Phase 8: US6 (Correct Metrics - verification)
7. **STOP and VALIDATE**: Test all P1 stories with quickstart.md
8. Deploy/use if ready

### Incremental Delivery

1. **Foundation** (Phases 1-2) → Core fixes applied
2. **MVP** (Phases 3-5, 8) → All P1 stories complete → Production-ready
3. **Enhanced** (Phases 6-7) → Add P2 stories → Better performance
4. **Complete** (Phase 9) → Add P3 story → Full feature set
5. **Polished** (Phase 10) → Documentation complete

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (Phases 1-2)
2. Once Foundational is done:
   - Developer A: US1 (Downloads) + US4 (Parallel)
   - Developer B: US2 (Validation)
   - Developer C: US3 (Edge Cases) + US5 (HNSW Config)
   - Developer D: US6 (Metrics) + US7 (Checkpointing)
3. All converge on Phase 10 (Documentation)

---

## Task Summary

- **Total Tasks**: 72 (70 core + 2 optional/verification)
- **Setup Tasks**: 4 (Phase 1)
- **Foundational Tasks**: 7 (Phase 2)
- **User Story Tasks**: 50 (Phases 3-9)
  - US1 (P1): 9 tasks
  - US2 (P1): 8 tasks
  - US3 (P1): 9 tasks
  - US4 (P2): 4 tasks
  - US5 (P2): 6 tasks
  - US6 (P1): 5 tasks
  - US7 (P3): 9 tasks (includes 1 optional: T060a)
- **Polish Tasks**: 11 (Phase 10, includes 1 verification: T070a)

**Parallel Opportunities**: 15 tasks marked [P] can run in parallel

**Suggested MVP Scope**: Phases 1-5 + Phase 8 (US1, US2, US3, US6) = 38 tasks (excludes optional T060a and T070a)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently testable using quickstart.md scenarios
- No automated tests required - use manual testing procedures
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Focus on P1 stories first (US1, US2, US3, US6) for production readiness

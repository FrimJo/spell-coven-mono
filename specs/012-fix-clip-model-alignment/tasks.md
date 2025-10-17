# Tasks: CLIP Model Alignment & Pipeline Optimization

**Input**: Design documents from `/specs/012-fix-clip-model-alignment/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Manual visual inspection + embedding similarity validation (no automated test tasks per spec clarifications)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app (monorepo)**: `apps/web/src/` for implementation
- All paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify environment and prepare for implementation

- [ ] T001 Verify TypeScript, React 19, and @huggingface/transformers 3.7.5 are installed in apps/web/package.json
- [ ] T002 [P] Run type checking to establish baseline: `pnpm check-types` from apps/web/
- [ ] T003 [P] Run linting to establish baseline: `pnpm lint` from apps/web/
- [ ] T004 Create backup of current CLIP implementation files (clip-embedder.ts, clip-search.ts, contract-validator.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Update CLIP model configuration constant: Change model ID from 'Xenova/clip-vit-base-patch32' to 'Xenova/clip-vit-large-patch14-336' in apps/web/src/lib/search/clip-embedder.ts
- [ ] T006 [P] Update expected embedding dimension constant from 512 to 768 in apps/web/src/lib/search/clip-embedder.ts
- [ ] T007 [P] Update expected embedding dimension constant from 512 to 768 in apps/web/src/lib/validation/contract-validator.ts
- [ ] T008 [P] Update CROPPED_CARD_WIDTH and CROPPED_CARD_HEIGHT from 384 to 336 in apps/web/src/lib/detection-constants.ts
- [ ] T009 Update model ID from 'Xenova/clip-vit-base-patch32' to 'Xenova/clip-vit-large-patch14-336' in apps/web/src/lib/search/clip-search.ts (if separate implementation exists)
- [ ] T010 Run type checking to verify no type errors: `pnpm check-types` from apps/web/

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Correct Card Identification (Priority: P1) 🎯 MVP

**Goal**: Fix dimension mismatch so browser generates 768-dim embeddings matching database format

**Independent Test**: 
1. Click a card in video stream
2. Open browser console and verify: "Embedding dimension: 768" (not 512)
3. Verify search completes without dimension mismatch errors
4. Compare with Python pipeline on same card image (should return identical top-1 match)

### Implementation for User Story 1

- [ ] T011 [P] [US1] Update QueryEmbedding interface: Change vector comment from "512-dimensional" to "768-dimensional" in apps/web/src/lib/search/clip-embedder.ts
- [ ] T012 [P] [US1] Update dimension validation in embedFromCanvas(): Change expected dimension from 512 to 768 in apps/web/src/lib/search/clip-embedder.ts
- [ ] T013 [P] [US1] Update error message in embedFromCanvas(): Change "512" to "768" and "ViT-B/32" to "ViT-L/14@336px" in apps/web/src/lib/search/clip-embedder.ts
- [ ] T014 [P] [US1] Update dimension validation error message in contract-validator.ts: Change expected dimension from 512 to 768 and update model reference to "ViT-L/14@336px"
- [ ] T015 [P] [US1] Update database dimension validation in contract-validator.ts: Change embeddingDim check from 512 to 768
- [ ] T016 [US1] Update dtype configuration in CLIPEmbedder constructor: Change from 'fp16' to 'fp32' for ViT-L/14 accuracy in apps/web/src/lib/search/clip-embedder.ts
- [ ] T017 [US1] Add console logging for embedding dimension verification in embedFromCanvas() for debugging in apps/web/src/lib/search/clip-embedder.ts
- [ ] T018 [US1] Run type checking: `pnpm check-types` from apps/web/
- [ ] T019 [US1] Run linting: `pnpm lint` from apps/web/
- [ ] T020 [US1] Manual test: Click card, verify 768-dim embedding in console, confirm search completes successfully

**Checkpoint**: At this point, User Story 1 should be fully functional - browser generates 768-dim embeddings matching database

---

## Phase 4: User Story 2 - Consistent Preprocessing Pipeline (Priority: P1)

**Goal**: Ensure browser preprocessing matches Python pipeline (black padding, 336×336)

**Independent Test**:
1. Process same card image in Python and browser
2. Export preprocessed images from both
3. Visual inspection: Should be identical (black padding, 336×336)
4. Verify embedding similarity ≥0.95 between Python and browser

### Implementation for User Story 2

- [ ] T021 [P] [US2] Update canvas dimension validation warnings in embedFromCanvas(): Change expected dimensions from 384×384 to 336×336 in apps/web/src/lib/search/clip-search.ts
- [ ] T022 [P] [US2] Update preprocessing documentation comments: Change references from "384×384" to "336×336" and note black padding approach in apps/web/src/lib/search/clip-search.ts
- [ ] T023 [P] [US2] Update CROPPED_CARD dimension comments in detection-constants.ts: Change from "384×384" to "336×336" and note ViT-L/14@336px alignment
- [ ] T024 [US2] Verify Transformers.js automatic preprocessing: Add temporary debug code to log canvas dimensions before/after CLIP preprocessing in apps/web/src/lib/search/clip-embedder.ts
- [ ] T025 [US2] Run type checking: `pnpm check-types` from apps/web/
- [ ] T026 [US2] Run linting: `pnpm lint` from apps/web/
- [ ] T027 [US2] Manual test: Process same card in Python and browser, export preprocessed images, visual inspection for alignment
- [ ] T028 [US2] Manual test: Verify embedding cosine similarity ≥0.95 between Python and browser for same card

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - preprocessing aligned with Python pipeline

---

## Phase 5: User Story 3 - Optimized Pipeline Without Redundant Operations (Priority: P2)

**Goal**: Remove unnecessary 446×620 resize step between SlimSAM and CLIP

**Independent Test**:
1. Measure end-to-end latency from click to result (before and after)
2. Verify 446×620 canvas is no longer created (check code paths)
3. Confirm search results remain identical to previous pipeline

### Implementation for User Story 3

- [ ] T029 [P] [US3] Search for and identify any code creating 446×620 canvas between SlimSAM and CLIP in apps/web/src/
- [ ] T030 [US3] Remove or comment out 446×620 resize operation (if found) in identified file
- [ ] T031 [US3] Verify SlimSAM output (384×384) flows directly to CLIP preprocessing (336×336) without intermediate resize
- [ ] T032 [P] [US3] Update any comments or documentation referencing the 446×620 intermediate step
- [ ] T033 [US3] Run type checking: `pnpm check-types` from apps/web/
- [ ] T034 [US3] Run linting: `pnpm lint` from apps/web/
- [ ] T035 [US3] Manual test: Measure click-to-result latency, should be 5-10ms faster than baseline
- [ ] T036 [US3] Manual test: Verify search results identical to previous pipeline (no accuracy loss)

**Checkpoint**: All P1 and P2 user stories complete - pipeline optimized

---

## Phase 6: User Story 4 - Lazy CLIP Model Loading (Priority: P3)

**Goal**: Load CLIP model on first card click (not page load) to improve perceived performance

**Independent Test**:
1. Load game room page, verify CLIP model NOT downloaded (check Network tab)
2. Click first card, verify model downloads with progress indicator
3. Click second card, verify no re-download (uses cached model)
4. Verify subsequent clicks process immediately

### Implementation for User Story 4

- [ ] T037 [P] [US4] Add getLoadingState() method to CLIPEmbedder class returning ModelLoadingState in apps/web/src/lib/search/clip-embedder.ts
- [ ] T038 [P] [US4] Update initialize() method to track loading state transitions (not-loaded → loading → ready/error) in apps/web/src/lib/search/clip-embedder.ts
- [ ] T039 [US4] Modify embedFromCanvas() to call initialize() automatically if model not loaded in apps/web/src/lib/search/clip-embedder.ts
- [ ] T040 [US4] Find card click handler in game room UI components (likely in apps/web/src/routes/)
- [ ] T041 [US4] Add loading state UI: Show progress indicator when model is loading in card click handler component
- [ ] T042 [US4] Add loading state UI: Display progress messages from onProgress callback in card click handler component
- [ ] T043 [US4] Ensure model initialization is NOT called on page load (verify no eager loading) in game room page component
- [ ] T044 [US4] Run type checking: `pnpm check-types` from apps/web/
- [ ] T045 [US4] Run linting: `pnpm lint` from apps/web/
- [ ] T046 [US4] Manual test: Load page, verify no model download in Network tab
- [ ] T047 [US4] Manual test: Click first card, verify model downloads with progress indicator
- [ ] T048 [US4] Manual test: Click second card, verify instant processing (no re-download)

**Checkpoint**: All P1, P2, and P3 user stories complete - lazy loading implemented

---

## Phase 7: User Story 5 - Clear Error Messages and Validation (Priority: P2)

**Goal**: Provide clear, actionable error messages for dimension mismatches and failures

**Independent Test**:
1. Intentionally use mismatched database dimensions, verify clear error message
2. Test with corrupted embeddings, confirm validation catches issue
3. Simulate model loading failure, verify error handling and retry logic
4. After 3 failures, verify persistent error banner appears

### Implementation for User Story 5

- [ ] T049 [P] [US5] Add retry counter to CLIPEmbedder class (retryCount field, max 3) in apps/web/src/lib/search/clip-embedder.ts
- [ ] T050 [P] [US5] Implement retry logic in initialize() method: Catch errors, increment retryCount, retry up to 3 times in apps/web/src/lib/search/clip-embedder.ts
- [ ] T051 [US5] Add permanent error state after 3 failed retries in initialize() method in apps/web/src/lib/search/clip-embedder.ts
- [ ] T052 [US5] Update error messages to include retry count and clear instructions in initialize() method in apps/web/src/lib/search/clip-embedder.ts
- [ ] T053 [US5] Enhance dimension mismatch error message: Include "expected 768, got X" and migration instructions in contract-validator.ts
- [ ] T054 [US5] Enhance normalization error message: Include actual norm value and tolerance in embedFromCanvas() in apps/web/src/lib/search/clip-embedder.ts
- [ ] T055 [US5] Add error banner UI component for permanent model loading failures in game room page component
- [ ] T056 [US5] Display persistent error banner after 3 failed retry attempts with "refresh page" instruction in game room page component
- [ ] T057 [US5] Run type checking: `pnpm check-types` from apps/web/
- [ ] T058 [US5] Run linting: `pnpm lint` from apps/web/
- [ ] T059 [US5] Manual test: Simulate dimension mismatch, verify clear error message with expected vs actual
- [ ] T060 [US5] Manual test: Simulate model loading failure (throttle network), verify retry attempts
- [ ] T061 [US5] Manual test: After 3 failures, verify persistent error banner appears requiring page refresh

**Checkpoint**: All user stories complete - comprehensive error handling implemented

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and documentation

- [ ] T062 [P] Remove temporary debug logging added in T017 and T024 from apps/web/src/lib/search/clip-embedder.ts
- [ ] T063 [P] Update inline code comments to reflect new 768-dim model and 336×336 preprocessing across all modified files
- [ ] T064 [P] Add JSDoc comments for new methods (getLoadingState, retry logic) in apps/web/src/lib/search/clip-embedder.ts
- [ ] T065 [P] Update README.md or relevant documentation with breaking change notice and migration instructions
- [ ] T066 [P] Create migration guide document explaining how to regenerate embeddings with ViT-L/14@336px
- [ ] T067 Run final type checking: `pnpm check-types` from apps/web/
- [ ] T068 Run final linting: `pnpm lint` from apps/web/
- [ ] T069 Run formatting: `pnpm format` from apps/web/
- [ ] T070 Verify all acceptance criteria from spec.md are met (review each user story)
- [ ] T071 Run quickstart.md validation: Follow quickstart guide end-to-end to verify instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1): Can start after Foundational - No dependencies on other stories
  - US2 (P1): Can start after Foundational - No dependencies on other stories (can run parallel with US1)
  - US3 (P2): Can start after Foundational - No dependencies on other stories (can run parallel with US1/US2)
  - US4 (P3): Depends on US1 completion (needs working embedding generation)
  - US5 (P2): Can start after Foundational - No dependencies on other stories (can run parallel with US1/US2/US3)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent, can run parallel with US1
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent, can run parallel with US1/US2
- **User Story 4 (P3)**: Depends on US1 (needs working 768-dim embedding generation)
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Independent, can run parallel with US1/US2/US3

### Within Each User Story

- Tasks marked [P] can run in parallel (different files, no dependencies)
- Type checking and linting tasks should run after implementation tasks
- Manual testing tasks should run after type checking and linting pass

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel
- **Phase 2**: T006, T007, T008 can run in parallel (different files)
- **Phase 3 (US1)**: T011, T012, T013, T014, T015 can run in parallel (different validation points in same/different files)
- **Phase 4 (US2)**: T021, T022, T023 can run in parallel (different files)
- **Phase 5 (US3)**: T029 and T032 can run in parallel
- **Phase 6 (US4)**: T037 and T038 can run in parallel (different methods)
- **Phase 7 (US5)**: T049, T050, T053, T054 can run in parallel (different validation points)
- **Phase 8**: T062, T063, T064, T065, T066 can run in parallel (different files)
- **User Stories**: US1, US2, US3, US5 can all run in parallel after Foundational phase (US4 depends on US1)

---

## Parallel Example: User Story 1

```bash
# Launch all dimension updates together:
Task T011: "Update QueryEmbedding interface comment in clip-embedder.ts"
Task T012: "Update dimension validation in embedFromCanvas() in clip-embedder.ts"
Task T013: "Update error message in embedFromCanvas() in clip-embedder.ts"
Task T014: "Update error message in contract-validator.ts"
Task T015: "Update database dimension validation in contract-validator.ts"

# Then sequentially:
Task T016: "Update dtype configuration"
Task T017: "Add console logging"
Task T018: "Run type checking"
Task T019: "Run linting"
Task T020: "Manual test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T010) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T011-T020)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Verify 768-dim embeddings generated
   - Verify search completes without errors
   - Compare with Python pipeline (same top-1 result)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T010)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (T011-T020)
3. Add User Story 2 → Test independently → Deploy/Demo (T021-T028)
4. Add User Story 3 → Test independently → Deploy/Demo (T029-T036)
5. Add User Story 5 → Test independently → Deploy/Demo (T049-T061)
6. Add User Story 4 → Test independently → Deploy/Demo (T037-T048)
7. Polish → Final release (T062-T071)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T010)
2. Once Foundational is done:
   - Developer A: User Story 1 (T011-T020)
   - Developer B: User Story 2 (T021-T028)
   - Developer C: User Story 3 (T029-T036)
   - Developer D: User Story 5 (T049-T061)
3. After US1 completes:
   - Developer A: User Story 4 (T037-T048) - depends on US1
4. Stories complete and integrate independently
5. Team collaborates on Polish (T062-T071)

---

## Task Summary

**Total Tasks**: 71
- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 6 tasks (BLOCKS all user stories)
- Phase 3 (US1 - P1): 10 tasks
- Phase 4 (US2 - P1): 8 tasks
- Phase 5 (US3 - P2): 8 tasks
- Phase 6 (US4 - P3): 12 tasks
- Phase 7 (US5 - P2): 13 tasks
- Phase 8 (Polish): 10 tasks

**Parallel Opportunities**: 35 tasks marked [P] can run in parallel with other tasks

**MVP Scope**: Phases 1-3 (20 tasks) delivers working 768-dim embedding generation

**Independent Test Criteria**:
- US1: 768-dim embeddings, search completes, matches Python top-1
- US2: Visual inspection confirms preprocessing alignment, similarity ≥0.95
- US3: Latency improved 5-10ms, results identical
- US4: Model loads on first click, cached for subsequent clicks
- US5: Clear error messages, retry logic, persistent error banner

---

## Notes

- [P] tasks = different files or independent changes, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Run type checking and linting frequently (after each phase)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Manual testing required per spec clarifications (visual inspection + embedding similarity)
- Breaking change: Database must be regenerated with 768-dim embeddings before deployment

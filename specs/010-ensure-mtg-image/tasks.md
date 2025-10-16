# Tasks: MTG Image Database and Frontend Integration

**Input**: Design documents from `/specs/010-ensure-mtg-image/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL per constitution. E2E tests using mocked webcam stream requested in spec.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Monorepo structure**: `apps/web/src/`, `packages/mtg-image-db/`
- Frontend: TypeScript/React in `apps/web/`
- Backend: Python in `packages/mtg-image-db/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification of existing structure

- [X] T001 Verify mtg-image-db package has exported embeddings.i8bin and meta.json in index_out/
- [X] T002 Verify artifacts exist in apps/web/public/data/mtg-embeddings/v1.0/ directory
- [X] T003 [P] Install @xenova/transformers dependency in apps/web/package.json
- [X] T004 [P] Verify existing CardDetector interface in apps/web/src/lib/detectors/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create data contract validation module in apps/web/src/lib/validation/contract-validator.ts
- [X] T006 [P] Create embeddings loader module in apps/web/src/lib/search/embeddings-loader.ts
- [X] T007 [P] Create metadata loader module in apps/web/src/lib/search/metadata-loader.ts
- [X] T008 Update DetectorType enum to include 'slimsam' in apps/web/src/lib/detectors/types.ts
- [X] T009 Update default detector to 'slimsam' in apps/web/src/routes/game.$gameId.tsx
- [X] T010 Update gameSearchSchema enum to include 'slimsam' in apps/web/src/routes/game.$gameId.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Data Contract Validation (Priority: P1) 🎯 MVP

**Goal**: Validate that binary format, metadata structure, and quantization parameters match exactly between producer and consumer, preventing runtime errors and data corruption

**Independent Test**: Run export script, load artifacts in browser, verify shape/dtype/scale factor/record count match without errors

### Implementation for User Story 1

- [X] T011 [P] [US1] Implement file size validation (FR-001) in apps/web/src/lib/validation/contract-validator.ts
- [X] T012 [P] [US1] Implement version validation (FR-002) in apps/web/src/lib/validation/contract-validator.ts
- [X] T013 [P] [US1] Implement record count validation (FR-003) in apps/web/src/lib/validation/contract-validator.ts
- [X] T014 [P] [US1] Implement dtype and scale factor validation in apps/web/src/lib/validation/contract-validator.ts
- [X] T015 [P] [US1] Implement required fields validation (FR-014) in apps/web/src/lib/validation/contract-validator.ts
- [X] T016 [US1] Implement clear error messages for all contract violations (FR-004) in apps/web/src/lib/validation/contract-validator.ts
- [X] T017 [US1] Implement dequantization function (FR-005) in apps/web/src/lib/search/embeddings-loader.ts
- [X] T018 [US1] Verify L2 norm after dequantization (FR-006, SC-007) in apps/web/src/lib/search/embeddings-loader.ts
- [X] T019 [US1] Implement structured error logging (FR-018) in apps/web/src/lib/validation/contract-validator.ts
- [X] T020 [US1] Integrate validation into embeddings loading flow in apps/web/src/lib/search/embeddings-loader.ts
- [X] T021 [US1] Test validation with correct data (SC-001) - verify no errors thrown
- [X] T022 [US1] Test validation with mismatched file size - verify specific error message (SC-002)
- [X] T023 [US1] Test validation with wrong version - verify specific error message (SC-002)
- [X] T024 [US1] Test validation with mismatched record count - verify specific error message (SC-002)

**Checkpoint**: At this point, data contract validation should be fully functional and testable independently

---

## Phase 4: User Story 2 - End-to-End Card Identification Flow (Priority: P2)

**Goal**: Extract card region using SlimSAM, rectify to canonical aspect ratio, embed using CLIP, search against database, return top matching card with metadata

**Independent Test**: Start webcam (or use mocked stream at apps/web/tests/assets/card_demo.webm), click on card, verify system returns correct identification with name/set/Scryfall link

### Implementation for User Story 2

- [X] T025 [P] [US2] Create SlimSAMDetector class skeleton implementing CardDetector interface in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T026 [US2] Implement initialize() method with model loading (FR-009) in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T027 [US2] Implement getStatus() method in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T028 [US2] Implement dispose() method in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T029 [US2] Implement detect() method with point-prompt segmentation in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T030 [US2] Implement mask-to-polygon conversion in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T031 [US2] Implement corner refinement and aspect ratio enforcement (FR-011) in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T032 [US2] Implement perspective warp to canonical rectangle in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T033 [US2] Add WebGPU/WebGL/WASM fallback handling (FR-013) in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T034 [US2] Add detection failure notification (FR-016) in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T035 [US2] Add structured error logging for detection failures (FR-018) in apps/web/src/lib/detectors/slimsam-detector.ts
- [X] T036 [P] [US2] Create CLIP embedder module in apps/web/src/lib/search/clip-embedder.ts
- [X] T037 [US2] Implement CLIP model initialization (FR-010) in apps/web/src/lib/search/clip-embedder.ts
- [X] T038 [US2] Implement embedFromCanvas() function (FR-009a) in apps/web/src/lib/search/clip-embedder.ts
- [X] T039 [US2] Verify embedding is 512-dim L2-normalized vector in apps/web/src/lib/search/clip-embedder.ts
- [X] T040 [P] [US2] Create similarity search module in apps/web/src/lib/search/similarity-search.ts
- [X] T041 [US2] Implement dot product similarity computation (FR-007) in apps/web/src/lib/search/similarity-search.ts
- [X] T042 [US2] Implement top1() function returning single best match (FR-012) in apps/web/src/lib/search/similarity-search.ts
- [X] T043 [P] [US2] Create CardIdentificationResult component in apps/web/src/components/CardIdentificationResult.tsx
- [X] T044 [US2] Display card name, set, thumbnail, Scryfall link in CardIdentificationResult component
- [ ] T045 [US2] Integrate SlimSAM detector with CLIP embedder in end-to-end flow
- [ ] T046 [US2] Integrate CLIP embedder with similarity search in end-to-end flow
- [ ] T047 [US2] Wire up complete flow from click to result display
- [ ] T048 [US2] Test SlimSAM segmentation completes in <500ms (SC-003a)
- [ ] T049 [US2] Test end-to-end identification completes in <3s (SC-003)
- [ ] T050 [US2] Create E2E test using mocked webcam stream in apps/web/tests/e2e/card-identification.spec.ts
- [ ] T051 [US2] Verify E2E test passes with mocked stream at apps/web/tests/assets/card_demo.webm

**Checkpoint**: At this point, end-to-end card identification should be fully functional from webcam click to result display

---

## Phase 5: User Story 3 - Embedding Format Compatibility (Priority: P3)

**Goal**: Ensure embeddings generated by Python CLIP model are compatible with browser CLIP model, producing consistent similarity scores for same query images

**Independent Test**: Embed same image in both Python and browser, verify resulting vectors have cosine similarity >0.99

### Implementation for User Story 3

- [ ] T052 [P] [US3] Create embedding compatibility test script in packages/mtg-image-db/test_embedding_compatibility.py
- [ ] T053 [US3] Load test image and embed using Python CLIP in test script
- [ ] T054 [US3] Export test embedding to JSON for browser comparison
- [ ] T055 [P] [US3] Create browser-side compatibility test in apps/web/tests/e2e/embedding-compatibility.spec.ts
- [ ] T056 [US3] Load same test image and embed using browser CLIP
- [ ] T057 [US3] Compare Python and browser embeddings, verify cosine similarity >0.99 (SC-004)
- [ ] T058 [US3] Test top-1 result is identical between Python FAISS and browser search (SC-005)
- [ ] T059 [US3] Verify cosine similarity equals dot product for L2-normalized vectors (FR-007)
- [ ] T060 [US3] Document any embedding differences and acceptable tolerance ranges

**Checkpoint**: All user stories should now be independently functional with verified compatibility

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T061 [P] Add performance monitoring for all stages (segmentation, embedding, search)
- [ ] T062 [P] Add memory usage tracking for embedding database
- [ ] T063 [P] Optimize similarity search with SIMD operations (future enhancement)
- [ ] T064 [P] Add loading progress indicators for model initialization
- [ ] T065 [P] Improve error messages with recovery suggestions
- [ ] T066 [P] Add telemetry for WebGPU/WebGL/WASM fallback usage
- [ ] T067 [P] Document SlimSAM detector usage in apps/web/README.md
- [ ] T068 [P] Update quickstart.md with actual implementation details
- [ ] T069 Run type checking: pnpm check-types
- [ ] T070 Run linting: pnpm lint
- [ ] T071 Fix any type or lint errors
- [ ] T072 Run quickstart.md validation with real data
- [ ] T073 Test with varied lighting/angles/distances to verify >80% accuracy (SC-006)
- [ ] T074 Test WebGPU unavailability fallback (SC-008)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 for data loading but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on US2 for embedding logic but should be independently testable

### Within Each User Story

- Validation/loading modules before detection/embedding
- Detection before embedding
- Embedding before search
- Search before UI display
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- **Setup**: T003 and T004 can run in parallel
- **Foundational**: T006 and T007 can run in parallel
- **User Story 1**: T011-T015 (all validation functions) can run in parallel
- **User Story 2**: T025 (SlimSAM), T036 (CLIP), T040 (search), T043 (UI) can start in parallel after foundational
- **User Story 3**: T052 (Python test) and T055 (browser test) can run in parallel
- **Polish**: All tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all validation functions together:
Task: "Implement file size validation (FR-001) in apps/web/src/lib/validation/contract-validator.ts"
Task: "Implement version validation (FR-002) in apps/web/src/lib/validation/contract-validator.ts"
Task: "Implement record count validation (FR-003) in apps/web/src/lib/validation/contract-validator.ts"
Task: "Implement dtype and scale factor validation in apps/web/src/lib/validation/contract-validator.ts"
Task: "Implement required fields validation (FR-014) in apps/web/src/lib/validation/contract-validator.ts"
```

## Parallel Example: User Story 2

```bash
# Launch all module skeletons together:
Task: "Create SlimSAMDetector class skeleton in apps/web/src/lib/detectors/slimsam-detector.ts"
Task: "Create CLIP embedder module in apps/web/src/lib/search/clip-embedder.ts"
Task: "Create similarity search module in apps/web/src/lib/search/similarity-search.ts"
Task: "Create CardIdentificationResult component in apps/web/src/components/CardIdentificationResult.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T010) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T011-T024)
4. **STOP and VALIDATE**: Test data contract validation independently
5. Deploy/demo if ready

**MVP Deliverable**: Data contract validation ensures artifacts are correctly formatted and loaded

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (Full card identification!)
4. Add User Story 3 → Test independently → Deploy/Demo (Compatibility verified!)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T010)
2. Once Foundational is done:
   - Developer A: User Story 1 (T011-T024) - Data validation
   - Developer B: User Story 2 (T025-T051) - Card identification
   - Developer C: User Story 3 (T052-T060) - Compatibility testing
3. Stories complete and integrate independently

---

## Task Summary

- **Total Tasks**: 74
- **Setup Phase**: 4 tasks
- **Foundational Phase**: 6 tasks (BLOCKING)
- **User Story 1 (P1)**: 14 tasks - Data Contract Validation
- **User Story 2 (P2)**: 27 tasks - End-to-End Card Identification
- **User Story 3 (P3)**: 9 tasks - Embedding Compatibility
- **Polish Phase**: 14 tasks

**Parallel Opportunities**: 35 tasks marked [P] can run in parallel within their phase

**Independent Test Criteria**:
- US1: Load artifacts, verify all validations pass/fail correctly
- US2: Click card in webcam, get correct identification in <3s
- US3: Same image embedded in Python and browser has >0.99 similarity

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only) = 24 tasks

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run `pnpm check-types` and `pnpm lint` frequently per constitution
- Use Context7 (`mcp1_resolve-library-id` and `mcp1_get-library-docs`) for up-to-date npm package documentation
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

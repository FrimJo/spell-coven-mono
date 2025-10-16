# Tasks: Improve Cropped Card Query Accuracy

**Input**: Design documents from `/specs/009-improve-cropped-card/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/preprocessing-pipeline.md

**Tests**: Tests are OPTIONAL per constitution. This feature includes Playwright integration tests for preprocessing validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Implementation Status**: ✅ **CORE MVP COMPLETE** (13/47 tasks)
- Phase 1: Setup complete (3/3)
- Phase 3: US1 core implementation complete (6/11) - **Ready for testing**
- Phase 5: US3 validation complete (4/7)
- See IMPLEMENTATION_SUMMARY.md for details

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app (monorepo)**: `apps/web/src/`, `apps/web/tests/`
- All paths are absolute from repository root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish baseline measurements and prepare test infrastructure

- [x] T001 Create test results directory at specs/009-improve-cropped-card/test-results/
- [x] T002 Document baseline measurement procedure in specs/009-improve-cropped-card/test-results/README.md
- [x] T003 [P] Select 100 diverse test cards (25 creatures, 25 spells, 25 artifacts/enchantments, 25 lands) and document in specs/009-improve-cropped-card/test-results/test-set.json

---

## Phase 2: Foundational (Baseline Measurements)

**Purpose**: Establish current accuracy metrics before implementing fix - BLOCKS all user stories

**⚠️ CRITICAL**: Must complete baseline measurements to validate improvement claims (SC-001, SC-002)

- [ ] T004 Run baseline accuracy test with current implementation on 100-card test set
- [ ] T005 Record baseline results in specs/009-improve-cropped-card/test-results/baseline.json (top-1, top-3, top-5 accuracy, avg similarity scores)
- [ ] T006 Verify baseline measurements meet minimum thresholds for meaningful comparison (at least 50 successful queries)

**Checkpoint**: Baseline established - user story implementation can now begin

---

## Phase 3: User Story 1 - Accurate Card Identification from Webcam (Priority: P1) 🎯 MVP

**Goal**: Fix preprocessing pipeline to align browser and Python implementations, achieving 30% improvement in top-1 accuracy and 50% improvement in top-5 accuracy

**Independent Test**: Capture webcam image of known MTG card, click on it, verify correct card appears as top result with high confidence (>0.85). Re-run 100-card test set and compare to baseline.

### Implementation for User Story 1

- [x] T007 [P] [US1] Update CROPPED_CARD_WIDTH constant to 384 in apps/web/src/lib/detection-constants.ts
- [x] T008 [P] [US1] Update CROPPED_CARD_HEIGHT constant to 384 in apps/web/src/lib/detection-constants.ts
- [x] T009 [US1] Implement square center-crop logic in cropCardFromBoundingBox function in apps/web/src/lib/webcam.ts (calculate minDim, cropX, cropY)
- [x] T010 [US1] Update canvas extraction to use square dimensions in cropCardFromBoundingBox function in apps/web/src/lib/webcam.ts
- [x] T011 [US1] Update canvas resize to 384×384 in cropCardFromBoundingBox function in apps/web/src/lib/webcam.ts
- [x] T012 [US1] Verify cropped canvas logging shows square dimensions in apps/web/src/lib/webcam.ts
- [ ] T013 [US1] Test preprocessing fix manually with webcam and verify square crop in browser console
- [ ] T014 [US1] Run accuracy validation on 100-card test set with fixed preprocessing
- [ ] T015 [US1] Record post-fix results in specs/009-improve-cropped-card/test-results/after-fix.json
- [ ] T016 [US1] Calculate improvement percentages and verify SC-001 (≥30% top-1) and SC-002 (≥50% top-5) are met
- [ ] T017 [US1] Test database self-query (SC-003) and verify similarity score >0.95

**Checkpoint**: At this point, User Story 1 should be fully functional - accurate card identification with measurable improvement

---

## Phase 4: User Story 2 - Consistent Results Across Query Methods (Priority: P2)

**Goal**: Ensure same card queried through different methods (webcam, upload) produces consistent top-3 results in at least 85% of cases

**Independent Test**: Query same card via webcam crop and file upload (if implemented), verify both methods return same top result. Test with 20 cards and measure consistency rate.

### Implementation for User Story 2

- [ ] T018 [US2] Create consistency test script to query same card via multiple methods
- [ ] T019 [US2] Test 20 diverse cards via webcam and file upload (if available)
- [ ] T020 [US2] Record consistency results in specs/009-improve-cropped-card/test-results/consistency.json
- [ ] T021 [US2] Verify SC-006 (≥85% consistency) is met
- [ ] T022 [US2] Document any inconsistencies and potential causes in test results

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - accurate identification with cross-method consistency

---

## Phase 5: User Story 3 - Helpful Feedback on Query Quality (Priority: P3)

**Goal**: Provide validation warnings when image preprocessing deviates from expected pipeline, helping users understand accuracy issues

**Independent Test**: Submit intentionally poor-quality images (non-square, wrong dimensions) and verify appropriate warnings are displayed in browser console

### Implementation for User Story 3

- [x] T023 [P] [US3] Add square dimension validation in embedFromCanvas function in apps/web/src/lib/search.ts
- [x] T024 [P] [US3] Add 384×384 dimension validation in embedFromCanvas function in apps/web/src/lib/search.ts
- [x] T025 [US3] Add console warning for non-square canvas in embedFromCanvas function in apps/web/src/lib/search.ts
- [x] T026 [US3] Add console warning for incorrect dimensions in embedFromCanvas function in apps/web/src/lib/search.ts
- [ ] T027 [US3] Test validation warnings with intentionally incorrect canvas dimensions
- [ ] T028 [US3] Verify SC-004 (warnings displayed for non-square format) is met
- [ ] T029 [US3] Verify no warnings appear for correct 384×384 square canvas

**Checkpoint**: All user stories should now be independently functional - accurate identification, consistency, and helpful feedback

---

## Phase 6: Integration Testing (Playwright)

**Purpose**: Automated validation of preprocessing pipeline

- [ ] T030 [P] Create Playwright test file at apps/web/tests/preprocessing-validation.spec.ts
- [ ] T031 [P] Implement test case: verify canvas dimensions are 384×384 after crop
- [ ] T032 [P] Implement test case: verify canvas is square (width === height)
- [ ] T033 [P] Implement test case: verify no validation warnings for correct preprocessing
- [ ] T034 [P] Implement test case: verify warnings appear for non-square canvas
- [ ] T035 Run Playwright tests and verify all pass
- [ ] T036 Verify SC-005 (query processing time <3 seconds) is maintained

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation

- [ ] T037 [P] Update apps/web/README.md with new accuracy metrics from test results
- [ ] T038 [P] Add preprocessing pipeline documentation to apps/web/SPEC.md referencing contracts/preprocessing-pipeline.md
- [ ] T039 [P] Document testing procedure in specs/009-improve-cropped-card/quickstart.md
- [ ] T040 [P] Add code comments explaining center-crop logic in apps/web/src/lib/webcam.ts
- [ ] T041 Run type checking (pnpm check-types) per constitution continuous verification
- [ ] T042 Run linting (pnpm lint) per constitution continuous verification
- [ ] T043 Fix any type or lint errors
- [ ] T044 Test edge cases from spec.md (foiled cards, double-faced cards, angled cards)
- [ ] T045 Verify SC-007 (angled cards ≤30° in top-5 ≥70% of time) with 20 angled card tests
- [ ] T046 Create final summary report in specs/009-improve-cropped-card/test-results/summary.md
- [ ] T047 Run quickstart.md validation procedure

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (P1 → P2 → P3)
  - US2 and US3 can start in parallel after US1 completes
- **Integration Testing (Phase 6)**: Depends on US1 completion (core preprocessing fix)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 completion - Tests consistency of US1 fix
- **User Story 3 (P3)**: Can start after US1 completion - Adds validation to US1 preprocessing

### Within Each User Story

- **US1**: Constants → Crop logic → Resize → Testing → Validation
- **US2**: US1 complete → Consistency testing → Validation
- **US3**: US1 complete → Validation logic → Warning tests

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 can run in parallel (different files)
- **Phase 3 (US1)**: T007 and T008 can run in parallel (same file, different constants)
- **Phase 5 (US3)**: T023, T024, T025, T026 can run in parallel (different validation checks)
- **Phase 6**: T030, T031, T032, T033, T034 can run in parallel (different test cases)
- **Phase 7**: T037, T038, T039, T040 can run in parallel (different documentation files)

---

## Parallel Example: User Story 1 Core Changes

```bash
# Launch constant updates together:
Task: "Update CROPPED_CARD_WIDTH constant to 384 in apps/web/src/lib/detection-constants.ts"
Task: "Update CROPPED_CARD_HEIGHT constant to 384 in apps/web/src/lib/detection-constants.ts"

# Then implement crop logic (sequential - same function):
Task: "Implement square center-crop logic in cropCardFromBoundingBox"
Task: "Update canvas extraction to use square dimensions"
Task: "Update canvas resize to 384×384"
```

## Parallel Example: User Story 3 Validation

```bash
# Launch all validation checks together:
Task: "Add square dimension validation in embedFromCanvas"
Task: "Add 384×384 dimension validation in embedFromCanvas"
Task: "Add console warning for non-square canvas"
Task: "Add console warning for incorrect dimensions"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline preparation)
2. Complete Phase 2: Foundational (baseline measurements) - CRITICAL
3. Complete Phase 3: User Story 1 (preprocessing fix)
4. **STOP and VALIDATE**: 
   - Run 100-card test set
   - Verify ≥30% top-1 improvement
   - Verify ≥50% top-5 improvement
   - Test database self-query (>0.95 similarity)
5. Deploy/demo if ready - **Core value delivered**

### Incremental Delivery

1. Complete Setup + Foundational → Baseline established
2. Add User Story 1 → Test independently → **Deploy/Demo (MVP!)**
   - Core accuracy fix delivered
   - Measurable improvement validated
3. Add User Story 2 → Test independently → Deploy/Demo
   - Consistency validation added
4. Add User Story 3 → Test independently → Deploy/Demo
   - User feedback added
5. Complete Integration Testing → Automated validation
6. Complete Polish → Production ready

### Sequential Strategy (Recommended)

This is a focused bug fix with clear dependencies:

1. Team completes Setup + Foundational together (baseline critical)
2. Implement User Story 1 (core preprocessing fix)
3. Validate improvement before proceeding
4. Add User Story 2 (consistency validation)
5. Add User Story 3 (user feedback)
6. Complete integration tests and polish

---

## Task Summary

- **Total Tasks**: 47
- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 3 tasks
- **Phase 3 (US1 - Accurate Identification)**: 11 tasks
- **Phase 4 (US2 - Consistency)**: 5 tasks
- **Phase 5 (US3 - Feedback)**: 7 tasks
- **Phase 6 (Integration Testing)**: 7 tasks
- **Phase 7 (Polish)**: 11 tasks

### Parallel Opportunities

- **Phase 1**: 3 parallel tasks (different files)
- **Phase 3**: 2 parallel tasks (constants)
- **Phase 5**: 4 parallel tasks (validation checks)
- **Phase 6**: 5 parallel tasks (test cases)
- **Phase 7**: 4 parallel tasks (documentation)

### MVP Scope

**Minimum Viable Product = User Story 1 only**
- Tasks: T001-T017 (17 tasks)
- Deliverable: Accurate card identification with measurable 30-50% improvement
- Independent test: 100-card test set validation
- Success criteria: SC-001, SC-002, SC-003 met

---

## Notes

- [P] tasks = different files or independent operations, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Baseline measurements (Phase 2) are CRITICAL - cannot validate improvement without them
- Stop at any checkpoint to validate story independently
- Run type checking and linting often per constitution (T041, T042)
- Commit after each logical task group
- Focus on MVP first (US1) - delivers core value with measurable improvement

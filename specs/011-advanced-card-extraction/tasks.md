# Tasks: Advanced Card Extraction with Corner Refinement, Perspective Warp, and Temporal Optimization

**Input**: Design documents from `/specs/011-advanced-card-extraction/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - not explicitly requested in specification, so not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Web application: `apps/web/src/` for source code
- Paths are absolute from repository root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and OpenCV.js integration

- [ ] T001 Add opencv.js dependency to apps/web/package.json
- [ ] T002 Create apps/web/public/opencv/ directory for WASM files
- [ ] T003 Download OpenCV.js 4.8.0 to apps/web/public/opencv/opencv.js
- [ ] T004 [P] Create apps/web/src/lib/opencv-loader.ts for lazy OpenCV.js loading
- [ ] T005 [P] Create apps/web/src/lib/detectors/geometry/ directory structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core geometry utilities and type definitions that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Add CardQuad, Point, Size types to apps/web/src/lib/detectors/types.ts
- [ ] T007 [P] Create apps/web/src/lib/detectors/geometry/validation.ts with quad validation functions
- [ ] T008 [P] Add MTG_CARD_ASPECT_RATIO and CANONICAL_CARD_SIZE constants to apps/web/src/lib/detectors/types.ts
- [ ] T009 Implement loadOpenCV() function in apps/web/src/lib/opencv-loader.ts with lazy loading and caching

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Accurate Card Detection from Any Angle (Priority: P1) 🎯 MVP

**Goal**: Extract cards at any angle with perspective correction using corner refinement and homography transformation

**Independent Test**: Click on cards held at 15°, 30°, and 45° angles and verify extracted image is properly corrected to flat 384×384 view

### Implementation for User Story 1

- [ ] T010 [P] [US1] Create apps/web/src/lib/detectors/geometry/contours.ts with maskToContours function
- [ ] T011 [P] [US1] Implement findLargestContour function in apps/web/src/lib/detectors/geometry/contours.ts
- [ ] T012 [US1] Implement approximateToQuad function in apps/web/src/lib/detectors/geometry/contours.ts using approxPolyDP
- [ ] T013 [US1] Implement orderQuadPoints function in apps/web/src/lib/detectors/geometry/contours.ts to ensure TL-TR-BR-BL order
- [ ] T014 [P] [US1] Create apps/web/src/lib/detectors/geometry/perspective.ts with computeHomography function
- [ ] T015 [US1] Implement warpPerspective function in apps/web/src/lib/detectors/geometry/perspective.ts to produce 384×384 canvas
- [ ] T016 [US1] Implement validateQuadAspectRatio function in apps/web/src/lib/detectors/geometry/validation.ts
- [ ] T017 [US1] Implement isConvexQuad function in apps/web/src/lib/detectors/geometry/validation.ts
- [ ] T018 [US1] Update SlimSAMDetector.detect() in apps/web/src/lib/detectors/slimsam-detector.ts to call contour detection
- [ ] T019 [US1] Add quad validation to SlimSAMDetector.detect() in apps/web/src/lib/detectors/slimsam-detector.ts
- [ ] T020 [US1] Add perspective warp to SlimSAMDetector.detect() in apps/web/src/lib/detectors/slimsam-detector.ts
- [ ] T021 [US1] Add quad highlighting overlay in apps/web/src/lib/detectors/slimsam-detector.ts for visual feedback (FR-013)
- [ ] T022 [US1] Update webcam.ts to use warped 384×384 canvas for card extraction
- [ ] T023 [US1] Add error handling for invalid quad geometry (partial occlusion case per FR-015)

**Checkpoint**: At this point, User Story 1 should be fully functional - cards at angles are extracted with perspective correction

---

## Phase 4: User Story 2 - Sharp Card Images from Video (Priority: P2)

**Goal**: Automatically select sharpest frame from buffered video to improve extraction quality

**Independent Test**: Move a card slightly while clicking, verify extracted image is sharper than the frame at exact moment of click

### Implementation for User Story 2

- [ ] T024 [P] [US2] Create FrameBuffer class in apps/web/src/lib/frame-buffer.ts with circular buffer implementation
- [ ] T025 [P] [US2] Add FrameMetadata interface to apps/web/src/lib/detectors/types.ts
- [ ] T026 [US2] Implement add() method in FrameBuffer class with automatic eviction
- [ ] T027 [US2] Implement getSharpest() method in FrameBuffer class with time window filtering
- [ ] T028 [US2] Implement clear() method in FrameBuffer class
- [ ] T029 [P] [US2] Create apps/web/src/lib/detectors/geometry/sharpness.ts with calculateSharpness function
- [ ] T030 [US2] Implement Laplacian variance calculation in calculateSharpness using OpenCV.js
- [ ] T031 [US2] Add frame buffer instance to useWebcam hook in apps/web/src/hooks/useWebcam.ts
- [ ] T032 [US2] Update webcam frame capture to calculate sharpness and add to buffer
- [ ] T033 [US2] Update SlimSAMDetector.detect() to accept optional frame buffer parameter
- [ ] T034 [US2] Add sharpest frame selection logic to SlimSAMDetector.detect() (within ±150ms window)
- [ ] T035 [US2] Update extraction to use sharpest frame instead of click-time frame
- [ ] T036 [US2] Add immediate preview with click-time frame, then replace with sharper version (FR-014)
- [ ] T037 [US2] Add frame buffer cleanup on webcam stop/restart

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - cards extracted with perspective correction AND optimal sharpness

---

## Phase 5: User Story 3 - Adaptive Detection for Difficult Conditions (Priority: P3)

**Goal**: Expand search area when edge detection fails to handle challenging lighting/positioning

**Independent Test**: Position card at edge of frame or in poor lighting, verify system expands ROI to successfully detect card

### Implementation for User Story 3

- [ ] T038 [P] [US3] Add ROI interface to apps/web/src/lib/detectors/types.ts
- [ ] T039 [P] [US3] Add ROI_SCALES constant to apps/web/src/lib/detectors/types.ts
- [ ] T040 [P] [US3] Create apps/web/src/lib/detectors/geometry/roi.ts with calculateROI function
- [ ] T041 [US3] Implement createROI function in roi.ts to define bounding area around click point
- [ ] T042 [US3] Implement expandROI function in roi.ts for progressive scaling (1.0× → 1.5× → 2.0×)
- [ ] T043 [US3] Implement clipROIToFrame function in roi.ts to ensure ROI stays within bounds
- [ ] T044 [US3] Update contour detection in contours.ts to accept ROI parameter
- [ ] T045 [US3] Add ROI extraction logic to maskToContours function
- [ ] T046 [US3] Update SlimSAMDetector.detect() to implement progressive ROI expansion
- [ ] T047 [US3] Add ROI scale 1.0× attempt with edge detection validation
- [ ] T048 [US3] Add ROI scale 1.5× fallback if 1.0× fails (FR-009)
- [ ] T049 [US3] Add ROI scale 2.0× fallback if 1.5× fails (FR-010)
- [ ] T050 [US3] Add logging for ROI expansion attempts and results
- [ ] T051 [US3] Adjust quad coordinates from ROI space back to full frame coordinates

**Checkpoint**: All user stories should now be independently functional with full robustness

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T052 [P] Add comprehensive logging for debugging (quad detection, sharpness scores, ROI attempts)
- [ ] T053 [P] Add performance monitoring (extraction timing, memory usage)
- [ ] T054 [P] Update apps/web/README.md with OpenCV.js dependency and performance characteristics
- [ ] T055 [P] Add inline JSDoc comments to all public functions in geometry/ modules
- [ ] T056 Run pnpm check-types to verify TypeScript compliance
- [ ] T057 Run pnpm lint to verify code quality
- [ ] T058 Run pnpm format to ensure consistent formatting
- [ ] T059 Manual testing with physical MTG cards at various angles per quickstart.md checklist
- [ ] T060 Verify frame buffer memory usage stays at ~7MB
- [ ] T061 Update spec.md if any behavior differs from implementation

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Integrates with US1 but independently testable

### Within Each User Story

- Geometry utilities before SlimSAMDetector modifications
- Validation functions before quad processing
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Geometry modules within a story marked [P] can run in parallel (contours.ts, perspective.ts, validation.ts)
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch geometry modules together:
Task: "Create apps/web/src/lib/detectors/geometry/contours.ts with maskToContours function"
Task: "Create apps/web/src/lib/detectors/geometry/perspective.ts with computeHomography function"

# After contours.ts and perspective.ts are created, implement their functions in parallel:
Task: "Implement approximateToQuad function in contours.ts"
Task: "Implement warpPerspective function in perspective.ts"
Task: "Implement validateQuadAspectRatio function in validation.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (OpenCV.js integration)
2. Complete Phase 2: Foundational (types, validation, loader)
3. Complete Phase 3: User Story 1 (corner refinement + perspective warp)
4. **STOP and VALIDATE**: Test with cards at 15°, 30°, 45° angles
5. Deploy/demo if ready

**This delivers the core value**: Cards can be extracted accurately from any angle

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! ✅)
3. Add User Story 2 → Test independently → Deploy/Demo (Better quality! ✅)
4. Add User Story 3 → Test independently → Deploy/Demo (More robust! ✅)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (corner refinement + perspective warp)
   - Developer B: User Story 2 (frame buffering + sharpness)
   - Developer C: User Story 3 (adaptive ROI)
3. Stories complete and integrate independently

---

## Task Summary

**Total Tasks**: 61

**By Phase**:
- Phase 1 (Setup): 5 tasks
- Phase 2 (Foundational): 4 tasks
- Phase 3 (User Story 1 - P1): 14 tasks
- Phase 4 (User Story 2 - P2): 14 tasks
- Phase 5 (User Story 3 - P3): 14 tasks
- Phase 6 (Polish): 10 tasks

**By User Story**:
- US1 (Accurate Detection): 14 tasks - Core value, perspective correction
- US2 (Sharp Images): 14 tasks - Quality improvement, temporal optimization
- US3 (Adaptive ROI): 14 tasks - Robustness, edge case handling

**Parallel Opportunities**: 23 tasks marked [P] can run in parallel within their phase

**MVP Scope**: Phases 1-3 (23 tasks) delivers core value - card extraction from any angle

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run type checking, linting, and formatting frequently per constitution
- Use Context7 for up-to-date npm package documentation
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

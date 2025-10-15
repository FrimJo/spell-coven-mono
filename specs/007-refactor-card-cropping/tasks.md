---
description: "Implementation tasks for card cropping and image database query integration"
---

# Tasks: Card Cropping and Image Database Query Integration

**Input**: Design documents from `/specs/007-refactor-card-cropping/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/card-query.ts

**Tests**: Not requested in specification - test tasks omitted per constitution

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Monorepo structure: `apps/web/src/`, `packages/ui/src/`
- All paths are absolute from repository root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare type contracts and shared utilities

- [x] T001 Copy type contracts from specs to source in apps/web/src/types/card-query.ts
- [ ] T002 [P] Export card-query types from packages/ui for component props

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core UI components and model initialization that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 [P] Create loading-overlay component in packages/ui/src/components/loading-overlay.tsx using shadcn patterns
- [ ] T004 [P] Create inline-message component in packages/ui/src/components/inline-message.tsx with variants (error, warning, info)
- [ ] T005 [P] Create card-result component in packages/ui/src/components/card-result.tsx for displaying query results
- [ ] T006 Add model initialization logic to GameRoom.tsx with ModelLoadingState management
- [ ] T007 Integrate loading-overlay in GameRoom.tsx to block interaction during model load
- [ ] T008 Initialize embeddings and CLIP model in GameRoom useEffect with progress callbacks

**Checkpoint**: Foundation ready - model loads on mount, loading overlay shows progress, UI components available

---

## Phase 3: User Story 1 - Identify Card from Video Stream (Priority: P1) 🎯 MVP

**Goal**: Enable players to click detected cards and see identification results below player list

**Independent Test**: Start game room, enable webcam with card detection, click detected card, verify result appears below player list with card name, set, score, and image

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create useCardQuery hook in apps/web/src/hooks/useCardQuery.ts with AbortController for cancellation
- [ ] T010 [P] [US1] Create CardResultDisplay container component in apps/web/src/components/CardResultDisplay.tsx
- [ ] T011 [US1] Implement canvas validation logic in useCardQuery (dimensions, non-empty data)
- [ ] T012 [US1] Implement query function in useCardQuery calling embedFromCanvas and top1 from @/lib/search
- [ ] T013 [US1] Add query cancellation logic in useCardQuery to handle rapid clicks (FR-011)
- [ ] T014 [US1] Integrate CardResultDisplay into GameRoom.tsx below PlayerList component
- [ ] T015 [US1] Modify VideoStreamGrid.tsx onCardCrop callback to pass HTMLCanvasElement to parent
- [ ] T016 [US1] Wire VideoStreamGrid canvas output to CardResultDisplay query trigger
- [ ] T017 [US1] Implement success state rendering in CardResultDisplay using card-result component
- [ ] T018 [US1] Implement error state rendering in CardResultDisplay using inline-message component
- [ ] T019 [US1] Add inline error message for empty/invalid crops (FR-007)
- [ ] T020 [US1] Display query results with card name, set, score (3 decimals), image, and Scryfall link (FR-005)

**Checkpoint**: User Story 1 complete - players can click cards and see identification results, rapid clicks cancel previous queries

---

## Phase 4: User Story 2 - Debug Cropped Card Images (Priority: P2)

**Goal**: Log cropped images as base64 to console for debugging and quality verification

**Independent Test**: Click detected card, open browser console, verify base64 data URL is logged and can be viewed by pasting in browser

### Implementation for User Story 2

- [ ] T021 [US2] Add canvas-to-base64 conversion in useCardQuery using canvasToBase64 utility
- [ ] T022 [US2] Log base64 data URL to console with descriptive label during query execution (FR-006)
- [ ] T023 [US2] Persist cropped image base64 in CardQueryState for debugging across state transitions

**Checkpoint**: User Story 2 complete - cropped images logged to console, developers can inspect crop quality

---

## Phase 5: User Story 3 - Handle Empty or Invalid Crops (Priority: P3)

**Goal**: Provide clear feedback when crops fail or have low confidence matches

**Independent Test**: Click areas without cards or with poor detection, verify appropriate inline messages appear in result area

### Implementation for User Story 3

- [ ] T024 [US3] Implement low confidence detection in CardResultDisplay using isLowConfidence utility (threshold 0.70)
- [ ] T025 [US3] Add low confidence warning to card-result component when score < 0.70
- [ ] T026 [US3] Display inline warning message suggesting clearer view for low confidence results
- [ ] T027 [US3] Handle model not ready state with inline message (prevented by loading overlay but defensive)
- [ ] T028 [US3] Add inline error messages for all edge cases (webcam loss, embedding failure, etc.)

**Checkpoint**: All user stories complete - full error handling and user feedback implemented

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements and consistency checks

- [ ] T029 [P] Verify all components follow existing design system (colors, typography, spacing)
- [ ] T030 [P] Ensure shadcn component styling matches game room interface
- [ ] T031 [P] Add TypeScript strict mode compliance checks for all new files
- [ ] T032 [P] Verify all error messages are user-friendly and actionable
- [ ] T033 Run type checking with pnpm check-types
- [ ] T034 Run linting with pnpm lint and fix any issues
- [ ] T035 Run formatting with pnpm format
- [ ] T036 Manual testing: Complete all acceptance scenarios from spec.md
- [ ] T037 Verify quickstart.md instructions are accurate
- [ ] T038 Update any outdated documentation or comments

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances US1 but independently testable

### Within Each User Story

- **US1**: Hook and components in parallel → wire together → test
- **US2**: Extends US1 query logic → minimal changes
- **US3**: Adds conditional rendering → minimal changes

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel
- **Phase 2**: T003, T004, T005 can run in parallel (different component files)
- **Phase 3 (US1)**: T009 and T010 can run in parallel (different files)
- **Phase 4 (US2)**: All tasks modify same hook, must be sequential
- **Phase 5 (US3)**: T024-T028 can run in parallel if split across components
- **Phase 6**: T029, T030, T031, T032 can run in parallel (different concerns)

---

## Parallel Example: User Story 1

```bash
# Launch hook and container component together:
Task T009: "Create useCardQuery hook in apps/web/src/hooks/useCardQuery.ts"
Task T010: "Create CardResultDisplay container in apps/web/src/components/CardResultDisplay.tsx"

# After both complete, wire them together sequentially
```

---

## Parallel Example: Foundational Phase

```bash
# Launch all UI components together:
Task T003: "Create loading-overlay component in packages/ui/src/components/loading-overlay.tsx"
Task T004: "Create inline-message component in packages/ui/src/components/inline-message.tsx"
Task T005: "Create card-result component in packages/ui/src/components/card-result.tsx"

# After all complete, integrate into GameRoom sequentially
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002) - ~15 minutes
2. Complete Phase 2: Foundational (T003-T008) - ~2 hours
3. Complete Phase 3: User Story 1 (T009-T020) - ~2-3 hours
4. **STOP and VALIDATE**: Test card identification end-to-end
5. Deploy/demo if ready

**Total MVP Time**: ~4-6 hours

### Incremental Delivery

1. **Foundation** (Phases 1-2) → Model loads, UI components ready
2. **MVP** (Phase 3) → Card identification works → Deploy/Demo
3. **Debug Support** (Phase 4) → Console logging added → Deploy/Demo
4. **Error Handling** (Phase 5) → Full UX polish → Deploy/Demo
5. **Polish** (Phase 6) → Production ready

### Parallel Team Strategy

With 2 developers:

1. **Together**: Complete Setup + Foundational (Phases 1-2)
2. **Once Foundational done**:
   - Developer A: User Story 1 (T009-T020)
   - Developer B: User Story 2 + 3 (T021-T028) - wait for US1 completion
3. **Together**: Polish (Phase 6)

With 3+ developers:

1. **Together**: Complete Setup + Foundational
2. **Parallel**:
   - Dev A: User Story 1 core (T009-T016)
   - Dev B: User Story 1 rendering (T017-T020)
   - Dev C: User Stories 2 & 3 (T021-T028)

---

## Task Count Summary

- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundational)**: 6 tasks
- **Phase 3 (US1 - MVP)**: 12 tasks
- **Phase 4 (US2)**: 3 tasks
- **Phase 5 (US3)**: 5 tasks
- **Phase 6 (Polish)**: 10 tasks

**Total**: 38 tasks

**Parallel Opportunities**: 8 tasks can run in parallel (marked with [P])

**MVP Scope**: Phases 1-3 only (20 tasks, ~4-6 hours)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run type checking and linting frequently during development
- Use Context7 MCP server for up-to-date npm package documentation
- Follow existing design patterns in GameRoom and VideoStreamGrid
- Reuse prototype logic from apps/web/src/routes/prev/index.tsx
- All new components must use shadcn patterns from packages/ui

---

## Validation Checklist

Before marking feature complete:

- [ ] All 3 user stories independently testable
- [ ] Type checking passes (pnpm check-types)
- [ ] Linting passes (pnpm lint)
- [ ] Formatting passes (pnpm format)
- [ ] All acceptance scenarios from spec.md verified
- [ ] Constitution compliance maintained (browser-first, no backend)
- [ ] Design system consistency (colors, typography, spacing)
- [ ] Performance targets met (<3 second queries)
- [ ] Error messages are user-friendly
- [ ] Debug logging works (base64 to console)
- [ ] Loading overlay blocks interaction during model load
- [ ] Query cancellation works on rapid clicks
- [ ] Low confidence warnings appear for score < 0.70
- [ ] All components properly exported from packages/ui
- [ ] No breaking changes to existing game room functionality

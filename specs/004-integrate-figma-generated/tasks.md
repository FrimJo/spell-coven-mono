# Tasks: Integrate Figma UI into Web Application

**Input**: Design documents from `/specs/004-integrate-figma-generated/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not requested in specification - tasks focus on implementation only

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Monorepo structure**: `apps/web/`, `packages/ui/`
- **Source**: `apps/web/src/`, `packages/ui/src/`
- **Tests**: `apps/web/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and package structure

- [ ] T001 [P] Create `packages/ui` directory structure with `src/{components,lib}`, `package.json`, `tsconfig.json`, `tailwind.config.ts`
- [ ] T002 [P] Initialize `packages/ui/package.json` with name `@repo/ui`, exports configuration, and peer dependencies (React 19)
- [ ] T003 [P] Configure `packages/ui/tsconfig.json` extending `@repo/typescript-config/react-library.json`
- [ ] T004 [P] Configure `packages/ui/tailwind.config.ts` with content paths and Figma design tokens (slate-950 color)
- [ ] T005 Install TanStack Router dependencies in `apps/web`: `@tanstack/react-router`, `@tanstack/router-plugin`, `react-error-boundary`
- [ ] T006 Remove `next-themes` dependency from `apps/web/package.json`
- [ ] T007 [P] Create `apps/web/src/routes` directory for TanStack Router file-based routing
- [ ] T008 [P] Create `apps/web/src/lib` directory for utilities (session storage, etc.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Configure Vite with TanStack Router plugin in `apps/web/vite.config.ts` (routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts')
- [ ] T010 [P] Add path aliases to `apps/web/vite.config.ts` for `@/*` → `./src/*` and `@repo/ui/*` → `../../packages/ui/src/*`
- [ ] T011 [P] Update `apps/web/tsconfig.json` with path mappings and include `src/routeTree.gen.ts`
- [ ] T012 [P] Update `apps/web/tailwind.config.ts` to include `packages/ui/src/**/*.{ts,tsx}` in content paths
- [ ] T013 Implement session storage utility in `apps/web/src/lib/session-storage.ts` with `saveGameState`, `loadGameState`, `clearGameState` functions and validation
- [ ] T014 [P] Create utility functions in `packages/ui/src/lib/utils.ts` (cn() helper for Tailwind class merging)
- [ ] T015 [P] Create barrel export file `packages/ui/src/index.ts` for component exports
- [ ] T016 Move existing routes to `apps/web/src/routes/prev/` directory to preserve them

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Access Game Interface (Priority: P1) 🎯 MVP

**Goal**: Enable users to navigate between landing page and game room with TanStack Router, session storage persistence, and error boundaries

**Independent Test**: Navigate to root URL → see landing page → create/join game → navigate to game room → leave game → return to landing page. Verify browser back/forward navigation works without page refreshes.

### Implementation for User Story 1

#### Core Routing Infrastructure

- [ ] T017 [P] [US1] Create root route in `apps/web/src/routes/__root.tsx` with root layout (min-h-screen bg-slate-950) and Outlet
- [ ] T018 [P] [US1] Create landing page route in `apps/web/src/routes/index.tsx` with ErrorBoundary wrapping LandingPage component
- [ ] T019 [P] [US1] Create game room route in `apps/web/src/routes/game.$gameId.tsx` with ErrorBoundary wrapping GameRoom component
- [ ] T020 [US1] Update `apps/web/src/main.tsx` to use TanStack Router with RouterProvider and generated route tree

#### Session Storage Integration

- [ ] T021 [US1] Implement create game handler in `apps/web/src/routes/index.tsx` that generates gameId, saves to session storage, and navigates to `/game/:gameId`
- [ ] T022 [US1] Implement join game handler in `apps/web/src/routes/index.tsx` that validates gameId, saves to session storage, and navigates to `/game/:gameId`
- [ ] T023 [US1] Implement leave game handler in `apps/web/src/routes/game.$gameId.tsx` that clears session storage and navigates to `/`
- [ ] T024 [US1] Add session storage check in `apps/web/src/routes/game.$gameId.tsx` to load playerName from persisted state

#### Game Components Migration

- [ ] T025 [P] [US1] Migrate LandingPage component from `code_from_figma_make/src/components/LandingPage.tsx` to `apps/web/src/components/LandingPage.tsx`
- [ ] T026 [P] [US1] Migrate GameRoom component from `code_from_figma_make/src/components/GameRoom.tsx` to `apps/web/src/components/GameRoom.tsx`
- [ ] T027 [P] [US1] Migrate ImageWithFallback utility from `code_from_figma_make/src/components/figma/ImageWithFallback.tsx` to `apps/web/src/components/figma/ImageWithFallback.tsx`

#### Component Import Updates

- [ ] T028 [US1] Update LandingPage imports to use `@repo/ui/components/*` for shadcn/ui components
- [ ] T029 [US1] Update GameRoom imports to use `@repo/ui/components/*` for shadcn/ui components
- [ ] T030 [US1] Add TypeScript interfaces for LandingPageProps and GameRoomProps per component-props contract

#### Error Boundaries

- [ ] T031 [P] [US1] Create ErrorFallback component in `apps/web/src/components/ErrorFallback.tsx` with error message and reset button
- [ ] T032 [US1] Integrate ErrorBoundary in landing page route with fallback and onReset handler
- [ ] T033 [US1] Integrate ErrorBoundary in game room route with fallback and onReset handler

**Checkpoint**: At this point, User Story 1 should be fully functional - users can navigate between landing page and game room with session persistence

---

## Phase 4: User Story 2 - Use Shared UI Components (Priority: P2)

**Goal**: Migrate used shadcn/ui components to shared package with Tailwind CSS styling, ensuring consistent design across the application

**Independent Test**: Verify all UI components render with correct Tailwind styling, are interactive (buttons click, dialogs open/close), maintain consistent design patterns, and are reusable via `@repo/ui` imports

### Identify Used Components

- [ ] T034 [US2] Analyze `code_from_figma_make/src/components/` to identify which shadcn/ui components are actually used by LandingPage, GameRoom, and game feature components

### Migrate Core UI Components

- [ ] T035 [P] [US2] Migrate Button component from `code_from_figma_make/src/components/ui/button.tsx` to `packages/ui/src/components/button.tsx`
- [ ] T036 [P] [US2] Migrate Card components (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter) from `code_from_figma_make/src/components/ui/card.tsx` to `packages/ui/src/components/card.tsx`
- [ ] T037 [P] [US2] Migrate Input component from `code_from_figma_make/src/components/ui/input.tsx` to `packages/ui/src/components/input.tsx`
- [ ] T038 [P] [US2] Migrate Label component from `code_from_figma_make/src/components/ui/label.tsx` to `packages/ui/src/components/label.tsx`
- [ ] T039 [P] [US2] Migrate Dialog components (Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription) from `code_from_figma_make/src/components/ui/dialog.tsx` to `packages/ui/src/components/dialog.tsx`

### Migrate Additional UI Components (as needed)

- [ ] T040 [P] [US2] Migrate Select component (if used) from `code_from_figma_make/src/components/ui/select.tsx` to `packages/ui/src/components/select.tsx`
- [ ] T041 [P] [US2] Migrate Separator component (if used) from `code_from_figma_make/src/components/ui/separator.tsx` to `packages/ui/src/components/separator.tsx`
- [ ] T042 [P] [US2] Migrate Tabs components (if used) from `code_from_figma_make/src/components/ui/tabs.tsx` to `packages/ui/src/components/tabs.tsx`
- [ ] T043 [P] [US2] Migrate Avatar component (if used) from `code_from_figma_make/src/components/ui/avatar.tsx` to `packages/ui/src/components/avatar.tsx`
- [ ] T044 [P] [US2] Migrate Badge component (if used) from `code_from_figma_make/src/components/ui/badge.tsx` to `packages/ui/src/components/badge.tsx`
- [ ] T045 [P] [US2] Migrate Dropdown Menu components (if used) from `code_from_figma_make/src/components/ui/dropdown-menu.tsx` to `packages/ui/src/components/dropdown-menu.tsx`
- [ ] T046 [P] [US2] Migrate Popover components (if used) from `code_from_figma_make/src/components/ui/popover.tsx` to `packages/ui/src/components/popover.tsx`
- [ ] T047 [P] [US2] Migrate Scroll Area component (if used) from `code_from_figma_make/src/components/ui/scroll-area.tsx` to `packages/ui/src/components/scroll-area.tsx`
- [ ] T048 [P] [US2] Migrate Toast/Sonner integration (if used) from `code_from_figma_make/src/components/ui/` to `packages/ui/src/components/`

### Tailwind Styling Verification

- [ ] T049 [US2] Verify all migrated components use Tailwind utility classes (no custom CSS files)
- [ ] T050 [US2] Ensure component variants use class-variance-authority correctly
- [ ] T051 [US2] Test responsive design across mobile, tablet, and desktop breakpoints
- [ ] T052 [US2] Verify consistent spacing, typography, and visual hierarchy across all components

### Package Exports

- [ ] T053 [US2] Update `packages/ui/src/index.ts` to export all migrated components
- [ ] T054 [US2] Update `packages/ui/package.json` exports field to include all component paths

### Dependency Management

- [ ] T055 [US2] Merge Radix UI dependencies from `code_from_figma_make/package.json` to `packages/ui/package.json` (only for used components)
- [ ] T056 [US2] Merge other UI dependencies (class-variance-authority, clsx, tailwind-merge, lucide-react) to `packages/ui/package.json`
- [ ] T057 [US2] Verify no duplicate dependencies exist between `apps/web` and `packages/ui`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - UI components are properly styled and reusable from shared package

---

## Phase 5: User Story 3 - Interact with Game Features (Priority: P3)

**Goal**: Migrate all game-specific feature components (CardScanner, GameBoard, PlayerStats, VideoPanel, TurnTracker) to enable complete gameplay experience

**Independent Test**: Enter game room → verify all game features (scanner, board, stats, video, turns) are visible and accessible → interact with each feature → verify functionality works as expected

### Migrate Game Feature Components

- [ ] T058 [P] [US3] Migrate CardScanner component from `code_from_figma_make/src/components/CardScanner.tsx` to `apps/web/src/components/CardScanner.tsx`
- [ ] T059 [P] [US3] Migrate GameBoard component from `code_from_figma_make/src/components/GameBoard.tsx` to `apps/web/src/components/GameBoard.tsx`
- [ ] T060 [P] [US3] Migrate PlayerStats component from `code_from_figma_make/src/components/PlayerStats.tsx` to `apps/web/src/components/PlayerStats.tsx`
- [ ] T061 [P] [US3] Migrate VideoPanel component from `code_from_figma_make/src/components/VideoPanel.tsx` to `apps/web/src/components/VideoPanel.tsx`
- [ ] T062 [P] [US3] Migrate TurnTracker component from `code_from_figma_make/src/components/TurnTracker.tsx` to `apps/web/src/components/TurnTracker.tsx`

### Update Component Imports

- [ ] T063 [US3] Update CardScanner imports to use `@repo/ui/components/*` for shadcn/ui components
- [ ] T064 [US3] Update GameBoard imports to use `@repo/ui/components/*` for shadcn/ui components
- [ ] T065 [US3] Update PlayerStats imports to use `@repo/ui/components/*` for shadcn/ui components
- [ ] T066 [US3] Update VideoPanel imports to use `@repo/ui/components/*` for shadcn/ui components
- [ ] T067 [US3] Update TurnTracker imports to use `@repo/ui/components/*` for shadcn/ui components

### Integrate with GameRoom

- [ ] T068 [US3] Update GameRoom component to import and render all game feature components (CardScanner, GameBoard, PlayerStats, VideoPanel, TurnTracker)
- [ ] T069 [US3] Verify game feature components receive correct props from GameRoom
- [ ] T070 [US3] Ensure game feature components maintain their internal state and functionality

### Additional Dependencies

- [ ] T071 [P] [US3] Merge game-specific dependencies from `code_from_figma_make/package.json` to `apps/web/package.json` (embla-carousel-react, react-resizable-panels, recharts, etc.)
- [ ] T072 [US3] Verify all game feature components build successfully with migrated dependencies

**Checkpoint**: All user stories should now be independently functional - complete game experience is available

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, optimization, and final verification

### Cleanup

- [ ] T073 Delete `code_from_figma_make/` directory after verifying all components are migrated
- [ ] T074 [P] Remove any unused CSS files from `apps/web/src/` (ensure 100% Tailwind usage)
- [ ] T075 [P] Remove any next-themes imports or theme-switching code from migrated components
- [ ] T076 [P] Clean up any temporary files or unused imports

### Build & Type Verification

- [ ] T077 Run `pnpm build` from repository root and verify successful build with no errors
- [ ] T078 Run `pnpm check-types` and verify no TypeScript errors
- [ ] T079 Run `pnpm lint` and fix any linting issues
- [ ] T080 Run `pnpm format` to ensure consistent code formatting

### Documentation

- [ ] T081 [P] Update `apps/web/README.md` to document new routing structure and shared UI package usage
- [ ] T082 [P] Update `packages/ui/README.md` with component usage examples and import patterns
- [ ] T083 [P] Add JSDoc comments to session storage utility functions

### Manual Testing

- [ ] T084 Test landing page loads correctly at `/`
- [ ] T085 Test create game flow (enter name → create → navigate to game room)
- [ ] T086 Test join game flow (enter name and ID → join → navigate to game room)
- [ ] T087 Test leave game flow (click leave → navigate to landing page)
- [ ] T088 Test session persistence (create game → refresh page → verify still in game room)
- [ ] T089 Test browser navigation (back/forward buttons work without page refreshes)
- [ ] T090 Test error boundaries (trigger error → verify fallback displays → verify recovery works)
- [ ] T091 Test all UI components are styled correctly with Tailwind
- [ ] T092 Test responsive design on mobile, tablet, and desktop viewports
- [ ] T093 Test all game feature components render and are interactive

---

## Dependencies

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← MUST complete before any user story
    ↓
    ├─→ Phase 3 (US1: Access Game Interface) ← MVP, can start immediately
    ├─→ Phase 4 (US2: Use Shared UI Components) ← Can start in parallel with US1
    └─→ Phase 5 (US3: Interact with Game Features) ← Depends on US1 (routing) and US2 (components)
    ↓
Phase 6 (Polish) ← After all user stories complete
```

### Task Dependencies Within Phases

**Phase 2 (Foundational)**:
- T009-T012: Configuration tasks (can run in parallel)
- T013-T015: Utility implementations (can run in parallel)
- T016: Route migration (independent)

**Phase 3 (US1)**:
- T017-T019: Route files (can run in parallel)
- T020: Main entry point (depends on T017-T019)
- T021-T024: Session storage integration (sequential, depends on T013)
- T025-T027: Component migration (can run in parallel)
- T028-T030: Import updates (depends on T025-T027 and Phase 4 components)
- T031-T033: Error boundaries (can run in parallel, depends on T031)

**Phase 4 (US2)**:
- T034: Analysis (must complete first)
- T035-T048: Component migrations (can run in parallel after T034)
- T049-T052: Verification (sequential, depends on T035-T048)
- T053-T054: Exports (depends on T035-T048)
- T055-T057: Dependencies (can run in parallel)

**Phase 5 (US3)**:
- T058-T062: Component migrations (can run in parallel)
- T063-T067: Import updates (depends on T058-T062 and Phase 4)
- T068-T070: GameRoom integration (sequential, depends on T063-T067)
- T071-T072: Dependencies (can run in parallel)

**Phase 6 (Polish)**:
- T073-T076: Cleanup (can run in parallel)
- T077-T080: Verification (sequential)
- T081-T083: Documentation (can run in parallel)
- T084-T093: Manual testing (sequential)

---

## Parallel Execution Examples

### Phase 2 (Foundational)
```bash
# Can run in parallel:
- T010 (Vite path aliases)
- T011 (TypeScript paths)
- T012 (Tailwind config)
- T014 (UI utils)
- T015 (UI exports)

# Must run sequentially:
T009 (Vite config) → T010-T012 (depend on Vite setup)
T013 (Session storage) → T021-T024 (US1 session integration)
```

### Phase 3 (User Story 1)
```bash
# Can run in parallel:
- T017 (Root route)
- T018 (Landing route)
- T019 (Game room route)
- T025 (LandingPage component)
- T026 (GameRoom component)
- T027 (ImageWithFallback)
- T031 (ErrorFallback component)

# Must run sequentially:
T017-T019 → T020 (Main entry point needs routes)
T025-T027 + Phase 4 → T028-T030 (Import updates need components)
T031 → T032-T033 (Error boundaries need fallback component)
```

### Phase 4 (User Story 2)
```bash
# Can run in parallel (all component migrations):
- T035 (Button)
- T036 (Card)
- T037 (Input)
- T038 (Label)
- T039 (Dialog)
- T040-T048 (Additional components)

# Can run in parallel (dependencies):
- T055 (Radix UI deps)
- T056 (Other UI deps)
- T057 (Duplicate check)
```

### Phase 5 (User Story 3)
```bash
# Can run in parallel (all game component migrations):
- T058 (CardScanner)
- T059 (GameBoard)
- T060 (PlayerStats)
- T061 (VideoPanel)
- T062 (TurnTracker)

# Can run in parallel (import updates):
- T063-T067 (All import updates)

# Can run in parallel (dependencies):
- T071 (Game deps)
- T072 (Build verification)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Minimum Viable Product**: Implement only Phase 1, Phase 2, and Phase 3 (User Story 1)

**Delivers**:
- Basic routing between landing page and game room
- Session storage persistence
- Error boundaries
- Functional UI (even if not fully styled)

**Estimated Effort**: ~4-6 hours

**Value**: Users can navigate the application and create/join games

### Incremental Delivery

**Iteration 1** (MVP): Phase 1 + Phase 2 + Phase 3 (US1)
- Deploy: Basic routing works

**Iteration 2**: Add Phase 4 (US2)
- Deploy: Professional UI with shared components

**Iteration 3**: Add Phase 5 (US3)
- Deploy: Complete game experience

**Iteration 4**: Phase 6 (Polish)
- Deploy: Production-ready

### Parallel Development

If multiple developers available:
- **Developer 1**: Phase 3 (US1 - Routing & core components)
- **Developer 2**: Phase 4 (US2 - UI component migration)
- **Developer 3**: Phase 5 (US3 - Game feature components)

All can work in parallel after Phase 2 (Foundational) is complete.

---

## Task Summary

**Total Tasks**: 93
- Phase 1 (Setup): 8 tasks
- Phase 2 (Foundational): 8 tasks
- Phase 3 (US1): 17 tasks
- Phase 4 (US2): 24 tasks
- Phase 5 (US3): 15 tasks
- Phase 6 (Polish): 21 tasks

**Parallel Opportunities**: ~45 tasks can run in parallel (marked with [P])

**User Story Breakdown**:
- US1 (Access Game Interface): 17 tasks (~4-6 hours)
- US2 (Use Shared UI Components): 24 tasks (~6-8 hours)
- US3 (Interact with Game Features): 15 tasks (~4-6 hours)

**Total Estimated Effort**: 18-25 hours (matches plan.md estimate)

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 = 33 tasks (~8-10 hours)

# Tasks: Integrate Figma-Exported Vite App into Monorepo

**Input**: Design documents from `/specs/006-integrate-figma-exported/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested in specification - tasks focus on integration and configuration

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Monorepo structure: `apps/figma_export/`, `packages/ui/`, `packages/*/`
- Configuration files at app root: `apps/figma_export/[config-file]`
- Source files: `apps/figma_export/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency alignment

- [x] T001 [P] Update `apps/figma_export/package.json` to use workspace protocol for @repo/* packages and align React (19.0.0), Vite (7.1.7), Tailwind (4.0.6) versions per research.md
- [x] T002 [P] Add monorepo scripts to `apps/figma_export/package.json`: dev (port 3001), build, serve, lint, format, check-types
- [x] T003 Run `pnpm install` from repository root to resolve updated dependencies

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core configuration that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create `apps/figma_export/tsconfig.json` extending @repo/typescript-config with path mappings for @ and @repo/ui/* per configuration-contracts.md
- [x] T005 [P] Create `apps/figma_export/eslint.config.mjs` importing from @repo/eslint-config/react-internal.js per configuration-contracts.md
- [x] T006 [P] Create `apps/figma_export/.prettierrc` referencing @repo/prettier-config per configuration-contracts.md
- [x] T007 Update `apps/figma_export/vite.config.ts` to include viteTsConfigPaths, tailwindcss(), and viteReact() plugins with correct alias resolution per configuration-contracts.md
- [x] T008 Update `apps/figma_export/src/index.css` to use Tailwind v4 CSS-first configuration with @import "tailwindcss", @theme blocks, and remove all .dark variants per research.md
- [x] T009 Remove `next-themes` package from `apps/figma_export/package.json` dependencies (dark mode removal per clarifications)
- [x] T010 Update `apps/figma_export/src/main.tsx` to ensure it imports index.css and uses ReactDOM.createRoot with React.StrictMode per configuration-contracts.md

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Run Figma Export as Standalone App (Priority: P1) 🎯 MVP

**Goal**: Enable figma_export app to run as a standalone application with dev server, proper styling, and no errors

**Independent Test**: Run `cd apps/figma_export && pnpm dev` - app starts on port 3001, loads without errors, displays all UI components with correct styling, responds to interactions

### Implementation for User Story 1

- [ ] T011 [US1] Search and remove all theme switching UI components from `apps/figma_export/src/` (theme toggle buttons, theme provider wrappers, theme context)
- [ ] T012 [US1] Search and remove all dark mode CSS class references from `apps/figma_export/src/index.css` (keep only :root light mode variables)
- [ ] T013 [US1] Update `apps/figma_export/src/App.tsx` to remove any theme provider wrappers or dark mode logic
- [ ] T014 [US1] Run `cd apps/figma_export && pnpm dev` to verify app starts successfully on port 3001
- [ ] T015 [US1] Verify all UI components render correctly with Tailwind v4 styles (navigate through all pages/components)
- [ ] T016 [US1] Verify interactive elements respond appropriately (buttons, forms, modals, etc.)
- [ ] T017 [US1] Run `cd apps/figma_export && pnpm build` to verify production build succeeds without warnings

**Checkpoint**: At this point, User Story 1 should be fully functional - figma_export runs as standalone app

---

## Phase 4: User Story 2 - Consistent Tooling Across Apps (Priority: P2)

**Goal**: Ensure figma_export uses same linting, formatting, type checking, and styling tools as apps/web

**Independent Test**: Run `cd apps/figma_export && pnpm lint && pnpm format && pnpm check-types` - all commands execute without errors using shared configurations

### Implementation for User Story 2

- [ ] T018 [US2] Run `cd apps/figma_export && pnpm check-types` and document all TypeScript errors
- [ ] T019 [US2] Fix TypeScript errors in `apps/figma_export/src/` files (add missing types, fix any types, resolve import errors)
- [ ] T020 [US2] Run `cd apps/figma_export && pnpm lint` and document all ESLint errors
- [ ] T021 [US2] Fix ESLint errors in `apps/figma_export/src/` files (unused variables, missing dependencies, code style issues)
- [ ] T022 [US2] Run `cd apps/figma_export && pnpm format` to verify Prettier formatting passes
- [ ] T023 [US2] Fix any Prettier formatting issues in `apps/figma_export/src/` files
- [ ] T024 [US2] Verify Tailwind configuration consistency by comparing `apps/figma_export/src/index.css` with `apps/web/src/globals.css` (ensure similar structure, no dark mode in figma_export)
- [ ] T025 [US2] Run all tooling commands from repository root: `pnpm check-types`, `pnpm lint`, `pnpm format` to verify monorepo-wide consistency
- [ ] T026 [US2] Verify figma_export follows same project structure patterns as apps/web (src/ directory, main.tsx entry, index.html structure)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - app runs AND passes all quality checks

---

## Phase 5: User Story 3 - Reusable Component Library (Priority: P3)

**Goal**: Move all figma_export components to packages/ui for reuse across apps

**Independent Test**: Import components from @repo/ui in both figma_export and apps/web, verify they render identically

### Implementation for User Story 3

#### Component Migration (58 components)

- [ ] T027 [P] [US3] List all component files in `apps/figma_export/src/components/` and create migration checklist
- [ ] T028 [P] [US3] For each component in `apps/figma_export/src/components/ui/`, verify it doesn't already exist in `packages/ui/src/components/` (check for duplicates)
- [ ] T029 [US3] For components that exist in both locations, compare implementations and decide which version to keep per clarification (figma_export version takes precedence during migration)
- [ ] T030 [US3] Move first batch of components (10 components) from `apps/figma_export/src/components/ui/` to `packages/ui/src/components/` following component-interface.md contract
- [ ] T031 [US3] Update imports in `apps/figma_export/src/` to use `@repo/ui/components/[name]` for migrated components (batch 1)
- [ ] T032 [US3] Run `cd apps/figma_export && pnpm dev` to verify batch 1 components render correctly
- [ ] T033 [US3] Move second batch of components (10 components) from `apps/figma_export/src/components/ui/` to `packages/ui/src/components/`
- [ ] T034 [US3] Update imports in `apps/figma_export/src/` to use `@repo/ui/components/[name]` for migrated components (batch 2)
- [ ] T035 [US3] Run `cd apps/figma_export && pnpm dev` to verify batch 2 components render correctly
- [ ] T036 [US3] Move third batch of components (10 components) from `apps/figma_export/src/components/ui/` to `packages/ui/src/components/`
- [ ] T037 [US3] Update imports in `apps/figma_export/src/` to use `@repo/ui/components/[name]` for migrated components (batch 3)
- [ ] T038 [US3] Run `cd apps/figma_export && pnpm dev` to verify batch 3 components render correctly
- [ ] T039 [US3] Move fourth batch of components (10 components) from `apps/figma_export/src/components/ui/` to `packages/ui/src/components/`
- [ ] T040 [US3] Update imports in `apps/figma_export/src/` to use `@repo/ui/components/[name]` for migrated components (batch 4)
- [ ] T041 [US3] Run `cd apps/figma_export && pnpm dev` to verify batch 4 components render correctly
- [ ] T042 [US3] Move fifth batch of components (10 components) from `apps/figma_export/src/components/ui/` to `packages/ui/src/components/`
- [ ] T043 [US3] Update imports in `apps/figma_export/src/` to use `@repo/ui/components/[name]` for migrated components (batch 5)
- [ ] T044 [US3] Run `cd apps/figma_export && pnpm dev` to verify batch 5 components render correctly
- [ ] T045 [US3] Move remaining components (8 components) from `apps/figma_export/src/components/ui/` to `packages/ui/src/components/`
- [ ] T046 [US3] Update imports in `apps/figma_export/src/` to use `@repo/ui/components/[name]` for migrated components (final batch)
- [ ] T047 [US3] Run `cd apps/figma_export && pnpm dev` to verify all migrated components render correctly

#### Component Validation

- [ ] T048 [US3] Update `packages/ui/src/index.ts` to export all newly migrated components
- [ ] T049 [US3] Run `cd packages/ui && pnpm check-types` to verify all migrated components pass type checking
- [ ] T050 [US3] Run `cd packages/ui && pnpm lint` to verify all migrated components pass linting
- [ ] T051 [US3] Test importing migrated components in `apps/web/` to verify cross-app compatibility
- [ ] T052 [US3] Verify migrated components render identically in both figma_export and apps/web
- [ ] T053 [US3] Remove empty `apps/figma_export/src/components/ui/` directory if all components migrated
- [ ] T054 [US3] Update `packages/ui/package.json` if new dependencies were added from figma_export components

**Checkpoint**: All user stories should now be independently functional - components are shared and reusable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [ ] T055 [P] Run full monorepo type check: `pnpm check-types` from repository root
- [ ] T056 [P] Run full monorepo lint: `pnpm lint` from repository root
- [ ] T057 [P] Run full monorepo format check: `pnpm format` from repository root
- [ ] T058 [P] Build all apps: `pnpm build` from repository root
- [ ] T059 Validate quickstart.md instructions by following them step-by-step
- [ ] T060 [P] Update `apps/figma_export/README.md` with setup instructions and component migration notes
- [ ] T061 [P] Document any breaking changes or migration notes in feature documentation
- [ ] T062 Verify all success criteria from spec.md:
  - SC-001: App starts in <10s
  - SC-002: All tooling commands pass
  - SC-003: Production build succeeds
  - SC-004: Components importable from @repo/ui
  - SC-005: Tailwind v4 renders correctly
  - SC-006: No dark mode UI elements remain

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 but builds on working app
- **User Story 3 (P3)**: Should start after US1 complete (needs working app to test component migration)

### Within Each User Story

**US1**: Sequential tasks (remove theme → update CSS → update App → test)
**US2**: Sequential tasks (type check → fix → lint → fix → format → verify)
**US3**: Batched migration (10 components at a time, test after each batch)

### Parallel Opportunities

- **Phase 1**: T001, T002 can run in parallel (different concerns)
- **Phase 2**: T004, T005, T006 can run in parallel (different config files)
- **Phase 3**: Tasks are sequential (need to verify each change)
- **Phase 4**: Tasks are sequential (fix errors incrementally)
- **Phase 5**: Component batches are sequential, but within a batch, multiple components can be moved in parallel
- **Phase 6**: T055, T056, T057, T058, T060, T061 can run in parallel

---

## Parallel Example: Component Migration Batch

```bash
# Within a batch (e.g., T030), these can happen in parallel:
Task: "Move button.tsx from apps/figma_export/src/components/ui/ to packages/ui/src/components/"
Task: "Move card.tsx from apps/figma_export/src/components/ui/ to packages/ui/src/components/"
Task: "Move dialog.tsx from apps/figma_export/src/components/ui/ to packages/ui/src/components/"
# ... up to 10 components per batch
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T010) - CRITICAL
3. Complete Phase 3: User Story 1 (T011-T017)
4. **STOP and VALIDATE**: Test figma_export app independently
5. Demo working standalone app

**Deliverable**: Figma export app runs standalone with Tailwind v4, no dark mode

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **MVP COMPLETE**
3. Add User Story 2 → Test independently → **Quality tooling integrated**
4. Add User Story 3 → Test independently → **Components shared**
5. Polish → **Production ready**

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T010)
2. Once Foundational is done:
   - Developer A: User Story 1 (T011-T017)
   - Developer B: Can prepare US2 documentation
3. After US1 complete:
   - Developer A: User Story 2 (T018-T026)
   - Developer B: Can prepare US3 migration plan
4. After US2 complete:
   - Developers A+B: User Story 3 together (component migration benefits from pair work)

---

## Task Summary

**Total Tasks**: 62
- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 7 tasks
- **Phase 3 (US1 - Standalone App)**: 7 tasks
- **Phase 4 (US2 - Consistent Tooling)**: 9 tasks
- **Phase 5 (US3 - Component Library)**: 28 tasks
- **Phase 6 (Polish)**: 8 tasks

**Parallel Opportunities**: 15 tasks marked [P]

**Independent Test Criteria**:
- US1: Run dev server, verify UI renders and responds
- US2: Run lint/format/type-check, all pass
- US3: Import from @repo/ui in both apps, verify identical rendering

**Suggested MVP Scope**: Phases 1-3 (User Story 1 only) = 17 tasks

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Component migration is batched (10 at a time) to enable incremental validation
- Type checking and linting should be run frequently during implementation (per constitution)
- Use Context7 MCP server for up-to-date Tailwind v4 and Vite documentation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All 58 components will be migrated to packages/ui per clarification decision

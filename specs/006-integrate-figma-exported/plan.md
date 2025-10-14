# Implementation Plan: Integrate Figma-Exported Vite App into Monorepo

**Branch**: `006-integrate-figma-exported` | **Date**: October 14, 2025 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-integrate-figma-exported/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Integrate the Figma-exported Vite application (`apps/figma_export`) into the monorepo by configuring it to use shared tooling packages (TypeScript, Tailwind v4, Prettier, ESLint), migrating all UI components to the shared component library (`packages/ui`), removing dark mode/theme switching functionality, and ensuring the app runs as a standalone preview environment for design validation.

## Technical Context

**Language/Version**: TypeScript 5.9.2, React 19.0.0  
**Primary Dependencies**: Vite 7.x, Tailwind CSS 4.0.6, Radix UI components, React 19  
**Storage**: N/A (client-side only application)  
**Testing**: Vitest (following apps/web pattern)  
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: Web application (monorepo workspace)  
**Performance Goals**: <10s startup time, <100ms UI interaction response  
**Constraints**: Must use Tailwind v4, must remove all dark mode variants, must fix all linting/formatting violations  
**Scale/Scope**: ~64 components in figma_export/src, integration affects 3 packages (ui, tailwind, typescript-config, eslint-config, prettier)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Browser-First Architecture
✅ **PASS** - This is a client-side integration feature with no backend dependencies. The figma_export app runs entirely in the browser as a design preview tool.

### II. Data Contract Discipline
✅ **PASS** - No data contracts involved. This is a tooling integration and component migration feature.

### III. User-Centric Prioritization
✅ **PASS** - Feature is organized into 3 prioritized user stories (P1: Standalone app, P2: Consistent tooling, P3: Reusable components) with clear acceptance criteria. Prioritizes developer experience (users of this tool) over build-time concerns.

### IV. Specification-Driven Development
✅ **PASS** - Feature has complete spec.md with user scenarios, functional requirements (FR-001 through FR-016), and measurable success criteria. Clarifications completed via `/speckit.clarify`.

### V. Monorepo Package Isolation
✅ **PASS** - Integration leverages existing package boundaries (typescript-config, tailwind, prettier, eslint-config, ui). Components will be moved to packages/ui following established export patterns. No shared mutable state.

### VI. Performance Through Optimization, Not Complexity
✅ **PASS** - Simple integration approach: configure existing tools, migrate components, remove unused features. No new architectural layers or complex abstractions introduced.

### VII. Open Source and Community-Driven
✅ **PASS** - All work remains open source. Integration enables community contributors to preview Figma designs and contribute to shared component library.

### Continuous Verification
✅ **COMMITMENT** - Will run type checking and linting frequently during implementation. Will use Context7 MCP server for up-to-date Tailwind v4 and Vite documentation.

**Gate Status**: ✅ **ALL GATES PASS** - Proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```
specs/006-integrate-figma-exported/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
apps/
├── figma_export/              # Figma-exported Vite app (integration target)
│   ├── src/
│   │   ├── components/        # ~58 UI components (to be migrated to packages/ui)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css          # Tailwind styles (to be updated to v4)
│   ├── package.json           # Dependencies to be aligned with monorepo
│   ├── vite.config.ts         # Vite configuration (to be updated)
│   ├── tsconfig.json          # TypeScript config (to be created/updated)
│   ├── eslint.config.mjs      # ESLint config (to be created)
│   └── .prettierrc            # Prettier config (to be created)
│
└── web/                       # Reference implementation for tooling setup
    ├── src/
    │   ├── components/
    │   ├── routes/
    │   └── globals.css        # Tailwind v4 reference styles
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── eslint.config.mjs
    └── .prettierrc

packages/
├── ui/                        # Shared component library (migration target)
│   ├── src/
│   │   ├── components/        # Existing shared components
│   │   ├── lib/               # Utility functions (cn, etc.)
│   │   └── index.ts           # Component exports
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
│
├── typescript-config/         # Shared TypeScript configurations
│   └── [various tsconfig bases]
│
├── tailwind/                  # Shared Tailwind configuration
│   ├── base.css
│   └── [config files]
│
├── prettier/                  # Shared Prettier configuration
│   └── index.js
│
└── eslint-config/             # Shared ESLint configuration
    ├── base.js
    ├── react-internal.js
    └── package.json
```

**Structure Decision**: Monorepo web application structure. The figma_export app will be configured as a standard monorepo workspace app following the patterns established by apps/web. Components will be migrated to packages/ui following existing export conventions. No new directories or packages required.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - All constitution principles are satisfied. This is a straightforward integration feature using existing patterns and tools.

## Phase Execution Summary

### Phase 0: Research ✅ COMPLETE

**Artifacts Created**:
- `research.md`: Comprehensive research on Tailwind v4, monorepo tooling, component migration, dark mode removal, and dependency alignment

**Key Decisions**:
1. **Tailwind v4**: Use `@tailwindcss/vite` plugin with CSS-first configuration
2. **Tooling Integration**: Use workspace protocol with shared config packages
3. **Component Migration**: Move all figma_export components to packages/ui incrementally
4. **Dark Mode Removal**: Remove all `.dark` variants and theme switching logic
5. **Dependency Alignment**: Upgrade figma_export to React 19, Vite 7, Tailwind 4

**Status**: All research questions resolved, no blocking unknowns

### Phase 1: Design & Contracts ✅ COMPLETE

**Artifacts Created**:
- `data-model.md`: Documents configuration entities (no runtime data model)
- `contracts/component-interface.md`: Component interface contract for packages/ui
- `contracts/configuration-contracts.md`: Configuration file contracts (package.json, tsconfig, vite, eslint, prettier)
- `quickstart.md`: Developer guide for running and working with figma_export

**Key Contracts**:
1. **Component Interface**: TypeScript types, export patterns, styling with CVA, accessibility
2. **Configuration Standards**: Package.json structure, TypeScript config, Vite setup, ESLint/Prettier integration
3. **Tailwind v4 Contract**: CSS-first configuration, no dark mode, light mode only

**Agent Context**: Updated `.windsurf/rules/specify-rules.md` with feature technologies

**Status**: All design artifacts complete, ready for task generation

### Phase 2: Task Generation (Next Step)

**Command**: `/speckit.tasks`

**Expected Output**: `tasks.md` with dependency-ordered implementation tasks organized by user story priority

**Task Categories**:
1. P1 tasks: Configure figma_export app with shared tooling
2. P2 tasks: Ensure consistent tooling across apps
3. P3 tasks: Migrate components to packages/ui

### Constitution Re-Check (Post-Design)

Re-evaluating constitution compliance after Phase 1 design:

✅ **All gates still pass** - Design artifacts maintain alignment with all constitution principles:
- Browser-first: Client-side only, no backend
- Data contracts: Configuration contracts documented
- User-centric: Prioritized by user value (P1→P2→P3)
- Specification-driven: Complete spec with acceptance criteria
- Package isolation: Leverages existing boundaries
- Performance through optimization: Simple integration, no complexity
- Open source: All work remains open

**Final Gate Status**: ✅ **APPROVED** - Proceed to Phase 2 (Task Generation)

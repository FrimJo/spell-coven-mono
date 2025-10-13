# Implementation Plan: Integrate Figma UI into Web Application

**Branch**: `004-integrate-figma-generated` | **Date**: 2025-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-integrate-figma-generated/spec.md`

## Summary

Migrate Figma-generated React UI components from `code_from_figma_make/` into the main `apps/web` application with TanStack Router for client-side routing, Vite for bundling, and Tailwind CSS for styling. The migration includes 7 game-specific components (LandingPage, GameRoom, CardScanner, GameBoard, PlayerStats, VideoPanel, TurnTracker) and used shadcn/ui components moved to a shared package. Game state will persist in session storage, existing routes will be moved to `/prev` namespace, per-route error boundaries will be implemented, and the next-themes dependency will be removed.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (frontend), Node.js 20+ (build tooling)
**Primary Dependencies**: 
- Frontend: React 19, TanStack Router, Vite, Tailwind CSS
- UI Components: shadcn/ui (Radix UI primitives), lucide-react (icons)
- Monorepo: pnpm workspaces, Turborepo
**Storage**: Session storage (game state persistence)
**Testing**: Vitest (unit/integration tests)
**Target Platform**: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
**Project Type**: Web application (monorepo structure)
**Performance Goals**: 
- Page navigation: <100ms (client-side routing)
- Component render: 60 FPS
- Build time: <30 seconds for incremental changes
**Constraints**: 
- No backend dependencies for core routing/UI
- Session storage only (no local storage persistence)
- Single dark theme (no theme switching)
- Shared package for UI components
**Scale/Scope**: 
- 7 game components + ~15-20 shadcn/ui components
- 2 main routes (landing page, game room)
- Monorepo migration affecting apps/web and creating new shared package

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Browser-First Architecture
- **Status**: PASS
- **Evidence**: Migration maintains browser-first approach. All UI components run client-side with no backend dependencies. Session storage used for state persistence.

### ✅ II. Data Contract Discipline
- **Status**: PASS
- **Evidence**: Session storage schema will be documented. Component props interfaces are typed. Shared package exports will have clear TypeScript interfaces.

### ✅ III. User-Centric Prioritization
- **Status**: PASS
- **Evidence**: User stories prioritized by value (P1: Basic routing → P2: Component styling → P3: Game features). Migration focuses on user-facing functionality, not build optimization.

### ✅ IV. Specification-Driven Development
- **Status**: PASS
- **Evidence**: Complete spec.md with user stories, functional requirements, and success criteria. Clarifications documented. This plan provides technical approach.

### ✅ V. Monorepo Package Isolation
- **Status**: PASS
- **Evidence**: Creating shared UI component package (`packages/ui`) for monorepo-wide reuse. Clear boundaries between apps/web and shared packages.

### ✅ VI. Performance Through Optimization, Not Complexity
- **Status**: PASS
- **Evidence**: Simple client-side routing with TanStack Router. Session storage for state. No complex state management or architectural layers added.

### ✅ VII. Open Source and Community-Driven
- **Status**: PASS
- **Evidence**: Migration maintains open-source codebase. Documentation enables contributors to understand component structure and routing.

**Overall**: ✅ All constitution principles satisfied. No complexity justification required.

## Project Structure

### Documentation (this feature)

```
specs/004-integrate-figma-generated/
├── spec.md              # Feature specification (COMPLETE)
├── plan.md              # This file (IN PROGRESS)
├── research.md          # Phase 0 output (TO BE CREATED)
├── data-model.md        # Phase 1 output (TO BE CREATED)
├── quickstart.md        # Phase 1 output (TO BE CREATED)
├── contracts/           # Phase 1 output (TO BE CREATED)
│   ├── session-storage.md
│   └── component-props.md
├── checklists/
│   └── requirements.md  # Specification validation (COMPLETE)
└── README.md            # Feature overview (COMPLETE)
```

### Source Code (repository root)

```
apps/web/                                    # Main web application
├── src/
│   ├── routes/                             # TanStack Router routes
│   │   ├── __root.tsx                      # Root layout with error boundary
│   │   ├── index.tsx                       # Landing page route (/)
│   │   ├── game.$gameId.tsx                # Game room route (/game/:gameId)
│   │   └── prev/                           # Existing routes moved here
│   │       └── [existing route files]
│   ├── components/                         # Game-specific components
│   │   ├── LandingPage.tsx                 # From code_from_figma_make
│   │   ├── GameRoom.tsx                    # From code_from_figma_make
│   │   ├── CardScanner.tsx                 # From code_from_figma_make
│   │   ├── GameBoard.tsx                   # From code_from_figma_make
│   │   ├── PlayerStats.tsx                 # From code_from_figma_make
│   │   ├── VideoPanel.tsx                  # From code_from_figma_make
│   │   ├── TurnTracker.tsx                 # From code_from_figma_make
│   │   └── figma/                          # Figma-specific utilities
│   │       └── ImageWithFallback.tsx
│   ├── lib/
│   │   ├── session-storage.ts              # Game state persistence
│   │   └── utils.ts                        # Utility functions
│   ├── main.tsx                            # App entry point (updated for router)
│   └── router.tsx                          # TanStack Router configuration
├── tests/
│   ├── integration/
│   │   └── routing.test.ts                 # Route navigation tests
│   └── unit/
│       └── session-storage.test.ts         # Storage tests
├── package.json                            # Updated with merged dependencies
├── vite.config.ts                          # Vite configuration
├── tailwind.config.ts                      # Tailwind configuration
└── tsconfig.json                           # TypeScript configuration

packages/ui/                                 # NEW: Shared UI component package
├── src/
│   ├── components/                         # shadcn/ui components (used only)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   └── [other used components]
│   ├── lib/
│   │   └── utils.ts                        # cn() helper, etc.
│   └── index.ts                            # Package exports
├── package.json
├── tailwind.config.ts                      # Shared Tailwind config
└── tsconfig.json

code_from_figma_make/                        # TO BE REMOVED after migration
└── [all files deleted post-migration]
```

**Structure Decision**: Monorepo web application structure. The migration creates a new shared `packages/ui` package for shadcn/ui components that can be reused across the monorepo. Game-specific components stay in `apps/web/src/components/`. TanStack Router routes are organized in `apps/web/src/routes/` with existing routes moved to a `/prev` namespace. Session storage logic is centralized in `apps/web/src/lib/session-storage.ts`.

## Complexity Tracking

*No violations - all constitution principles satisfied. No complexity justification required.*

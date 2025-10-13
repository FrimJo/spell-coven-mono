# Feature: Integrate Figma UI into Web Application

**Branch**: `004-integrate-figma-generated`
**Status**: Specification Complete ✅
**Created**: 2025-10-13

## Overview

Migrate Figma-generated React UI code from `code_from_figma_make/` into the main `apps/web` application with proper Vite and TanStack Router integration, shadcn/ui components, and Tailwind CSS styling.

## Documentation

- **[spec.md](./spec.md)** - Feature specification
  - 3 prioritized user stories (P1: Routing, P2: Components, P3: Game Features)
  - 18 functional requirements (FR-001 through FR-018)
  - 10 measurable success criteria (SC-001 through SC-010)
  - Comprehensive edge cases

- **[checklists/requirements.md](./checklists/requirements.md)** - Specification validation (✅ All passed)

## Migration Scope

### Source Directory
```
code_from_figma_make/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── LandingPage.tsx
│   │   ├── GameRoom.tsx
│   │   ├── CardScanner.tsx
│   │   ├── GameBoard.tsx
│   │   ├── PlayerStats.tsx
│   │   ├── VideoPanel.tsx
│   │   ├── TurnTracker.tsx
│   │   └── ui/ (46 shadcn/ui components)
│   └── main.tsx
├── package.json (dependencies to merge)
└── vite.config.ts (configuration to merge)
```

### Target Structure
```
apps/web/
├── src/
│   ├── routes/
│   │   ├── __root.tsx (TanStack Router root)
│   │   ├── index.tsx (Landing page route)
│   │   └── game.$gameId.tsx (Game room route)
│   ├── components/
│   │   ├── LandingPage.tsx
│   │   ├── GameRoom.tsx
│   │   ├── CardScanner.tsx
│   │   ├── GameBoard.tsx
│   │   ├── PlayerStats.tsx
│   │   ├── VideoPanel.tsx
│   │   ├── TurnTracker.tsx
│   │   └── ui/ (shadcn/ui components)
│   └── main.tsx (updated for TanStack Router)
└── package.json (merged dependencies)
```

## User Stories

### P1: Access Game Interface
**Goal**: Basic routing works - users can navigate between landing page and game room

**Value**: Foundation for all other features. Users can access the designed UI.

**Test**: Navigate to root → see landing page → create/join game → see game room → leave game → back to landing

### P2: Use Shared UI Components
**Goal**: All shadcn/ui components styled with Tailwind CSS

**Value**: Professional, consistent UI that's maintainable and reusable.

**Test**: Verify all components render with correct Tailwind styling and are interactive

### P3: Interact with Game Features
**Goal**: All game-specific components functional in game room

**Value**: Complete gameplay experience with scanner, board, stats, video, and turn tracking.

**Test**: Enter game room → verify all features accessible and functional

## Key Requirements

### Migration (FR-001 to FR-005)
- Migrate all components from `code_from_figma_make/` to `apps/web/`
- Integrate TanStack Router for routing
- Configure Vite for proper imports
- Remove source directory after migration
- Merge dependencies

### UI Components (FR-006 to FR-009)
- Integrate all 46 shadcn/ui components
- Refactor styling to Tailwind CSS
- Maintain functionality during conversion
- Configure Tailwind design tokens

### Routing (FR-010 to FR-013)
- Create routes: "/" (landing) and "/game/:gameId" (game room)
- Handle route parameters correctly
- Support browser back/forward navigation
- Preserve game state during transitions

### Game Features (FR-014 to FR-018)
- Integrate CardScanner, GameBoard, PlayerStats, VideoPanel, TurnTracker

## Success Criteria

- ✅ 100% of components migrated with functionality preserved
- ✅ Navigation works without errors or page refreshes
- ✅ All components render with Tailwind styling
- ✅ `code_from_figma_make/` directory completely removed
- ✅ Application builds successfully with Vite
- ✅ All game features accessible and functional
- ✅ Routing handles edge cases gracefully
- ✅ 100% Tailwind CSS (no custom CSS remaining)
- ✅ Responsive design across all breakpoints
- ✅ No duplicate dependencies

## Next Steps

1. **Generate implementation plan**:
   ```bash
   /speckit.plan
   ```
   This will create technical details including:
   - TanStack Router configuration
   - Vite setup and path aliases
   - Tailwind configuration
   - Component migration strategy
   - Dependency merge plan

2. **Generate tasks**:
   ```bash
   /speckit.tasks
   ```

3. **Implement**:
   ```bash
   /speckit.implement
   ```

## Dependencies

### New Dependencies (from code_from_figma_make)
- @radix-ui/* (multiple packages for shadcn/ui)
- class-variance-authority
- clsx
- cmdk
- embla-carousel-react
- input-otp
- lucide-react
- next-themes
- react-day-picker
- react-hook-form
- react-resizable-panels
- recharts
- sonner
- tailwind-merge
- vaul

### Existing Dependencies (apps/web)
- React 19
- Vite
- TanStack Router
- Tailwind CSS

## References

- Source: `code_from_figma_make/` directory
- Target: `apps/web/` application
- Constitution: `.specify/memory/constitution.md`
- Related Feature: `specs/001-enable-mtg-players/` (card recognition)

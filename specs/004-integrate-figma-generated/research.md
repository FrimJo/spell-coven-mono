# Research: Integrate Figma UI into Web Application

**Feature**: 004-integrate-figma-generated  
**Date**: 2025-10-13  
**Status**: Complete

## Overview

This document consolidates research findings for migrating Figma-generated React UI code into the main web application with TanStack Router, Vite, and Tailwind CSS.

## Research Areas

### 1. TanStack Router File-Based Routing

**Decision**: Use file-based routing with TanStack Router plugin for Vite

**Rationale**:
- Automatic route tree generation from file structure
- Type-safe routing with full TypeScript inference
- Built-in code splitting per route
- Simpler than manual route configuration
- Standard convention for React applications

**Implementation Details**:

**Vite Configuration** (`vite.config.ts`):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
  ],
})
```

**Route File Structure**:
```
src/routes/
├── __root.tsx              # Root layout with error boundary
├── index.tsx               # Landing page (/)
├── game.$gameId.tsx        # Game room (/game/:gameId)
└── prev/                   # Existing routes moved here
    └── [existing files]
```

**File Naming Conventions**:
- `__root.tsx` - Root layout component
- `index.tsx` - Index route for current directory
- `$param.tsx` - Dynamic route parameter
- `route.tsx` - Layout route (renders children)

**Alternatives Considered**:
- Manual route configuration with `createBrowserRouter` - Rejected: More boilerplate, no auto-generation
- React Router v6 - Rejected: Less type-safe, no built-in code splitting

### 2. Session Storage for Game State

**Decision**: Use browser Session Storage API with typed interface

**Rationale**:
- Native browser API (no dependencies)
- Automatically cleared on browser close
- Synchronous API (simpler than IndexedDB)
- Sufficient for temporary game sessions
- Works offline

**Implementation Pattern**:
```typescript
// src/lib/session-storage.ts
interface GameState {
  gameId: string
  playerName: string
  timestamp: number
}

const GAME_STATE_KEY = 'spell-coven:game-state'

export const sessionStorage = {
  saveGameState(state: GameState): void {
    window.sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(state))
  },
  
  loadGameState(): GameState | null {
    const data = window.sessionStorage.getItem(GAME_STATE_KEY)
    if (!data) return null
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  },
  
  clearGameState(): void {
    window.sessionStorage.removeItem(GAME_STATE_KEY)
  }
}
```

**Alternatives Considered**:
- Local Storage - Rejected: Persists across sessions (not desired per clarifications)
- IndexedDB - Rejected: Async API adds complexity for simple key-value storage
- URL parameters only - Rejected: Exposes game state in URL, lost on refresh

### 3. Shared UI Component Package Structure

**Decision**: Create `packages/ui` with shadcn/ui components and shared Tailwind config

**Rationale**:
- Enables reuse across monorepo (future apps can import)
- Centralizes component library maintenance
- Shared Tailwind config ensures consistency
- Tree-shakeable exports (only import what's used)
- Follows monorepo best practices

**Package Structure**:
```
packages/ui/
├── src/
│   ├── components/          # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── [others]
│   ├── lib/
│   │   └── utils.ts         # cn() helper, etc.
│   └── index.ts             # Barrel exports
├── package.json
├── tailwind.config.ts       # Shared config
└── tsconfig.json
```

**package.json**:
```json
{
  "name": "@repo/ui",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**Alternatives Considered**:
- Keep all components in apps/web - Rejected: No reusability, harder to maintain
- Separate package per component - Rejected: Too granular, management overhead
- Publish to npm - Rejected: Unnecessary for monorepo, adds deployment complexity

### 4. Error Boundary Implementation

**Decision**: Per-route error boundaries using React Error Boundary pattern

**Rationale**:
- Isolates errors to specific routes
- Users can navigate away from errors
- Simpler than component-level boundaries
- Matches natural application structure
- Provides clear recovery path

**Implementation Pattern**:
```typescript
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Outlet />
    </div>
  )
}

// src/routes/index.tsx (Landing page with error boundary)
import { createFileRoute } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'
import { LandingPage } from '@/components/LandingPage'

export const Route = createFileRoute('/')({
  component: () => (
    <ErrorBoundary
      fallback={<ErrorFallback message="Landing page failed to load" />}
      onReset={() => window.location.reload()}
    >
      <LandingPage />
    </ErrorBoundary>
  ),
})
```

**Alternatives Considered**:
- Single app-level boundary - Rejected: Entire app crashes on any error
- Component-level boundaries - Rejected: Too granular, maintenance burden
- No error boundaries - Rejected: Poor user experience on errors

### 5. Dependency Management

**Decision**: Merge dependencies from code_from_figma_make, remove next-themes, add TanStack Router

**Dependencies to Add**:
```json
{
  "@tanstack/react-router": "^1.114.3",
  "@tanstack/router-plugin": "^1.114.3",
  "react-error-boundary": "^4.0.0"
}
```

**Dependencies to Remove**:
```json
{
  "next-themes": "^0.4.6"  // Theme switching out of scope
}
```

**Dependencies to Keep** (from code_from_figma_make):
```json
{
  "@radix-ui/*": "^1.x",           // shadcn/ui primitives
  "class-variance-authority": "^0.7.1",
  "clsx": "*",
  "cmdk": "^1.1.1",
  "embla-carousel-react": "^8.6.0",
  "input-otp": "^1.4.2",
  "lucide-react": "^0.487.0",
  "react-day-picker": "^8.10.1",
  "react-hook-form": "^7.55.0",
  "react-resizable-panels": "^2.1.7",
  "recharts": "^2.15.2",
  "sonner": "^2.0.3",
  "tailwind-merge": "*",
  "vaul": "^1.1.2"
}
```

**Rationale**:
- TanStack Router for client-side routing
- react-error-boundary for error handling
- Keep only used Radix UI components (determined during migration)
- Remove next-themes per clarifications

### 6. Tailwind CSS Configuration

**Decision**: Extend existing Tailwind config with Figma design tokens

**Rationale**:
- Maintain consistency with existing design system
- Add Figma-specific colors/spacing as needed
- Share config between apps/web and packages/ui
- Use Tailwind CSS v3 features (arbitrary values, JIT)

**Configuration Strategy**:
```typescript
// packages/ui/tailwind.config.ts (base config)
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Figma design tokens
        slate: {
          950: '#020617',  // bg-slate-950 from Figma
        },
      },
    },
  },
}

// apps/web/tailwind.config.ts (extends base)
import baseConfig from '@repo/ui/tailwind.config'

export default {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',  // Include shared components
  ],
}
```

**Alternatives Considered**:
- Separate configs - Rejected: Duplication, inconsistency risk
- CSS-in-JS - Rejected: Adds runtime overhead, against Tailwind approach
- Custom CSS - Rejected: Defeats purpose of Tailwind migration

### 7. Migration Strategy

**Decision**: Incremental migration with validation at each step

**Migration Steps**:
1. Create `packages/ui` package structure
2. Identify and migrate used shadcn/ui components to `packages/ui`
3. Update `apps/web` to import from `@repo/ui`
4. Move existing routes to `/prev` namespace
5. Create TanStack Router configuration
6. Migrate game components to `apps/web/src/components`
7. Create route files (`__root.tsx`, `index.tsx`, `game.$gameId.tsx`)
8. Implement session storage utilities
9. Add error boundaries to routes
10. Update dependencies (add TanStack Router, remove next-themes)
11. Test routing and component rendering
12. Delete `code_from_figma_make/` directory

**Validation After Each Step**:
- Application builds successfully (`pnpm build`)
- Type checking passes (`pnpm check-types`)
- No console errors in browser
- Routes navigate correctly

**Rationale**:
- Reduces risk of breaking changes
- Easier to debug issues
- Can commit after each successful step
- Maintains working application throughout

## Summary

All technical decisions have been made based on:
- TanStack Router documentation and best practices
- Clarifications from specification phase
- Monorepo architecture requirements
- Constitution principles (browser-first, simplicity, user-centric)

**Ready for Phase 1**: Data model and contracts can now be defined.

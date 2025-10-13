# Quickstart: Integrate Figma UI into Web Application

**Feature**: 004-integrate-figma-generated  
**Date**: 2025-10-13  
**Audience**: Developers implementing this feature

## Overview

This guide provides step-by-step instructions for migrating the Figma-generated UI code into the main web application with TanStack Router, Vite, and Tailwind CSS.

## Prerequisites

- Node.js 20+
- pnpm 8+
- Familiarity with React, TypeScript, and Tailwind CSS
- Access to `code_from_figma_make/` directory

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
# From repository root
cd apps/web
pnpm add @tanstack/react-router @tanstack/router-plugin react-error-boundary
pnpm remove next-themes
```

### 2. Create Shared UI Package

```bash
# From repository root
mkdir -p packages/ui/src/{components,lib}
cd packages/ui
pnpm init
```

### 3. Configure TanStack Router

```bash
# From apps/web
# Create routes directory
mkdir -p src/routes

# Update vite.config.ts (see Configuration section below)
```

### 4. Run Development Server

```bash
# From repository root
pnpm dev
```

## Detailed Setup

### Step 1: Create Shared UI Package

**Create package structure**:
```bash
mkdir -p packages/ui/src/{components,lib}
touch packages/ui/package.json
touch packages/ui/tsconfig.json
touch packages/ui/tailwind.config.ts
```

**packages/ui/package.json**:
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
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.1.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "*",
    "tailwind-merge": "*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.0.0"
  }
}
```

**packages/ui/tsconfig.json**:
```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**packages/ui/tailwind.config.ts**:
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
```

### Step 2: Migrate shadcn/ui Components

**Identify used components**:
```bash
# From code_from_figma_make
grep -r "from.*components/ui" src/components/*.tsx | cut -d: -f2 | sort -u
```

**Copy used components**:
```bash
# Example: Migrate Button component
cp code_from_figma_make/src/components/ui/button.tsx packages/ui/src/components/
```

**Update imports in components**:
```typescript
// Before
import { Button } from './components/ui/button'

// After
import { Button } from '@repo/ui/components/button'
```

### Step 3: Configure Vite for TanStack Router

**apps/web/vite.config.ts**:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@repo/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
})
```

**apps/web/tsconfig.json** (update paths):
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@repo/ui/*": ["../../packages/ui/src/*"]
    }
  },
  "include": ["src", "src/routeTree.gen.ts"]
}
```

### Step 4: Create Route Files

**Create root route** (`src/routes/__root.tsx`):
```typescript
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-slate-950">
      <Outlet />
    </div>
  ),
})
```

**Create landing page route** (`src/routes/index.tsx`):
```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'
import { LandingPage } from '@/components/LandingPage'
import { sessionStorage } from '@/lib/session-storage'

export const Route = createFileRoute('/')({
  component: LandingPageRoute,
})

function LandingPageRoute() {
  const navigate = useNavigate()

  const handleCreateGame = (playerName: string) => {
    const gameId = `game-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.saveGameState({
      gameId,
      playerName,
      timestamp: Date.now(),
    })
    navigate({ to: '/game/$gameId', params: { gameId } })
  }

  const handleJoinGame = (playerName: string, gameId: string) => {
    sessionStorage.saveGameState({
      gameId,
      playerName,
      timestamp: Date.now(),
    })
    navigate({ to: '/game/$gameId', params: { gameId } })
  }

  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <LandingPage
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
      />
    </ErrorBoundary>
  )
}

function ErrorFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white">Failed to load landing page</p>
    </div>
  )
}
```

**Create game room route** (`src/routes/game.$gameId.tsx`):
```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'
import { GameRoom } from '@/components/GameRoom'
import { sessionStorage } from '@/lib/session-storage'

export const Route = createFileRoute('/game/$gameId')({
  component: GameRoomRoute,
})

function GameRoomRoute() {
  const { gameId } = Route.useParams()
  const navigate = useNavigate()
  
  const state = sessionStorage.loadGameState()
  const playerName = state?.playerName ?? 'Guest'

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/' })
  }

  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <GameRoom
        gameId={gameId}
        playerName={playerName}
        onLeaveGame={handleLeaveGame}
      />
    </ErrorBoundary>
  )
}

function ErrorFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white">Failed to load game room</p>
    </div>
  )
}
```

### Step 5: Implement Session Storage

**Create session storage utility** (`src/lib/session-storage.ts`):
```typescript
interface GameState {
  gameId: string
  playerName: string
  timestamp: number
}

const GAME_STATE_KEY = 'spell-coven:game-state'

function validateGameState(data: unknown): GameState | null {
  if (!data || typeof data !== 'object') return null
  
  const state = data as Partial<GameState>
  
  if (!state.gameId || typeof state.gameId !== 'string') return null
  if (!state.playerName || typeof state.playerName !== 'string') return null
  if (!state.timestamp || typeof state.timestamp !== 'number') return null
  
  if (!/^game-[a-z0-9]{9}$/.test(state.gameId)) return null
  if (state.playerName.length < 1 || state.playerName.length > 50) return null
  
  const now = Date.now()
  if (state.timestamp > now || state.timestamp < now - 24 * 60 * 60 * 1000) {
    return null
  }
  
  return state as GameState
}

export const sessionStorage = {
  saveGameState(state: GameState): void {
    window.sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(state))
  },
  
  loadGameState(): GameState | null {
    const data = window.sessionStorage.getItem(GAME_STATE_KEY)
    if (!data) return null
    
    try {
      const parsed = JSON.parse(data)
      return validateGameState(parsed)
    } catch {
      return null
    }
  },
  
  clearGameState(): void {
    window.sessionStorage.removeItem(GAME_STATE_KEY)
  },
}
```

### Step 6: Migrate Game Components

**Copy components**:
```bash
cp code_from_figma_make/src/components/LandingPage.tsx apps/web/src/components/
cp code_from_figma_make/src/components/GameRoom.tsx apps/web/src/components/
cp code_from_figma_make/src/components/CardScanner.tsx apps/web/src/components/
cp code_from_figma_make/src/components/GameBoard.tsx apps/web/src/components/
cp code_from_figma_make/src/components/PlayerStats.tsx apps/web/src/components/
cp code_from_figma_make/src/components/VideoPanel.tsx apps/web/src/components/
cp code_from_figma_make/src/components/TurnTracker.tsx apps/web/src/components/
```

**Update imports in each component**:
```typescript
// Before
import { Button } from './ui/button'

// After
import { Button } from '@repo/ui/components/button'
```

### Step 7: Update Main Entry Point

**apps/web/src/main.tsx**:
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
```

### Step 8: Move Existing Routes

**Create prev directory**:
```bash
mkdir -p apps/web/src/routes/prev
```

**Move existing route files**:
```bash
# Example (adjust based on actual files)
mv apps/web/src/routes/old-route.tsx apps/web/src/routes/prev/
```

### Step 9: Clean Up

**Remove Figma code directory**:
```bash
rm -rf code_from_figma_make
```

**Remove next-themes references**:
```bash
# Search for next-themes imports
grep -r "next-themes" apps/web/src/
# Remove any found imports and usage
```

## Verification

### Build Check

```bash
pnpm build
```

**Expected**: No errors, successful build

### Type Check

```bash
pnpm check-types
```

**Expected**: No TypeScript errors

### Development Server

```bash
pnpm dev
```

**Expected**: 
- App runs on http://localhost:5173
- Landing page loads
- Can create/join game
- Game room loads
- Can leave game

### Manual Testing

1. **Landing Page**:
   - Enter player name
   - Click "Create Game"
   - Verify redirect to `/game/:gameId`

2. **Game Room**:
   - Verify player name displayed
   - Verify game ID displayed
   - Click "Leave Game"
   - Verify redirect to `/`

3. **Session Persistence**:
   - Create/join game
   - Refresh page
   - Verify still in game room

4. **Error Boundaries**:
   - Trigger error in component
   - Verify error fallback displays
   - Verify can recover

## Troubleshooting

### Route Tree Not Found

**Error**: `Cannot find module './routeTree.gen'`

**Solution**: Ensure TanStack Router plugin runs before React plugin in `vite.config.ts`

### Import Path Errors

**Error**: `Cannot find module '@repo/ui/components/button'`

**Solution**: 
1. Check `tsconfig.json` paths configuration
2. Check `vite.config.ts` alias configuration
3. Restart TypeScript server in IDE

### Session Storage Not Working

**Error**: State not persisting across refreshes

**Solution**:
1. Check browser console for errors
2. Verify session storage is enabled in browser
3. Check validation logic in `session-storage.ts`

### Tailwind Styles Not Applied

**Error**: Components render but have no styling

**Solution**:
1. Verify `tailwind.config.ts` content paths include all source files
2. Check `index.css` imports Tailwind directives
3. Restart dev server

## Next Steps

After completing migration:

1. **Run Tests**:
   ```bash
   pnpm test
   ```

2. **Generate Tasks**:
   ```bash
   /speckit.tasks
   ```

3. **Begin Implementation**:
   ```bash
   /speckit.implement
   ```

## References

- [TanStack Router Docs](https://tanstack.com/router)
- [Vite Docs](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [shadcn/ui Docs](https://ui.shadcn.com/)
- Feature Specification: `specs/004-integrate-figma-generated/spec.md`
- Implementation Plan: `specs/004-integrate-figma-generated/plan.md`
- Research: `specs/004-integrate-figma-generated/research.md`
- Data Model: `specs/004-integrate-figma-generated/data-model.md`
- Contracts: `specs/004-integrate-figma-generated/contracts/`

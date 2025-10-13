# Data Model: Integrate Figma UI into Web Application

**Feature**: 004-integrate-figma-generated  
**Date**: 2025-10-13  
**Status**: Complete

## Overview

This document defines the data structures and their relationships for the Figma UI migration feature. The primary entities are Game Session (persisted state) and Route (navigation structure).

## Entities

### Game Session

**Description**: Represents an active game session with state persisted in browser session storage.

**Attributes**:
| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `gameId` | `string` | Yes | Unique identifier for the game | Non-empty string, format: `game-{random}` |
| `playerName` | `string` | Yes | Current player's display name | Non-empty string, max 50 characters |
| `timestamp` | `number` | Yes | Unix timestamp when session was created | Positive integer |

**Storage**: Browser Session Storage (key: `spell-coven:game-state`)

**Lifecycle**:
1. **Created**: When user clicks "Create Game" or "Join Game"
2. **Updated**: Never (immutable once created)
3. **Deleted**: When user clicks "Leave Game" or browser session ends

**State Transitions**:
```
[No Session] --create/join--> [Active Session] --leave/close browser--> [No Session]
```

**TypeScript Interface**:
```typescript
interface GameState {
  gameId: string
  playerName: string
  timestamp: number
}
```

**Validation Rules**:
- `gameId` must match pattern `/^game-[a-z0-9]{9}$/`
- `playerName` must be 1-50 characters
- `timestamp` must be valid Unix timestamp (milliseconds)

### Route

**Description**: Represents a navigable page in the application with TanStack Router configuration.

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | Yes | URL path pattern |
| `component` | `React.Component` | Yes | Component to render |
| `params` | `Record<string, string>` | No | Dynamic route parameters |
| `errorBoundary` | `React.Component` | Yes | Error fallback component |

**Routes**:

**Landing Page**:
- Path: `/`
- File: `src/routes/index.tsx`
- Component: `LandingPage`
- Params: None
- Error Boundary: Yes

**Game Room**:
- Path: `/game/:gameId`
- File: `src/routes/game.$gameId.tsx`
- Component: `GameRoom`
- Params: `{ gameId: string }`
- Error Boundary: Yes

**Previous Routes** (existing):
- Path: `/prev/*`
- File: `src/routes/prev/[existing files]`
- Component: Various
- Params: Various
- Error Boundary: Inherited from root

**TypeScript Interface**:
```typescript
interface RouteConfig {
  path: string
  component: React.ComponentType
  params?: Record<string, string>
  errorBoundary: React.ComponentType<{ error: Error }>
}
```

### UI Component (Shared Package)

**Description**: Reusable interface element from shadcn/ui library, exported from `@repo/ui` package.

**Attributes**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Component name (e.g., "Button", "Card") |
| `props` | `object` | No | Component-specific props |
| `variants` | `object` | No | Style variants (via class-variance-authority) |

**Used Components** (to be migrated to `packages/ui`):
- Button
- Card
- Dialog
- Input
- Label
- Select
- Separator
- Tabs
- Avatar
- Badge
- Dropdown Menu
- Popover
- Scroll Area
- Toast (Sonner)
- [Others determined during migration]

**TypeScript Interface** (example):
```typescript
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}
```

### Game Feature Component

**Description**: Game-specific component migrated from `code_from_figma_make`.

**Components**:

**LandingPage**:
- Props: `{ onCreateGame: (name: string) => void, onJoinGame: (name: string, id: string) => void }`
- State: Form inputs (player name, game ID)
- Renders: Landing UI with create/join options

**GameRoom**:
- Props: `{ gameId: string, playerName: string, onLeaveGame: () => void }`
- State: None (stateless, delegates to children)
- Renders: Game room layout with child components

**CardScanner**:
- Props: TBD (determined during migration)
- State: Scanner state
- Renders: Card recognition interface

**GameBoard**:
- Props: TBD
- State: Board state
- Renders: Game board visualization

**PlayerStats**:
- Props: TBD
- State: Player statistics
- Renders: Stats display

**VideoPanel**:
- Props: TBD
- State: Video connection state
- Renders: Video feed

**TurnTracker**:
- Props: TBD
- State: Turn state
- Renders: Turn indicator

## Relationships

```
┌─────────────────┐
│  Game Session   │
│  (Session       │
│   Storage)      │
└────────┬────────┘
         │
         │ persists state for
         │
         ▼
┌─────────────────┐
│   Route         │
│  (/game/:id)    │
└────────┬────────┘
         │
         │ renders
         │
         ▼
┌─────────────────┐
│   GameRoom      │
│  Component      │
└────────┬────────┘
         │
         │ contains
         │
         ▼
┌─────────────────────────────────────────┐
│  Game Feature Components                │
│  (CardScanner, GameBoard, PlayerStats,  │
│   VideoPanel, TurnTracker)              │
└────────┬────────────────────────────────┘
         │
         │ uses
         │
         ▼
┌─────────────────┐
│  UI Components  │
│  (@repo/ui)     │
└─────────────────┘
```

## Data Flow

### Create Game Flow

```
User Input (name)
    ↓
LandingPage.onCreateGame(name)
    ↓
Generate gameId
    ↓
Save to Session Storage { gameId, playerName, timestamp }
    ↓
Navigate to /game/:gameId
    ↓
GameRoom renders with gameId from URL params
```

### Join Game Flow

```
User Input (name, gameId)
    ↓
LandingPage.onJoinGame(name, gameId)
    ↓
Save to Session Storage { gameId, playerName, timestamp }
    ↓
Navigate to /game/:gameId
    ↓
GameRoom renders with gameId from URL params
```

### Leave Game Flow

```
User clicks "Leave Game"
    ↓
GameRoom.onLeaveGame()
    ↓
Clear Session Storage
    ↓
Navigate to /
    ↓
LandingPage renders
```

### Page Refresh Flow

```
User refreshes page
    ↓
Check Session Storage for gameState
    ↓
If found: Navigate to /game/:gameId
If not found: Stay on current route or redirect to /
```

## Validation

### Session Storage Validation

```typescript
function validateGameState(data: unknown): GameState | null {
  if (!data || typeof data !== 'object') return null
  
  const state = data as Partial<GameState>
  
  if (!state.gameId || typeof state.gameId !== 'string') return null
  if (!state.playerName || typeof state.playerName !== 'string') return null
  if (!state.timestamp || typeof state.timestamp !== 'number') return null
  
  // Validate gameId format
  if (!/^game-[a-z0-9]{9}$/.test(state.gameId)) return null
  
  // Validate playerName length
  if (state.playerName.length < 1 || state.playerName.length > 50) return null
  
  // Validate timestamp is reasonable (not in future, not too old)
  const now = Date.now()
  if (state.timestamp > now || state.timestamp < now - 24 * 60 * 60 * 1000) {
    return null // Reject if in future or older than 24 hours
  }
  
  return state as GameState
}
```

### Route Parameter Validation

```typescript
function validateGameId(gameId: string): boolean {
  return /^game-[a-z0-9]{9}$/.test(gameId)
}
```

## Error Handling

### Invalid Session Data

**Scenario**: Session storage contains corrupted or invalid data

**Handling**:
1. Validation fails
2. Clear invalid data from session storage
3. Redirect to landing page
4. Show toast notification: "Session expired, please create or join a game"

### Missing Route Parameters

**Scenario**: User navigates to `/game/` without gameId

**Handling**:
1. TanStack Router shows 404 (no matching route)
2. Error boundary catches
3. Show error message with link to landing page

### Session Expired

**Scenario**: Session data is older than 24 hours

**Handling**:
1. Validation fails (timestamp check)
2. Clear expired data
3. Redirect to landing page
4. Show toast: "Session expired"

## Migration Notes

### Data Preservation

- No existing data to migrate (new feature)
- Session storage is ephemeral (cleared on browser close)
- No database or persistent storage required

### Backward Compatibility

- Existing routes moved to `/prev` namespace
- No breaking changes to existing functionality
- New routes are additive

## Summary

The data model is intentionally simple:
- Single entity (Game Session) persisted in session storage
- Routes are configuration, not data
- Components are stateless where possible
- Validation is defensive (fail gracefully)
- No backend dependencies

This aligns with Constitution Principle I (Browser-First Architecture) and Principle VI (Performance Through Optimization, Not Complexity).

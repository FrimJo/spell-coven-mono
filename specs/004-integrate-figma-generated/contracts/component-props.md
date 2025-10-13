# Component Props Contract

**Version**: 1.0  
**Last Updated**: 2025-10-13  
**Producer**: `apps/web/src/components/*.tsx`  
**Consumer**: `apps/web/src/routes/*.tsx`

## Overview

This contract defines the TypeScript interfaces for component props in the migrated Figma UI. All components use strict TypeScript typing with no `any` types.

## Game Components

### LandingPage

**Description**: Landing page with create/join game options

**Props Interface**:
```typescript
interface LandingPageProps {
  onCreateGame: (playerName: string) => void
  onJoinGame: (playerName: string, gameId: string) => void
}
```

**Prop Descriptions**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onCreateGame` | `(playerName: string) => void` | Yes | Callback when user creates a new game |
| `onJoinGame` | `(playerName: string, gameId: string) => void` | Yes | Callback when user joins existing game |

**Validation**:
- `playerName` must be non-empty (validated in component)
- `gameId` must match pattern `/^game-[a-z0-9]{9}$/` (validated in component)

**Usage Example**:
```typescript
<LandingPage
  onCreateGame={(name) => {
    const gameId = generateGameId()
    sessionStorage.saveGameState({ gameId, playerName: name, timestamp: Date.now() })
    navigate({ to: '/game/$gameId', params: { gameId } })
  }}
  onJoinGame={(name, id) => {
    sessionStorage.saveGameState({ gameId: id, playerName: name, timestamp: Date.now() })
    navigate({ to: '/game/$gameId', params: { gameId: id } })
  }}
/>
```

### GameRoom

**Description**: Game room container with all game features

**Props Interface**:
```typescript
interface GameRoomProps {
  gameId: string
  playerName: string
  onLeaveGame: () => void
}
```

**Prop Descriptions**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `gameId` | `string` | Yes | Unique identifier for the game session |
| `playerName` | `string` | Yes | Display name of the current player |
| `onLeaveGame` | `() => void` | Yes | Callback when user leaves the game |

**Validation**:
- `gameId` must match pattern `/^game-[a-z0-9]{9}$/`
- `playerName` must be 1-50 characters

**Usage Example**:
```typescript
<GameRoom
  gameId="game-a1b2c3d4e"
  playerName="Alice"
  onLeaveGame={() => {
    sessionStorage.clearGameState()
    navigate({ to: '/' })
  }}
/>
```

### CardScanner

**Description**: Card recognition interface component

**Props Interface**:
```typescript
interface CardScannerProps {
  // Props TBD - determined during migration
  // Likely includes:
  // - onCardDetected?: (cardData: CardData) => void
  // - isActive?: boolean
}
```

**Status**: Props to be finalized during implementation based on actual component needs.

### GameBoard

**Description**: Game board visualization component

**Props Interface**:
```typescript
interface GameBoardProps {
  // Props TBD - determined during migration
  // Likely includes:
  // - gameState?: GameBoardState
  // - onCardPlayed?: (card: Card, zone: Zone) => void
}
```

**Status**: Props to be finalized during implementation based on actual component needs.

### PlayerStats

**Description**: Player statistics display component

**Props Interface**:
```typescript
interface PlayerStatsProps {
  // Props TBD - determined during migration
  // Likely includes:
  // - playerName: string
  // - lifeTotal?: number
  // - cardCounts?: { hand: number, library: number, graveyard: number }
}
```

**Status**: Props to be finalized during implementation based on actual component needs.

### VideoPanel

**Description**: Video communication panel component

**Props Interface**:
```typescript
interface VideoPanelProps {
  // Props TBD - determined during migration
  // Likely includes:
  // - localStream?: MediaStream
  // - remoteStreams?: MediaStream[]
  // - onToggleVideo?: () => void
  // - onToggleAudio?: () => void
}
```

**Status**: Props to be finalized during implementation based on actual component needs.

### TurnTracker

**Description**: Turn and phase tracking component

**Props Interface**:
```typescript
interface TurnTrackerProps {
  // Props TBD - determined during migration
  // Likely includes:
  // - currentPlayer: string
  // - currentPhase: Phase
  // - onNextPhase?: () => void
}
```

**Status**: Props to be finalized during implementation based on actual component needs.

## Shared UI Components (from @repo/ui)

### Button

**Props Interface** (from shadcn/ui):
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}
```

**Usage Example**:
```typescript
<Button variant="default" size="lg" onClick={handleClick}>
  Create Game
</Button>
```

### Card

**Props Interface** (from shadcn/ui):
```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
```

**Usage Example**:
```typescript
<Card>
  <CardHeader>
    <CardTitle>Game Room</CardTitle>
    <CardDescription>Game ID: {gameId}</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Dialog

**Props Interface** (from shadcn/ui):
```typescript
interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
```

**Usage Example**:
```typescript
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>Are you sure?</DialogDescription>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

### Input

**Props Interface** (from shadcn/ui):
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
```

**Usage Example**:
```typescript
<Input
  type="text"
  placeholder="Enter your name"
  value={playerName}
  onChange={(e) => setPlayerName(e.target.value)}
/>
```

### Label

**Props Interface** (from shadcn/ui):
```typescript
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}
```

**Usage Example**:
```typescript
<Label htmlFor="playerName">Player Name</Label>
<Input id="playerName" />
```

## Error Boundary Props

### ErrorFallback

**Props Interface**:
```typescript
interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}
```

**Prop Descriptions**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `error` | `Error` | Yes | The error that was caught |
| `resetErrorBoundary` | `() => void` | Yes | Function to reset the error boundary |

**Usage Example**:
```typescript
function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-gray-600">{error.message}</p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  )
}
```

## Type Safety Rules

### No `any` Types

**Rule**: All props must have explicit types. No `any` types allowed.

**Enforcement**: TypeScript strict mode enabled in `tsconfig.json`

### Required vs Optional Props

**Convention**:
- Required props: No `?` suffix
- Optional props: `?` suffix
- Default values: Defined in component with destructuring

**Example**:
```typescript
interface MyComponentProps {
  required: string        // Required
  optional?: number      // Optional
  withDefault?: boolean  // Optional with default
}

function MyComponent({ 
  required, 
  optional, 
  withDefault = false 
}: MyComponentProps) {
  // ...
}
```

### Event Handler Naming

**Convention**: Event handlers use `on` prefix

**Examples**:
- `onClick`
- `onChange`
- `onSubmit`
- `onCreateGame`
- `onLeaveGame`

### Children Prop

**Convention**: Use `React.ReactNode` for children

```typescript
interface ContainerProps {
  children: React.ReactNode
}
```

## Validation Contract

### Runtime Validation

**When**: Props are validated at runtime in development mode only

**How**: Using TypeScript + React PropTypes (if needed)

**Example**:
```typescript
function LandingPage({ onCreateGame, onJoinGame }: LandingPageProps) {
  const handleCreate = (name: string) => {
    if (!name.trim()) {
      throw new Error('Player name cannot be empty')
    }
    onCreateGame(name)
  }
  
  const handleJoin = (name: string, id: string) => {
    if (!name.trim()) {
      throw new Error('Player name cannot be empty')
    }
    if (!/^game-[a-z0-9]{9}$/.test(id)) {
      throw new Error('Invalid game ID format')
    }
    onJoinGame(name, id)
  }
  
  // ...
}
```

## Migration Notes

### From Figma Code

**Before** (Figma-generated):
```typescript
// Potentially loose typing
function LandingPage(props: any) {
  // ...
}
```

**After** (Strict typing):
```typescript
interface LandingPageProps {
  onCreateGame: (playerName: string) => void
  onJoinGame: (playerName: string, gameId: string) => void
}

function LandingPage({ onCreateGame, onJoinGame }: LandingPageProps) {
  // ...
}
```

### Component Exports

**Convention**: Named exports for components

```typescript
// ✅ Correct
export function LandingPage(props: LandingPageProps) { }

// ❌ Avoid
export default function LandingPage(props: LandingPageProps) { }
```

**Rationale**: Named exports are easier to refactor and provide better IDE support.

## Testing Contract

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  it('calls onCreateGame with player name', () => {
    const mockCreate = vi.fn()
    const mockJoin = vi.fn()
    
    render(<LandingPage onCreateGame={mockCreate} onJoinGame={mockJoin} />)
    
    fireEvent.change(screen.getByPlaceholderText('Enter your name'), {
      target: { value: 'Alice' }
    })
    fireEvent.click(screen.getByText('Create Game'))
    
    expect(mockCreate).toHaveBeenCalledWith('Alice')
  })
})
```

## References

- shadcn/ui Documentation: https://ui.shadcn.com/
- Radix UI Primitives: https://www.radix-ui.com/primitives
- React TypeScript Cheatsheet: https://react-typescript-cheatsheet.netlify.app/
- Specification: `specs/004-integrate-figma-generated/spec.md`
- Data Model: `specs/004-integrate-figma-generated/data-model.md`

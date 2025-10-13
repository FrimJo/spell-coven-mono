# Session Storage Contract

**Version**: 1.0  
**Last Updated**: 2025-10-13  
**Producer**: `apps/web/src/lib/session-storage.ts`  
**Consumer**: `apps/web/src/routes/*.tsx`

## Overview

This contract defines the structure and behavior of game state persistence in browser session storage. The data is stored as a JSON string and automatically cleared when the browser session ends.

## Storage Key

**Key**: `spell-coven:game-state`

**Rationale**: Namespaced to avoid conflicts with other applications or libraries.

## Data Format

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["gameId", "playerName", "timestamp"],
  "properties": {
    "gameId": {
      "type": "string",
      "pattern": "^game-[a-z0-9]{9}$",
      "description": "Unique identifier for the game session"
    },
    "playerName": {
      "type": "string",
      "minLength": 1,
      "maxLength": 50,
      "description": "Display name of the current player"
    },
    "timestamp": {
      "type": "number",
      "minimum": 0,
      "description": "Unix timestamp (milliseconds) when session was created"
    }
  },
  "additionalProperties": false
}
```

### TypeScript Interface

```typescript
interface GameState {
  gameId: string
  playerName: string
  timestamp: number
}
```

### Example Data

```json
{
  "gameId": "game-a1b2c3d4e",
  "playerName": "Alice",
  "timestamp": 1697234567890
}
```

## API Contract

### Save Game State

**Function**: `sessionStorage.saveGameState(state: GameState): void`

**Preconditions**:
- `state.gameId` matches pattern `/^game-[a-z0-9]{9}$/`
- `state.playerName` is 1-50 characters
- `state.timestamp` is valid Unix timestamp

**Postconditions**:
- Data is serialized to JSON
- Stored in session storage under key `spell-coven:game-state`
- Throws error if serialization fails

**Error Handling**:
- Invalid state: Throws `TypeError` with validation message
- Storage quota exceeded: Throws `QuotaExceededError`
- Storage disabled: Throws `SecurityError`

**Example**:
```typescript
sessionStorage.saveGameState({
  gameId: 'game-a1b2c3d4e',
  playerName: 'Alice',
  timestamp: Date.now()
})
```

### Load Game State

**Function**: `sessionStorage.loadGameState(): GameState | null`

**Preconditions**: None

**Postconditions**:
- Returns `GameState` if valid data exists
- Returns `null` if no data, invalid data, or expired data
- Never throws (defensive)

**Validation**:
1. Check if key exists
2. Parse JSON (catch parse errors)
3. Validate schema (type checks)
4. Validate gameId pattern
5. Validate playerName length
6. Validate timestamp (not in future, not older than 24 hours)

**Error Handling**:
- Missing key: Returns `null`
- Invalid JSON: Returns `null` (silent failure)
- Schema mismatch: Returns `null`
- Expired timestamp: Returns `null`

**Example**:
```typescript
const state = sessionStorage.loadGameState()
if (state) {
  console.log(`Resuming game ${state.gameId} for ${state.playerName}`)
} else {
  console.log('No active session')
}
```

### Clear Game State

**Function**: `sessionStorage.clearGameState(): void`

**Preconditions**: None

**Postconditions**:
- Key `spell-coven:game-state` is removed from session storage
- Never throws (defensive)

**Error Handling**:
- Storage disabled: Silent failure (no-op)

**Example**:
```typescript
sessionStorage.clearGameState()
```

## Validation Rules

### GameId Validation

**Pattern**: `/^game-[a-z0-9]{9}$/`

**Valid Examples**:
- `game-a1b2c3d4e`
- `game-xyz123abc`
- `game-000000000`

**Invalid Examples**:
- `game-` (too short)
- `game-ABC123` (uppercase not allowed)
- `game-a1b2c3d4e5` (too long)
- `custom-id` (wrong prefix)

### PlayerName Validation

**Rules**:
- Minimum length: 1 character
- Maximum length: 50 characters
- No restrictions on character set (supports Unicode)

**Valid Examples**:
- `Alice`
- `Player 1`
- `José`
- `玩家` (Chinese characters)

**Invalid Examples**:
- `` (empty string)
- `This is a very long player name that exceeds the fifty character limit` (>50 chars)

### Timestamp Validation

**Rules**:
- Must be positive number
- Must not be in the future (> `Date.now()`)
- Must not be older than 24 hours (< `Date.now() - 86400000`)

**Rationale**: Sessions older than 24 hours are considered expired and invalid.

## Error Messages

### Validation Errors

**Invalid gameId**:
```
Error: Invalid gameId format. Expected pattern: game-[a-z0-9]{9}
```

**Invalid playerName**:
```
Error: Player name must be 1-50 characters. Got: <length>
```

**Expired timestamp**:
```
Error: Session expired. Timestamp is older than 24 hours.
```

**Future timestamp**:
```
Error: Invalid timestamp. Cannot be in the future.
```

### Storage Errors

**Quota exceeded**:
```
Error: Session storage quota exceeded. Unable to save game state.
```

**Storage disabled**:
```
Error: Session storage is disabled. Please enable cookies and storage in browser settings.
```

## Compatibility Matrix

| Browser | Session Storage Support | Notes |
|---------|------------------------|-------|
| Chrome 90+ | ✅ Full support | - |
| Firefox 88+ | ✅ Full support | - |
| Safari 14+ | ✅ Full support | - |
| Edge 90+ | ✅ Full support | - |
| IE 11 | ❌ Not supported | Out of scope |

## Migration Guide

### From No Persistence (Current)

**Before**:
```typescript
// State only in React component
const [gameId, setGameId] = useState<string | null>(null)
const [playerName, setPlayerName] = useState<string>('')
```

**After**:
```typescript
// State persisted in session storage
const [gameId, setGameId] = useState<string | null>(() => {
  const state = sessionStorage.loadGameState()
  return state?.gameId ?? null
})

useEffect(() => {
  if (gameId && playerName) {
    sessionStorage.saveGameState({
      gameId,
      playerName,
      timestamp: Date.now()
    })
  }
}, [gameId, playerName])
```

## Performance Characteristics

**Storage Size**:
- Typical: ~100 bytes per session
- Maximum: ~200 bytes (with long player name)

**Operation Times**:
- Save: <1ms (synchronous)
- Load: <1ms (synchronous)
- Clear: <1ms (synchronous)

**Storage Limits**:
- Session Storage: ~5-10MB per origin (browser-dependent)
- This feature: <1KB total

## Security Considerations

### Data Privacy

- Data is stored client-side only
- Never transmitted to server
- Cleared on browser close
- Not accessible to other origins (same-origin policy)

### XSS Protection

- Data is JSON (no executable code)
- Validated on load (defensive)
- No innerHTML or eval() usage

### Data Integrity

- Schema validation on load
- Type checking with TypeScript
- Defensive error handling

## Testing Contract

### Unit Tests

```typescript
describe('sessionStorage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('saves and loads valid game state', () => {
    const state: GameState = {
      gameId: 'game-test12345',
      playerName: 'TestPlayer',
      timestamp: Date.now()
    }
    
    sessionStorage.saveGameState(state)
    const loaded = sessionStorage.loadGameState()
    
    expect(loaded).toEqual(state)
  })

  it('returns null for invalid gameId', () => {
    window.sessionStorage.setItem('spell-coven:game-state', JSON.stringify({
      gameId: 'invalid',
      playerName: 'Test',
      timestamp: Date.now()
    }))
    
    expect(sessionStorage.loadGameState()).toBeNull()
  })

  it('returns null for expired timestamp', () => {
    const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
    window.sessionStorage.setItem('spell-coven:game-state', JSON.stringify({
      gameId: 'game-test12345',
      playerName: 'Test',
      timestamp: expiredTimestamp
    }))
    
    expect(sessionStorage.loadGameState()).toBeNull()
  })

  it('clears game state', () => {
    sessionStorage.saveGameState({
      gameId: 'game-test12345',
      playerName: 'Test',
      timestamp: Date.now()
    })
    
    sessionStorage.clearGameState()
    
    expect(sessionStorage.loadGameState()).toBeNull()
  })
})
```

## References

- MDN: [Window.sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
- Specification: `specs/004-integrate-figma-generated/spec.md`
- Data Model: `specs/004-integrate-figma-generated/data-model.md`

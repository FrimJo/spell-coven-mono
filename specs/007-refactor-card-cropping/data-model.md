# Data Model: Card Cropping and Image Database Query Integration

**Feature**: 007-refactor-card-cropping  
**Date**: 2025-10-15  
**Phase**: 1 - Design & Contracts

## Overview

This document defines the data structures, state machines, and type contracts for the card identification feature. All types are TypeScript-based and follow existing patterns in the monorepo.

## Core Entities

### CardQueryResult

Represents the result of a card identification query, including metadata and similarity score.

**Fields**:
- `name: string` - Card name (e.g., "Lightning Bolt")
- `set: string` - Set code (e.g., "LEA", "M21")
- `score: number` - Cosine similarity score (0.0 to 1.0)
- `scryfall_uri?: string` - Optional link to Scryfall card page
- `image_url?: string` - Optional URL to card art crop image
- `card_url?: string` - Optional URL to full card image

**Validation Rules**:
- `name` and `set` are required (from meta.json)
- `score` must be between 0.0 and 1.0
- URLs must be valid HTTP/HTTPS if present

**Source**: Returned by `top1()` function from `@/lib/search`

**Example**:
```typescript
{
  name: "Lightning Bolt",
  set: "LEA",
  score: 0.8542,
  scryfall_uri: "https://scryfall.com/card/lea/161/lightning-bolt",
  image_url: "https://cards.scryfall.io/art_crop/front/...",
  card_url: "https://cards.scryfall.io/normal/front/..."
}
```

### CardQueryState

Represents the current state of a card identification query operation.

**Fields**:
- `status: 'idle' | 'querying' | 'success' | 'error'` - Query lifecycle state
- `result: CardQueryResult | null` - Query result (present when status is 'success')
- `error: string | null` - Error message (present when status is 'error')
- `croppedImageBase64: string | null` - Base64 data URL of cropped canvas for debugging

**State Transitions**:
```
idle → querying → success
  ↓       ↓          ↓
  └───────┴──────→ error
         ↓
       idle (on cancel)
```

**Validation Rules**:
- `result` must be null unless status is 'success'
- `error` must be null unless status is 'error'
- `croppedImageBase64` is set during query, persists across states for debugging

**Example**:
```typescript
// Success state
{
  status: 'success',
  result: { name: "Lightning Bolt", set: "LEA", score: 0.85, ... },
  error: null,
  croppedImageBase64: "data:image/png;base64,iVBORw0KG..."
}

// Error state
{
  status: 'error',
  result: null,
  error: "Failed to embed canvas: Invalid image data",
  croppedImageBase64: "data:image/png;base64,iVBORw0KG..."
}
```

### ModelLoadingState

Represents the state of CLIP model and embeddings initialization.

**Fields**:
- `isLoading: boolean` - Whether model/embeddings are currently loading
- `progress: string` - Progress message (e.g., "Loading embeddings...", "Downloading CLIP model...")
- `isReady: boolean` - Whether system is ready for queries

**State Transitions**:
```
{ isLoading: true, progress: "Loading embeddings...", isReady: false }
  ↓
{ isLoading: true, progress: "Downloading CLIP model...", isReady: false }
  ↓
{ isLoading: false, progress: "", isReady: true }
```

**Validation Rules**:
- `isReady` can only be true when `isLoading` is false
- `progress` should be empty string when not loading

### CroppedCardData

Represents a cropped card image ready for querying.

**Fields**:
- `canvas: HTMLCanvasElement` - Canvas containing cropped card (446x620px)
- `timestamp: number` - When the crop was created (for cancellation tracking)
- `hasData: boolean` - Whether canvas contains non-empty image data

**Validation Rules**:
- Canvas dimensions must be 446x620 pixels
- `hasData` must be validated by checking canvas pixel data
- Canvas must not be empty (all pixels zero)

**Lifecycle**: Created on card click, consumed by query operation, discarded after query completes

## State Machines

### Query Lifecycle State Machine

```
┌─────┐
│ idle│◄─────────────────────────┐
└──┬──┘                           │
   │ query(canvas)                │
   ▼                              │
┌──────────┐                      │
│ querying │──────cancel()────────┤
└────┬─────┘                      │
     │                            │
     ├─ embedFromCanvas()         │
     │  success                   │
     ▼                            │
┌─────────┐                       │
│ success │───────────────────────┤
└─────────┘                       │
     │                            │
     ├─ embedFromCanvas()         │
     │  failure                   │
     ▼                            │
┌───────┐                         │
│ error │─────────────────────────┘
└───────┘
```

**Transitions**:
- `idle → querying`: User clicks detected card, `query()` called with canvas
- `querying → success`: Embedding and search complete successfully
- `querying → error`: Embedding fails or search throws exception
- `querying → idle`: New query cancels pending operation
- `success → idle`: New query replaces previous result
- `error → idle`: New query clears error state

**Invariants**:
- Only one query can be in 'querying' state at a time
- Cancellation must clean up pending async operations
- State transitions are atomic (no partial updates)

### Model Loading State Machine

```
┌──────────┐
│ unloaded │
└────┬─────┘
     │ mount GameRoom
     ▼
┌─────────────────┐
│ loading         │
│ (embeddings)    │
└────┬────────────┘
     │ loadEmbeddingsAndMeta() complete
     ▼
┌─────────────────┐
│ loading         │
│ (CLIP model)    │
└────┬────────────┘
     │ loadModel() complete
     ▼
┌───────┐
│ ready │
└───────┘
```

**Transitions**:
- `unloaded → loading(embeddings)`: GameRoom mounts, initialization starts
- `loading(embeddings) → loading(model)`: Embeddings loaded, model download begins
- `loading(model) → ready`: Model loaded, queries can proceed

**Error Handling**: If loading fails, show error in loading overlay with retry option

## Type Contracts

See `contracts/card-query.ts` for TypeScript interface definitions.

## Data Flow

### Card Identification Flow

```
User clicks detected card
  ↓
VideoStreamGrid captures click coordinates
  ↓
useWebcam.getCroppedCanvas() → HTMLCanvasElement (446x620px)
  ↓
Canvas passed to GameRoom via onCardCrop callback
  ↓
useCardQuery.query(canvas) called
  ↓
├─ Cancel any pending query (AbortController)
├─ Validate canvas has image data
├─ Convert canvas to base64, log to console
├─ Set state to 'querying'
  ↓
embedFromCanvas(canvas) → Float32Array(512)
  ↓
top1(embedding) → CardQueryResult
  ↓
Set state to 'success' with result
  ↓
CardResultDisplay renders result
  ↓
card-result component shows card info
  ↓
If score < 0.70, show low confidence warning
```

### Error Flow

```
Query operation fails
  ↓
Catch exception
  ↓
Set state to 'error' with message
  ↓
CardResultDisplay renders error
  ↓
inline-message component shows error
```

### Cancellation Flow

```
New query starts while previous querying
  ↓
AbortController.abort() called
  ↓
Pending embedFromCanvas() operation cancelled
  ↓
Previous query state cleared
  ↓
New query proceeds
```

## Validation Rules

### Canvas Validation

Before querying, validate:
1. Canvas dimensions are 446x620 pixels
2. Canvas context is accessible (getContext('2d') succeeds)
3. Canvas contains non-zero pixel data (at least one non-zero value in ImageData)

**Implementation**:
```typescript
function validateCanvas(canvas: HTMLCanvasElement): boolean {
  if (canvas.width !== 446 || canvas.height !== 620) return false
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return imageData.data.some(pixel => pixel !== 0)
}
```

### Query Result Validation

Validate results from `top1()`:
1. `name` is non-empty string
2. `set` is non-empty string
3. `score` is number between 0.0 and 1.0
4. Optional URLs are valid if present

### Low Confidence Detection

```typescript
function isLowConfidence(score: number): boolean {
  return score < 0.70
}
```

## Relationships

### Component → State Relationships

- **GameRoom**: Owns ModelLoadingState, passes query callback to VideoStreamGrid
- **CardResultDisplay**: Owns CardQueryState via useCardQuery hook
- **VideoStreamGrid**: Produces CroppedCardData, triggers queries
- **card-result**: Consumes CardQueryResult (presentational)
- **inline-message**: Consumes error strings (presentational)
- **loading-overlay**: Consumes ModelLoadingState (presentational)

### Data Dependencies

```
meta.json + embeddings.i8bin (pre-loaded)
  ↓
@/lib/search (embedFromCanvas, top1)
  ↓
useCardQuery hook
  ↓
CardQueryState
  ↓
CardResultDisplay component
  ↓
card-result / inline-message components
```

## Performance Considerations

### Memory Management

- **Canvas lifecycle**: Created on click, referenced during query, eligible for GC after query completes
- **Base64 strings**: Stored in state for debugging, cleared on new query (prevents memory leak)
- **Query results**: Single result stored (previous result replaced), no history accumulation

### Computation Optimization

- **Query cancellation**: Prevents wasted computation on rapid clicks
- **Canvas validation**: Fast pixel check before expensive embedding operation
- **Lazy model loading**: One-time initialization, cached in browser IndexedDB

### State Update Batching

- Use React's automatic batching for state updates
- Single setState call per query lifecycle transition
- No intermediate state updates during async operations

## Testing Considerations

### Unit Test Scenarios

1. **Canvas validation**: Empty canvas, wrong dimensions, valid canvas
2. **State transitions**: All valid transitions in state machine
3. **Query cancellation**: Rapid successive queries
4. **Low confidence detection**: Scores above/below 0.70 threshold
5. **Error handling**: Various failure modes (invalid canvas, embedding failure, etc.)

### Integration Test Scenarios

1. **End-to-end query**: Click card → see result
2. **Model loading**: Mount GameRoom → loading overlay → ready state
3. **Error recovery**: Trigger error → new query clears error
4. **Cancellation**: Start query → click different card → see latest result

### Contract Test Scenarios

1. **CardQueryResult schema**: Validate against meta.json format
2. **Type safety**: Ensure TypeScript types match runtime data
3. **State invariants**: Verify state machine constraints hold

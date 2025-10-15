# Quickstart: Card Cropping and Image Database Query Integration

**Feature**: 007-refactor-card-cropping  
**Date**: 2025-10-15  
**For**: Developers implementing this feature

## Overview

This guide helps you implement the card identification feature in the game room. You'll integrate card cropping and image database querying so players can click detected cards in video streams and see identification results.

## Prerequisites

- Familiarity with React 18 and TypeScript
- Understanding of React hooks (useState, useEffect, useCallback)
- Basic knowledge of HTML Canvas API
- Existing prototype at `/apps/web/src/routes/prev/index.tsx` for reference

## Quick Start (5 minutes)

### 1. Review Existing Implementation

Start by examining the working prototype:

```bash
# View the prototype implementation
open apps/web/src/routes/prev/index.tsx
```

Key functions to understand:
- `handleSearchCropped()` - Query logic (lines 86-120)
- `getCroppedCanvas()` - From useWebcam hook
- `embedFromCanvas()` and `top1()` - From @/lib/search

### 2. Understand the Data Flow

```
User clicks detected card
  ↓
VideoStreamGrid.onCardCrop(canvas)
  ↓
GameRoom receives canvas
  ↓
useCardQuery.query(canvas)
  ↓
embedFromCanvas() → top1()
  ↓
CardResultDisplay shows result
```

### 3. Check Type Contracts

```bash
# Review the type definitions
open specs/007-refactor-card-cropping/contracts/card-query.ts
```

All interfaces are defined here. Import what you need.

## Implementation Steps

### Phase 1: Create UI Components (packages/ui)

#### Step 1.1: Create card-result component

```bash
cd packages/ui/src/components
# Use shadcn to scaffold the component
```

**Purpose**: Display successful query results with card info

**Props**: `CardResultProps` from contracts

**Features**:
- Show card name, set, score (3 decimals)
- Display card image if available
- Link to Scryfall
- Low confidence warning if score < 0.70

#### Step 1.2: Create inline-message component

**Purpose**: Show errors and warnings inline

**Props**: `InlineMessageProps` from contracts

**Variants**: error, warning, info

#### Step 1.3: Create loading-overlay component

**Purpose**: Whole-page loading during model initialization

**Props**: `LoadingOverlayProps` from contracts

**Features**:
- Blocks all interaction when visible
- Shows progress message
- Centered spinner/loading animation

### Phase 2: Create Custom Hook (apps/web)

#### Step 2.1: Create useCardQuery hook

```bash
cd apps/web/src/hooks
touch useCardQuery.ts
```

**Purpose**: Manage card query state and lifecycle

**API**:
```typescript
const { state, query, cancel } = useCardQuery()

// Start query
await query(canvas)

// Cancel pending query
cancel()

// Access state
state.status // 'idle' | 'querying' | 'success' | 'error'
state.result // CardQueryResult | null
state.error // string | null
```

**Implementation checklist**:
- [ ] Use AbortController for cancellation
- [ ] Validate canvas before querying
- [ ] Convert canvas to base64 and log to console
- [ ] Call embedFromCanvas() and top1()
- [ ] Handle errors gracefully
- [ ] Update state atomically

**Reference**: Extract logic from `/prev/index.tsx` lines 86-120

### Phase 3: Create Container Component (apps/web)

#### Step 3.1: Create CardResultDisplay component

```bash
cd apps/web/src/components
touch CardResultDisplay.tsx
```

**Purpose**: Container for query UI in game room

**Responsibilities**:
- Use useCardQuery hook
- Render card-result on success
- Render inline-message on error
- Handle loading state

**Props**: None (self-contained)

### Phase 4: Integrate into GameRoom

#### Step 4.1: Add model loading state

In `GameRoom.tsx`:

```typescript
const [modelLoading, setModelLoading] = useState<ModelLoadingState>({
  isLoading: true,
  progress: '',
  isReady: false
})

useEffect(() => {
  async function initModel() {
    setModelLoading({ isLoading: true, progress: 'Loading embeddings...', isReady: false })
    await loadEmbeddingsAndMetaFromPackage()
    
    setModelLoading({ isLoading: true, progress: 'Downloading CLIP model...', isReady: false })
    await loadModel({
      onProgress: (msg) => setModelLoading(prev => ({ ...prev, progress: msg }))
    })
    
    setModelLoading({ isLoading: false, progress: '', isReady: true })
  }
  
  initModel().catch(console.error)
}, [])
```

#### Step 4.2: Add CardResultDisplay to layout

In `GameRoom.tsx`, modify left sidebar:

```tsx
<div className="w-64 flex-shrink-0 space-y-4 overflow-y-auto">
  <TurnTracker players={players} onNextTurn={handleNextTurn} />
  <PlayerList
    players={players}
    isLobbyOwner={isLobbyOwner}
    localPlayerName={playerName}
    onRemovePlayer={handleRemovePlayer}
  />
  {/* NEW: Add card result display */}
  <CardResultDisplay />
</div>
```

#### Step 4.3: Add loading overlay

```tsx
{modelLoading.isLoading && (
  <LoadingOverlay 
    isVisible={true}
    message={modelLoading.progress}
  />
)}
```

### Phase 5: Modify VideoStreamGrid

#### Step 5.1: Update onCardCrop callback

Current (placeholder):
```typescript
onCardCrop={() => {
  console.log('Card detected and cropped!')
}}
```

New (pass canvas):
```typescript
onCardCrop={(canvas: HTMLCanvasElement) => {
  // Canvas will be passed to CardResultDisplay via context or prop
}}
```

**Implementation options**:
1. **Context**: Create CardQueryContext to share query function
2. **Prop drilling**: Pass query function through VideoStreamGrid
3. **Event emitter**: Use custom event (not recommended)

**Recommended**: Context approach for clean prop flow

## Testing Strategy

### Unit Tests

```bash
cd apps/web
pnpm test src/hooks/useCardQuery.test.ts
```

Test scenarios:
- Canvas validation (empty, wrong dimensions, valid)
- State transitions (idle → querying → success)
- Query cancellation (rapid clicks)
- Error handling (invalid canvas, embedding failure)

### Integration Tests

```bash
pnpm test src/components/CardResultDisplay.test.tsx
```

Test scenarios:
- End-to-end query flow
- Low confidence warning display
- Error message display
- Loading state rendering

### Manual Testing

1. **Start dev server**:
   ```bash
   pnpm dev
   ```

2. **Open game room**: Navigate to game room with webcam enabled

3. **Test scenarios**:
   - Click detected card → see result below player list
   - Check console for base64 image
   - Try rapid clicks → only latest result shows
   - Test with poor card angle → see low confidence warning
   - Refresh page → see loading overlay

## Common Issues

### Issue: Canvas is empty

**Symptom**: "No valid card detected" error

**Solution**: Ensure card detection (green border) is active before clicking

### Issue: Query never completes

**Symptom**: Stuck in 'querying' state

**Solution**: Check console for errors, verify model is loaded

### Issue: Low confidence on good cards

**Symptom**: Score < 0.70 on clear card images

**Solution**: Verify canvas dimensions (446x620), check lighting/angle

### Issue: Model loading fails

**Symptom**: Loading overlay never disappears

**Solution**: Check network connection, verify embeddings.i8bin and meta.json are accessible

## Performance Tips

1. **Query cancellation**: Always cancel pending queries on new clicks
2. **Canvas validation**: Validate before expensive embedding operation
3. **Memoization**: Use useMemo for result rendering if needed
4. **Lazy loading**: Model loads once per session, cached in IndexedDB

## Debugging

### Enable verbose logging

```typescript
// In useCardQuery.ts
const DEBUG = true

if (DEBUG) {
  console.log('Query started:', { timestamp: Date.now() })
  console.log('Canvas dimensions:', canvas.width, canvas.height)
  console.log('Embedding result:', embedding)
  console.log('Query result:', result)
}
```

### View cropped images

All cropped images are logged as base64 to console:

```javascript
// In browser console
// 1. Copy the base64 string
// 2. Paste into address bar
// 3. Press Enter to view image
```

### Check model status

```javascript
// In browser console
console.log('Model ready:', window.__modelReady)
console.log('Embeddings loaded:', window.__embeddingsLoaded)
```

## Next Steps

After implementation:

1. **Run type checking**: `pnpm check-types`
2. **Run linting**: `pnpm lint`
3. **Run formatting**: `pnpm format`
4. **Test manually**: Follow testing strategy above
5. **Update documentation**: Add any learnings to this guide

## Resources

- **Specification**: `specs/007-refactor-card-cropping/spec.md`
- **Data Model**: `specs/007-refactor-card-cropping/data-model.md`
- **Type Contracts**: `specs/007-refactor-card-cropping/contracts/card-query.ts`
- **Prototype**: `apps/web/src/routes/prev/index.tsx`
- **Search Library**: `apps/web/src/lib/search.ts`
- **shadcn docs**: https://ui.shadcn.com/docs

## Questions?

Refer to:
- Clarifications section in spec.md (6 Q&As)
- Research document for technical decisions
- Constitution for architectural principles

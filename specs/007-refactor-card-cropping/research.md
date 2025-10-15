# Research: Card Cropping and Image Database Query Integration

**Feature**: 007-refactor-card-cropping  
**Date**: 2025-10-15  
**Phase**: 0 - Outline & Research

## Overview

This document consolidates research findings for integrating card cropping and image database query functionality into the main game room interface. All technical decisions are based on existing implementations in the prototype (`/prev` route) and established patterns in the monorepo.

## Research Areas

### 1. Card Cropping Implementation

**Decision**: Reuse existing `useWebcam` hook logic from prototype

**Rationale**:
- Prototype at `/prev/index.tsx` already implements working card cropping with perspective transformation
- Uses `getCroppedCanvas()` method that returns 446x620px normalized canvas
- OpenCV.js integration already handles quadrilateral detection and perspective correction
- No need to research alternatives - proven implementation exists

**Implementation Details**:
- Extract cropping logic from `handleSearchCropped` function (lines 86-120 in `/prev/index.tsx`)
- Reuse canvas validation (checks for non-empty image data)
- Maintain 446x620px output dimensions for consistency with training data

**Alternatives Considered**:
- Manual perspective transformation: Rejected - OpenCV.js provides optimized, battle-tested implementation
- Different canvas dimensions: Rejected - 446x620px matches CLIP model training expectations

### 2. Query State Management

**Decision**: Create custom `useCardQuery` hook with cancellation support

**Rationale**:
- Need to manage async query lifecycle (loading, success, error states)
- Requirement FR-011: Cancel pending queries when new click occurs
- React hooks pattern already established in codebase (`useWebcam`, etc.)
- Provides clean separation of concerns and reusability

**Implementation Pattern**:
```typescript
interface CardQueryState {
  isQuerying: boolean
  result: QueryResult | null
  error: string | null
  croppedImageBase64: string | null
}

function useCardQuery() {
  // AbortController for cancellation
  // State management for query lifecycle
  // Integration with embedFromCanvas and top1
  return { query, state, cancel }
}
```

**Alternatives Considered**:
- Direct state in GameRoom component: Rejected - violates separation of concerns, harder to test
- External state management (Zustand/Redux): Rejected - overkill for single-component feature
- React Query: Rejected - not needed for client-side-only operations

### 3. UI Component Architecture

**Decision**: Create shadcn-based components in `packages/ui`

**Rationale**:
- Design requirement DR-003: New components must be shadcn-based
- Requirement DR-002: Use existing `packages/ui` when available
- shadcn provides accessible, customizable components matching existing design
- Promotes reusability across monorepo

**Components to Create**:
1. **CardResultDisplay** (`apps/web/src/components/`):
   - Container component for game room integration
   - Manages query state via `useCardQuery` hook
   - Renders card-result, inline-message, or loading states

2. **card-result** (`packages/ui/src/components/`):
   - Presentational component for successful query results
   - Displays card name, set, score, image, Scryfall link
   - Handles low confidence warning (score < 0.70)

3. **loading-overlay** (`packages/ui/src/components/`):
   - Whole-page loading indicator for model initialization
   - Blocks interaction during CLIP model/embeddings load
   - Shows progress text from `loadModel` callback

4. **inline-message** (`packages/ui/src/components/`):
   - Error and warning messages in result area
   - Variants: error, warning, info
   - Consistent styling with existing design system

**Alternatives Considered**:
- Custom CSS components: Rejected - shadcn provides better accessibility and consistency
- Inline component definitions: Rejected - violates DR-003 requirement for reusable components

### 4. Loading State Management

**Decision**: Whole-page loading overlay during model initialization

**Rationale**:
- Clarification answer: "Whole page loading indicator"
- Prevents user interaction before system is ready (FR-012)
- Model loading is one-time per session, blocking is acceptable
- Matches existing loading patterns in application

**Implementation**:
- Show overlay on GameRoom mount
- Initialize model and embeddings in useEffect
- Hide overlay when both complete
- Display progress text from `loadModel({ onProgress })` callback

**Alternatives Considered**:
- Partial UI blocking: Rejected - user explicitly requested whole-page indicator
- Background loading with disabled buttons: Rejected - less clear user feedback

### 5. Error Handling Strategy

**Decision**: Inline error messages in result area below player list

**Rationale**:
- Clarification answer: "Inline in the result area below player list"
- Keeps errors contextual to the feature
- Non-intrusive - doesn't block gameplay
- Consistent with requirement FR-008

**Error Scenarios**:
1. **Empty crop**: "No valid card detected. Please try again."
2. **Query failure**: "Failed to identify card. Error: {message}"
3. **Low confidence** (score < 0.70): "Low confidence match. Try a clearer view."
4. **Model not loaded**: Prevented by whole-page loading overlay

**Alternatives Considered**:
- Toast notifications: Rejected - user explicitly chose inline messages
- Modal dialogs: Rejected - interrupts gameplay unnecessarily
- Console-only errors: Rejected - poor user experience

### 6. Debug Image Logging

**Decision**: Log cropped canvas as base64 data URL to console

**Rationale**:
- Clarification answer: "As base64 image in console"
- Requirement FR-006: Debug/troubleshooting support
- Non-intrusive - doesn't clutter UI
- Easy to inspect by copying URL to browser

**Implementation**:
```typescript
const base64 = canvas.toDataURL('image/png')
console.log('Cropped card image:', base64)
```

**Alternatives Considered**:
- UI preview component: Rejected - user explicitly chose console logging
- Download as file: Rejected - more friction for debugging
- No debug support: Rejected - violates FR-006

### 7. Integration with Existing Components

**Decision**: Minimal modifications to GameRoom and VideoStreamGrid

**Rationale**:
- Requirement NFR-004: No breaking changes to existing functionality
- Design requirement DR-004: Seamless integration with left sidebar
- Preserve existing player list and turn tracker layout

**Modifications Required**:
1. **GameRoom.tsx**:
   - Add `<CardResultDisplay />` below `<PlayerList />`
   - Initialize model/embeddings in useEffect
   - Manage whole-page loading overlay state

2. **VideoStreamGrid.tsx**:
   - Modify `onCardCrop` callback to pass cropped canvas
   - Trigger query when card is clicked (not just detected)
   - Pass canvas to parent via callback

**Alternatives Considered**:
- New sidebar section: Rejected - adds layout complexity
- Overlay on video stream: Rejected - obstructs gameplay view
- Separate page/modal: Rejected - breaks inline workflow

## Technology Stack Summary

**Confirmed Technologies** (no research needed):
- TypeScript 5.x
- React 18
- TanStack Router
- Transformers.js (CLIP model)
- OpenCV.js (card detection)
- Tailwind CSS
- shadcn/ui components
- Vitest (testing)

**No New Dependencies Required** - All functionality achievable with existing stack.

## Best Practices Applied

### React Patterns
- Custom hooks for stateful logic (`useCardQuery`)
- Presentational/container component separation
- Props-based communication (no prop drilling via context)
- useEffect for side effects (model loading)
- AbortController for cancellation

### TypeScript Patterns
- Strict typing for query results and state
- Interface definitions in contracts directory
- Type guards for runtime validation
- Discriminated unions for state machines

### Performance Patterns
- Query cancellation to prevent wasted computation
- Canvas validation before expensive operations
- Lazy loading of model (one-time per session)
- Memoization where appropriate (useMemo for result rendering)

### Accessibility Patterns
- shadcn components provide ARIA attributes
- Keyboard navigation support
- Screen reader friendly error messages
- Focus management during loading states

## Open Questions

**None** - All technical decisions resolved through:
1. Existing prototype implementation
2. Clarification session (6 questions answered)
3. Constitution compliance verification
4. Established monorepo patterns

## Next Steps (Phase 1)

1. Generate `data-model.md` with TypeScript interfaces
2. Create `contracts/card-query.ts` with type definitions
3. Generate `quickstart.md` for developer onboarding
4. Update agent context with any new patterns
5. Re-verify constitution compliance post-design

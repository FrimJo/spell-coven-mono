# Implementation Plan: Card Cropping and Image Database Query Integration

**Branch**: `007-refactor-card-cropping` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-refactor-card-cropping/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Refactor card cropping and image database query functionality from the prototype (`/prev` route) into the main game room interface. When a player clicks on a detected card (green-bordered area) in the video stream, the system will crop the card using perspective transformation, query the CLIP-based image database, and display the top matching result below the player list in the left sidebar. Debug support includes logging cropped images as base64 to console. The implementation reuses existing search library functions and maintains the current card detection overlay while adding query cancellation for rapid clicks and a whole-page loading indicator during model initialization.

## Technical Context

**Language/Version**: TypeScript 5.x / React 18.x  
**Primary Dependencies**: 
- React 18 (UI framework)
- TanStack Router (routing)
- Transformers.js (CLIP model for embeddings)
- OpenCV.js (card detection, already integrated)
- Tailwind CSS (styling)
- shadcn/ui components (UI component library)

**Storage**: Browser-side only (IndexedDB for model caching via Transformers.js)  
**Testing**: Vitest (unit/integration testing framework in monorepo)  
**Target Platform**: Modern browsers (Chrome, Firefox, Safari) with WebGL support  
**Project Type**: Web application (monorepo: `apps/web` + `packages/ui`)  
**Performance Goals**: 
- Card query completion <3 seconds (from click to result display)
- Model loading with progress indication (one-time per session)
- No UI blocking during query operations

**Constraints**: 
- Browser-first: All functionality client-side, no backend required
- Offline-capable after initial model/data load
- Reuse existing search library (`@/lib/search`)
- Maintain existing card detection (green border overlay)
- Follow existing design system and component patterns

**Scale/Scope**: 
- Single feature integration into existing game room
- ~3-5 new/modified components
- Reuse prototype logic from `/prev` route
- Integration point: Left sidebar below PlayerList component

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Browser-First Architecture ✅ PASS
- **Core functionality client-side**: Card cropping, CLIP embedding, and similarity search all run in browser
- **No backend dependencies**: Reuses existing `@/lib/search` with Transformers.js and pre-loaded embeddings
- **Offline-capable**: Works after initial model/data load (already implemented in prototype)
- **Browser-native APIs**: Uses existing OpenCV.js for detection, canvas for cropping, Transformers.js for ML

### II. Data Contract Discipline ✅ PASS
- **Existing contracts maintained**: Reuses `meta.json` (v1.0) and `embeddings.i8bin` contracts from `packages/mtg-image-db`
- **No new data formats**: Feature consumes existing artifacts, no new exports
- **Validation present**: Existing search library validates canvas data before querying

### III. User-Centric Prioritization ✅ PASS
- **User priorities followed**: P1 (core identification), P2 (debugging), P3 (error handling)
- **Performance targets**: <3 second query completion (maintained from prototype)
- **MVP-first**: Each user story independently testable and deliverable
- **User-perceived metrics**: Query latency, loading indicators, inline feedback

### IV. Specification-Driven Development ✅ PASS
- **spec.md complete**: User scenarios, functional requirements, success criteria defined
- **Technology-agnostic**: Spec describes WHAT (card identification), not HOW (React components)
- **Testable criteria**: All acceptance scenarios measurable
- **Clarifications documented**: 6 clarifications resolved and integrated

### V. Monorepo Package Isolation ✅ PASS
- **Package boundaries respected**: 
  - `apps/web`: Game room UI integration
  - `packages/ui`: Reusable shadcn components for card results display
  - `@/lib/search`: Existing search library (no changes needed)
- **No shared mutable state**: Components communicate via props and callbacks
- **Independent buildable**: Changes isolated to `apps/web` and `packages/ui`

### VI. Performance Through Optimization, Not Complexity ✅ PASS
- **Simple implementation**: Reuses prototype logic, no new architectural layers
- **Proven algorithms**: CLIP embeddings, cosine similarity (already optimized)
- **Optimized data**: int8 quantized embeddings (75% size reduction, already implemented)
- **No added complexity**: Straightforward React component integration

### VII. Open Source and Community-Driven ✅ PASS
- **Transparent development**: All code in monorepo, specification publicly documented
- **Extensibility maintained**: Component-based architecture allows customization
- **Documentation complete**: Spec, plan, and quickstart will guide contributors

**Constitution Compliance**: ✅ ALL GATES PASSED - No violations, proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/007-refactor-card-cropping/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (in progress)
├── research.md          # Phase 0 output (to be generated)
├── data-model.md        # Phase 1 output (to be generated)
├── quickstart.md        # Phase 1 output (to be generated)
├── contracts/           # Phase 1 output (to be generated)
│   └── card-query.ts    # TypeScript interfaces for card query data
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
apps/web/
├── src/
│   ├── components/
│   │   ├── GameRoom.tsx           # MODIFY: Add CardResultDisplay, integrate query logic
│   │   ├── VideoStreamGrid.tsx    # MODIFY: Add click handler for card cropping
│   │   └── CardResultDisplay.tsx  # NEW: Display query results below player list
│   ├── hooks/
│   │   ├── useWebcam.ts          # EXISTS: Card detection logic (reuse)
│   │   └── useCardQuery.ts       # NEW: Manage card query state and cancellation
│   ├── lib/
│   │   └── search.ts             # EXISTS: embedFromCanvas, top1 (reuse)
│   └── routes/
│       └── prev/
│           └── index.tsx         # EXISTS: Prototype reference (extract logic)

packages/ui/
├── src/
│   └── components/
│       ├── card-result.tsx       # NEW: shadcn-based card result component
│       ├── loading-overlay.tsx   # NEW: Whole-page loading indicator
│       └── inline-message.tsx    # NEW: Inline error/warning messages
└── package.json

packages/mtg-image-db/
└── index_out/
    ├── embeddings.i8bin          # EXISTS: Pre-generated embeddings (consumed)
    └── meta.json                 # EXISTS: Card metadata (consumed)
```

**Structure Decision**: Monorepo web application structure. Feature integrates into existing `apps/web` game room with new UI components added to `packages/ui` for reusability. No backend changes required - all functionality client-side using existing search library and pre-loaded embeddings.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - All constitution principles satisfied. Implementation follows existing patterns with no additional architectural complexity.

## Phase 0: Research (Completed)

✅ **Status**: Complete

**Deliverable**: `research.md`

**Key Decisions**:
1. Reuse existing useWebcam hook and cropping logic from prototype
2. Create custom useCardQuery hook with AbortController for cancellation
3. Build shadcn-based components in packages/ui
4. Whole-page loading overlay during model initialization
5. Inline error messages in result area
6. Console-based debug logging (base64 images)
7. Minimal modifications to existing components

**No unknowns remaining** - All technical decisions resolved through prototype analysis and clarification session.

## Phase 1: Design & Contracts (Completed)

✅ **Status**: Complete

**Deliverables**:
- `data-model.md` - Entity definitions, state machines, validation rules
- `contracts/card-query.ts` - TypeScript interfaces and type guards
- `quickstart.md` - Developer implementation guide

**Key Artifacts**:
1. **Data Model**: CardQueryResult, CardQueryState, ModelLoadingState, CroppedCardData
2. **State Machines**: Query lifecycle (idle → querying → success/error), Model loading
3. **Type Contracts**: 10+ TypeScript interfaces with validation functions
4. **Implementation Guide**: Step-by-step quickstart with testing strategy

**Agent Context Updated**: Windsurf rules updated with TypeScript/React patterns

## Phase 2: Task Generation (Next Step)

⏳ **Status**: Pending

**Command**: `/speckit.tasks`

**Expected Output**: `tasks.md` with dependency-ordered implementation tasks organized by user story priority (P1, P2, P3)

**Prerequisites**: ✅ All complete
- Specification finalized with clarifications
- Constitution compliance verified
- Research completed (no unknowns)
- Design artifacts generated
- Agent context updated

## Post-Design Constitution Re-Check

*Required after Phase 1 design completion*

### I. Browser-First Architecture ✅ PASS
- Design maintains client-side-only approach
- No new backend dependencies introduced
- Reuses existing browser APIs and libraries

### II. Data Contract Discipline ✅ PASS
- TypeScript interfaces provide compile-time contracts
- Validation functions enforce runtime checks
- No changes to existing data contracts (meta.json, embeddings.i8bin)

### III. User-Centric Prioritization ✅ PASS
- Design prioritizes user-perceived performance (<3s queries)
- Loading states provide clear feedback
- Error messages are user-friendly and actionable

### IV. Specification-Driven Development ✅ PASS
- All design decisions traceable to spec requirements
- Data model aligns with functional requirements
- Success criteria remain measurable

### V. Monorepo Package Isolation ✅ PASS
- Clear package boundaries maintained (apps/web, packages/ui)
- No shared mutable state between packages
- Components communicate via props/callbacks

### VI. Performance Through Optimization, Not Complexity ✅ PASS
- Simple state management (React hooks, no external libraries)
- Query cancellation prevents wasted computation
- No new architectural layers added

### VII. Open Source and Community-Driven ✅ PASS
- Complete documentation for contributors (quickstart, data model, contracts)
- Type-safe interfaces enable confident contributions
- Reusable components benefit entire monorepo

**Post-Design Compliance**: ✅ ALL GATES PASSED - Ready for task generation

## Summary

**Planning Status**: ✅ **COMPLETE** (Phases 0-1)

**Branch**: `007-refactor-card-cropping`  
**Artifacts Generated**:
- ✅ plan.md (this file)
- ✅ research.md (7 research areas, all decisions documented)
- ✅ data-model.md (entities, state machines, validation rules)
- ✅ contracts/card-query.ts (TypeScript interfaces and utilities)
- ✅ quickstart.md (developer implementation guide)

**Constitution Compliance**: ✅ Verified pre-design and post-design

**Next Command**: `/speckit.tasks` to generate implementation tasks

**Estimated Scope**:
- 3-5 new components
- 1 custom hook
- 2 modified components (GameRoom, VideoStreamGrid)
- ~500-800 lines of new code
- Reuses ~200 lines from prototype

**Implementation Time Estimate**: 4-6 hours for experienced React/TypeScript developer

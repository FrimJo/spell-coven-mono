# Implementation Plan: WebRTC Video Streaming Refactor

**Branch**: `002-webrtc-refactor-simplify` | **Date**: 2025-11-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-webrtc-refactor-simplify/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Reduce WebRTC video streaming implementation from 3,595 lines to approximately 1,750 lines (51% reduction) by removing excessive logging, consolidating duplicate logic into shared utilities, and eliminating architectural anti-patterns. The refactoring maintains all existing functionality while improving code maintainability, readability, and developer experience through three prioritized phases: (P1) remove bloat, (P2) consolidate logic, (P3) fix architecture.

**Technical Approach**: Systematic code reduction through:
1. Strip 90% of verbose console.logs (keep only error logs)
2. Create shared utilities (`normalizePlayerId`, `isSelfConnection`, `createPeerConnection`)
3. Replace polling with event-driven state management
4. Simplify React ref callbacks to work with framework instead of against it
5. Centralize error handling at appropriate boundaries

## Technical Context

**Language/Version**: TypeScript 5.x (React 18+ with TanStack Start)  
**Primary Dependencies**: React, RTCPeerConnection (browser native), EventSource (SSE), TanStack Start  
**Storage**: N/A (in-memory state management only)  
**Testing**: Existing integration tests (must pass without modification per FR-026)  
**Target Platform**: Modern browsers (Chrome 90+, Firefox 88+, Safari 15+) with WebRTC support  
**Project Type**: Web application (monorepo package: apps/web)  
**Performance Goals**: 
- Maintain sub-2-second peer connection establishment (SC-009)
- Stable 4-player video streaming for 30+ minutes (SC-010)
- Bundle size reduction of 15% for WebRTC code (SC-004)

**Constraints**: 
- Zero breaking changes to public APIs (FR-025)
- All existing integration tests must pass (FR-026)
- Maintain backward compatibility with signaling protocol (FR-024)
- Preserve separation of concerns (components/hooks/managers) (FR-019)

**Scale/Scope**: 
- 5 files totaling 3,595 lines → target ~1,750 lines
- ~10 integration tests must continue passing
- Support 2-8 player rooms with video/audio streaming

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

### Evaluation Against Constitution Principles

#### ✅ I. Browser-First Architecture
**Status**: PASS - No violations

This refactoring maintains the existing browser-first architecture. WebRTC peer connections, camera access, and video streaming all remain client-side. No changes to backend dependencies or server-side processing.

#### ✅ II. Data Contract Discipline
**Status**: PASS - Strengthened by refactoring

- FR-024 explicitly requires maintaining backward compatibility with signaling protocol
- FR-025 preserves all public API interfaces
- Refactoring consolidates validation logic, improving contract compliance
- Type definitions remain unchanged (FR-020)

#### ✅ III. User-Centric Prioritization
**Status**: PASS - Developer experience is user value

For this refactoring, developers maintaining the codebase ARE the users. The feature properly prioritizes:
1. **Accuracy/Quality**: All integration tests must pass (FR-026)
2. **Runtime Performance**: Must maintain current performance benchmarks (SC-009, SC-010)
3. **Resource Efficiency**: 15% bundle size reduction (SC-004)

Build time and developer ergonomics improvements (40% faster code review - SC-005, 30-min comprehension time - SC-006) are secondary outcomes of better code structure.

#### ✅ IV. Specification-Driven Development
**Status**: PASS - Exemplary compliance

- Complete spec.md with 26 functional requirements and 10 success criteria
- All requirements are testable and measurable
- Clear acceptance scenarios for each user story
- This plan.md follows specification-driven workflow

#### ✅ V. Monorepo Package Isolation
**Status**: PASS - Working within existing boundaries

Refactoring occurs entirely within `apps/web/src/` without changes to:
- Package boundaries or exports
- Cross-package dependencies
- Shared state mechanisms

New shared utilities remain within web package scope.

#### ✅ VI. Performance Through Optimization, Not Complexity
**Status**: PASS - Reducing complexity

This refactoring actively REMOVES complexity:
- Eliminates state sync polling (FR-017)
- Removes defensive workarounds (FR-014, FR-018)
- Simplifies over-engineered patterns (FR-015)
- Consolidates duplicate logic (FR-010, FR-011, FR-012)

Performance improvements come from:
- Smaller bundle size (less code to parse)
- Removal of unnecessary polling loops
- Simplified rendering (fewer ref callback changes)

#### ✅ VII. Open Source and Community-Driven
**Status**: PASS - Improves contributor experience

SC-006 targets reducing onboarding time from 2+ hours to 30 minutes. Better code readability and documentation (quickstart.md) directly support community contribution goals.

### Final Gate Decision

**✅ PASS** - All constitution principles satisfied. No violations requiring justification.

**Key Alignment Points**:
1. Refactoring maintains browser-first architecture without introducing backend dependencies
2. Contract discipline preserved through backward compatibility requirements
3. Developer experience treated as legitimate user value in refactoring context
4. Complexity REDUCED rather than increased
5. Self-contained within monorepo package boundaries

## Project Structure

### Documentation (this feature)

```text
specs/002-webrtc-refactor-simplify/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (already created)
├── research.md          # Phase 0: Research findings on patterns and best practices
├── data-model.md        # Phase 1: Data flow and state management architecture
├── quickstart.md        # Phase 1: Testing and validation guide
├── contracts/           # Phase 1: API stability contracts
│   ├── components.md    # VideoStreamGrid component API
│   ├── hooks.md         # useWebRTC and useWebRTCSignaling hook APIs
│   └── managers.md      # PeerConnectionManager class API
├── checklists/
│   └── requirements.md  # Spec quality validation (already created)
└── tasks.md             # Phase 2: Implementation tasks (/speckit.tasks command)
```

### Source Code (repository root)

```text
apps/web/src/
├── components/
│   └── VideoStreamGrid.tsx           # 858 → ~350 lines (P1: bloat, P2: refs)
├── hooks/
│   ├── useWebRTC.ts                  # 1085 → ~450 lines (P1: bloat, P2: dedup, P3: polling)
│   ├── useWebRTCSignaling.ts         # 303 → ~220 lines (P1: logging, P2: validation)
│   └── useWebcam.ts                  # Points to lib/webcam.ts
├── lib/
│   ├── webcam.ts                     # 911 → ~450 lines (P1: unused features)
│   └── webrtc/
│       ├── peer-connection.ts        # 438 → ~280 lines (P1: logging, P3: events)
│       ├── types.ts                  # Type definitions (unchanged)
│       ├── signaling.ts              # Signaling types (unchanged)
│       └── utils.ts                  # NEW: Shared utilities (P2)
│           ├── normalizePlayerId()
│           ├── isSelfConnection()
│           └── createPeerConnection()
└── __tests__/
    └── integration/
        └── webrtc/                   # Existing tests (must pass)
```

**Structure Decision**: 

Refactoring occurs in-place within existing `apps/web/src/` structure. The only new file is `lib/webrtc/utils.ts` for consolidated utilities. This preserves the current separation of concerns:

- **Components** (`VideoStreamGrid.tsx`): UI rendering and user interactions
- **Hooks** (`useWebRTC.ts`, `useWebRTCSignaling.ts`): React state management and lifecycle
- **Managers** (`peer-connection.ts`): WebRTC connection lifecycle and events
- **Utilities** (`utils.ts`): Shared logic extracted from multiple files

No changes to test structure; existing integration tests validate functionality preservation.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations** - Complexity Tracking section is not applicable.

This refactoring actively reduces complexity in alignment with Constitution principle VI (Performance Through Optimization, Not Complexity). All changes simplify the codebase by removing unnecessary abstraction layers, defensive programming patterns, and redundant logic.

---

## Phase 0: Research (Generated by /speckit.plan)

See [research.md](./research.md) for detailed findings on:
- React WebRTC integration patterns and anti-patterns
- Event-driven vs polling state management approaches
- Ref callback best practices for video elements
- Utility extraction patterns for shared logic
- Testing strategies for refactoring validation

---

## Phase 1: Design & Contracts (Generated by /speckit.plan)

### Artifacts

1. **[data-model.md](./data-model.md)**: Data flow architecture
   - Current state management patterns
   - MediaStream lifecycle
   - Peer connection state transitions
   - Event flow diagrams

2. **[contracts/](./contracts/)**: API stability contracts
   - Component interfaces (VideoStreamGrid props)
   - Hook return types (useWebRTC, useWebRTCSignaling)
   - Manager public methods (PeerConnectionManager)
   - Signaling message formats

3. **[quickstart.md](./quickstart.md)**: Validation guide
   - Running existing integration tests
   - Manual testing procedures for video streaming
   - Performance benchmarking commands
   - Regression detection checklist

### Agent Context

Agent-specific context files updated via:
```bash
.specify/scripts/bash/update-agent-context.sh cursor-agent
```

---

## Phase 2: Task Generation (Not created by /speckit.plan)

Task breakdown will be generated by the `/speckit.tasks` command, which creates:
- **tasks.md**: Organized by user story priority (P1 → P2 → P3)
- Each task linked to specific functional requirements
- Dependency ordering for safe incremental refactoring
- Validation steps tied to acceptance scenarios

**Command to run after Phase 1 completion**:
```bash
/speckit.tasks
```

---

## Implementation Notes

### Refactoring Strategy

This refactoring follows a **shrink-the-change** strategy:

1. **P1 (Remove Bloat)**: Safe deletions with immediate test validation
   - Remove console.logs (except errors)
   - Delete unused features (video file source, performance tracking)
   - Each deletion validated by passing tests

2. **P2 (Consolidate)**: Extract-and-replace pattern
   - Create utility function with tests
   - Replace first usage and validate
   - Replace remaining usages one at a time
   - Delete old duplicate code

3. **P3 (Fix Architecture)**: Incremental replacement
   - Implement event-driven state management alongside polling
   - Validate both work simultaneously
   - Remove polling once event-driven proven stable
   - Simplify ref callbacks with fallback to old pattern

### Risk Mitigation

- **Integration tests run after every file change** (not just at end)
- **Git commits after each successful change** (easy rollback)
- **Feature flag for new patterns** during P3 (gradual rollout)
- **Performance monitoring** during refactoring (SC-009, SC-010)

### Success Validation

Refactoring is complete when:
- [ ] All 10 success criteria met (SC-001 through SC-010)
- [ ] All 26 functional requirements satisfied (FR-001 through FR-026)
- [ ] All integration tests pass without modification
- [ ] Code review confirms readability improvement (SC-005)
- [ ] Bundle size reduced by 15%+ (SC-004)
- [ ] Manual testing confirms stable 4-player rooms for 30+ min (SC-010)

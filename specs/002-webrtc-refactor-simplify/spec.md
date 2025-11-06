# Feature Specification: WebRTC Video Streaming Refactor

**Feature Branch**: `002-webrtc-refactor-simplify`  
**Created**: 2025-11-06  
**Status**: Draft  
**Input**: User description: "Refactor WebRTC video streaming implementation to remove bloat and improve maintainability while preserving separation of concerns"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Code Bloat (Priority: P1)

As a developer maintaining the WebRTC video streaming feature, I need to remove unnecessary code bloat so that I can understand, debug, and modify the codebase efficiently without wading through thousands of lines of defensive programming, excessive logging, and unused features.

**Why this priority**: This delivers immediate value by making the codebase more maintainable. It's the foundation for all other improvements and can be done independently without architectural changes.

**Independent Test**: Can be fully tested by comparing line counts before/after, verifying all existing functionality still works via integration tests, and confirming no critical logs were removed (only verbose/debug logs).

**Acceptance Scenarios**:

1. **Given** VideoStreamGrid.tsx with 858 lines, **When** refactored to remove bloat, **Then** file is reduced to approximately 350 lines with all video streaming functionality preserved
2. **Given** useWebRTC.ts with 1085 lines, **When** refactored to remove bloat, **Then** file is reduced to approximately 450 lines with all connection management working
3. **Given** peer-connection.ts with 438 lines, **When** refactored to remove bloat, **Then** file is reduced to approximately 280 lines with all WebRTC operations functional
4. **Given** useWebRTCSignaling.ts with 303 lines, **When** refactored to remove bloat, **Then** file is reduced to approximately 220 lines with signaling working correctly
5. **Given** webcam.ts with 911 lines, **When** refactored to remove bloat, **Then** file is reduced to approximately 450 lines with card detection working
6. **Given** excessive console.log statements throughout codebase, **When** 90% of debug/verbose logs are removed, **Then** only critical error logs remain and application runs silently in production
7. **Given** unused features (video file source, performance metrics, blob URL logging), **When** removed from codebase, **Then** production bundle size decreases and code complexity reduces

---

### User Story 2 - Consolidate Duplicate Logic (Priority: P2)

As a developer working with the WebRTC implementation, I need duplicate logic consolidated into shared utilities so that bug fixes and improvements only need to be made once and the codebase follows DRY principles.

**Why this priority**: This prevents future bugs from inconsistent implementations and makes the codebase easier to modify. Depends on P1 bloat removal to clearly see duplication patterns.

**Independent Test**: Can be tested by searching for duplicate code patterns before/after, verifying utilities are reused across multiple files, and running integration tests to confirm behavior is consistent.

**Acceptance Scenarios**:

1. **Given** player ID normalization appearing in 8+ places, **When** consolidated into a single `normalizePlayerId()` utility, **Then** all files use the shared function and ID handling is consistent
2. **Given** self-connection checks scattered across multiple files, **When** consolidated into `isSelfConnection()` utility, **Then** validation happens once at boundaries with consistent error handling
3. **Given** peer connection creation logic duplicated in two large blocks, **When** extracted into `createPeerConnection()` utility function, **Then** connection setup follows single code path with consistent callback handling
4. **Given** multiple error handling blocks for "not found or not connected" errors, **When** centralized at signaling layer, **Then** error recovery strategy is consistent and maintainable
5. **Given** video element attachment logic repeated, **When** simplified into reusable pattern, **Then** stream attachment follows single approach across all components

---

### User Story 3 - Fix Architectural Issues (Priority: P3)

As a developer maintaining WebRTC connections, I need architectural anti-patterns removed so that the system is event-driven, relies on proper WebRTC state management, and doesn't require defensive workarounds for problems that shouldn't exist.

**Why this priority**: This improves long-term stability and performance but requires deeper changes. Should be done after code is simplified (P1) and duplication removed (P2) to avoid refactoring anti-patterns.

**Independent Test**: Can be tested by verifying no polling loops exist in code, connection state updates are event-driven, and stress testing shows proper state management under network issues.

**Acceptance Scenarios**:

1. **Given** state sync polling running every 2 seconds, **When** replaced with event-driven state updates, **Then** connection state reflects reality immediately via WebRTC events with no polling overhead
2. **Given** pending offers retry mechanism with complex map tracking, **When** removed in favor of proper connection state management, **Then** reconnection happens naturally through SSE and WebRTC state machine
3. **Given** over-engineered ref callback system preventing React updates, **When** simplified to trust React's rendering model, **Then** components render correctly without fighting framework behavior
4. **Given** triple-nested error handling for same scenarios, **When** error handling occurs once at appropriate layer, **Then** errors are caught and handled consistently with clear propagation rules
5. **Given** performance tracking code using window object hacks, **When** removed or replaced with proper analytics integration, **Then** codebase is clean without development-only code in production
6. **Given** cleanup effects removing "incorrect" self-connections, **When** root cause fixed to prevent self-connections from being created, **Then** symptom-patching code is unnecessary and removed

---

### Edge Cases

- What happens when a peer disconnects during refactoring? System must maintain proper cleanup and reconnection behavior
- How does system handle rapid camera switching during simplified attachment logic? Must prevent race conditions without defensive polling
- What happens if WebRTC state transitions occur faster than event handlers can process? Event-driven architecture must queue and handle events in order
- How does system behave when multiple tabs open same room during refactored connection management? Must handle multiple peer connections without interference
- What happens to existing users when refactored code is deployed? Must maintain backward compatibility with signaling protocol and connection flow

## Requirements *(mandatory)*

### Functional Requirements

**Code Reduction Requirements**:

- **FR-001**: VideoStreamGrid.tsx MUST be reduced from 858 lines to approximately 300-400 lines while maintaining all video streaming display functionality
- **FR-002**: useWebRTC.ts MUST be reduced from 1085 lines to approximately 400-500 lines while maintaining all peer connection management capabilities
- **FR-003**: peer-connection.ts MUST be reduced from 438 lines to approximately 250-300 lines while maintaining all RTCPeerConnection wrapper functionality
- **FR-004**: useWebRTCSignaling.ts MUST be reduced from 303 lines to approximately 200-250 lines while maintaining all SSE signaling capabilities
- **FR-005**: webcam.ts MUST be reduced from 911 lines to approximately 400-500 lines while maintaining all card detection functionality

**Logging Requirements**:

- **FR-006**: System MUST remove 90% of console.log statements that provide verbose debugging information
- **FR-007**: System MUST retain console.error logs for critical failures and unexpected errors
- **FR-008**: System MUST remove blob URL logging code used for debugging cropped images
- **FR-009**: System MUST remove performance metrics logging code that tracks inference times and detection counts

**Utility Consolidation Requirements**:

- **FR-010**: System MUST provide a shared `normalizePlayerId()` utility function used by all files requiring player ID normalization
- **FR-011**: System MUST provide a shared `isSelfConnection()` utility function used by all files checking for self-connections
- **FR-012**: System MUST provide a shared `createPeerConnection()` utility function that consolidates duplicate connection creation logic

**Architectural Requirements**:

- **FR-013**: System MUST use event-driven state updates for WebRTC connection state changes instead of polling
- **FR-014**: System MUST remove pending offers retry mechanism in favor of natural reconnection through proper state management
- **FR-015**: System MUST simplify React ref callbacks to work with React's rendering model instead of fighting it
- **FR-016**: System MUST remove triple-nested error handling in favor of single-layer error handling at appropriate boundaries
- **FR-017**: System MUST remove state sync polling interval that checks connection state every 2 seconds
- **FR-018**: System MUST remove cleanup effects that patch symptoms of self-connections rather than preventing them

**Code Quality Requirements**:

- **FR-019**: System MUST maintain separation of concerns with distinct files for: components (VideoStreamGrid), hooks (useWebRTC, useWebRTCSignaling), and managers (PeerConnectionManager)
- **FR-020**: System MUST preserve all existing TypeScript type definitions and type safety
- **FR-021**: System MUST remove all unused functions (e.g., toggleVideo that is immediately voided)
- **FR-022**: System MUST remove all development-only features from production code (video file source support, window object hacks)
- **FR-023**: System MUST remove duplicate event handlers (e.g., multiple playing/pause handlers on same video element)

**Compatibility Requirements**:

- **FR-024**: System MUST maintain backward compatibility with existing signaling protocol and message formats
- **FR-025**: System MUST preserve all public API interfaces for components, hooks, and managers
- **FR-026**: System MUST ensure all existing integration tests pass without modification after refactoring

### Key Entities

- **VideoStreamGrid Component**: React component responsible for displaying local and remote video streams with controls. Currently 858 lines, target 300-400 lines.
- **PeerConnectionManager**: Class wrapper around RTCPeerConnection managing individual peer connections. Currently 438 lines, target 250-300 lines.
- **useWebRTC Hook**: React hook managing all peer connections for a room. Currently 1085 lines, target 400-500 lines.
- **useWebRTCSignaling Hook**: React hook handling SSE-based signaling for WebRTC. Currently 303 lines, target 200-250 lines.
- **Webcam Module**: Module handling camera access and card detection. Currently 911 lines, target 400-500 lines.
- **Shared Utilities**: New module containing `normalizePlayerId()`, `isSelfConnection()`, and `createPeerConnection()` to eliminate duplication.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Total WebRTC-related code is reduced from 3,595 lines to approximately 1,750 lines (51% reduction target)
- **SC-002**: Console log statements are reduced by 90% while maintaining error logging coverage
- **SC-003**: All existing WebRTC integration tests pass without modification, demonstrating functional equivalence
- **SC-004**: Production JavaScript bundle size decreases by at least 15% for WebRTC-related code
- **SC-005**: Code review time for WebRTC changes decreases by at least 40% due to improved readability
- **SC-006**: New developers can understand WebRTC connection flow in under 30 minutes (vs 2+ hours previously)
- **SC-007**: Zero polling loops exist in refactored codebase, verified through code audit
- **SC-008**: Player ID normalization and self-connection checks occur in exactly one location each, verified through code search
- **SC-009**: Video streaming maintains sub-2-second connection establishment time for peer connections
- **SC-010**: System handles 4-player rooms with stable video streaming for 30+ minutes without degradation

## Assumptions

- Existing integration tests adequately cover WebRTC functionality and will catch regressions
- Current logging strategy (verbose console.logs) was added during development and is not required for production
- SSE signaling layer provides reliable message delivery, making retry mechanisms at peer connection layer unnecessary
- React's rendering and ref handling is sufficient when used correctly, complex workarounds indicate misuse
- WebRTC connection state management is reliable when using standard event handlers
- Current performance is acceptable; refactoring goals are maintainability and readability, not performance optimization
- Separation of concerns (components, hooks, managers) will be maintained throughout refactoring
- TypeScript types will not change, maintaining type safety during refactoring
- No breaking changes to public APIs, allowing incremental refactoring

## Dependencies

- No external dependencies required; this is an internal refactoring
- Requires comprehensive integration test suite to verify functional equivalence
- May require additional unit tests for new shared utility functions
- Code review from team members familiar with existing WebRTC implementation

## Out of Scope

- Adding new WebRTC features or capabilities
- Changing signaling protocol or message formats
- Performance optimization beyond what naturally comes from code reduction
- Refactoring non-WebRTC parts of the application
- Migrating to different WebRTC libraries or frameworks
- Adding new monitoring or analytics capabilities
- Changes to UI/UX of video streaming components
- Backend changes to SSE or signaling infrastructure

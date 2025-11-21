# Implementation Plan: WebRTC Video Streaming Between Players

**Branch**: `001-webrtc-video-streaming` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-webrtc-video-streaming/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable peer-to-peer WebRTC video streaming between players in game rooms. Players can see each other's webcam feeds in a grid layout with controls for video/audio. Signaling uses existing TanStack Start infrastructure (SSE + createServerFn) separate from Discord. Discord is only used for room/player identification. The feature reuses existing VideoStreamGrid UI components and follows Separation of Concerns to allow swapping Discord for other room management services.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2024 target), React 19
**Primary Dependencies**: Browser WebRTC APIs (RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, MediaStream), TanStack Start (`@tanstack/react-start`), existing VideoStreamGrid component
**Storage**: N/A (peer-to-peer connections, no persistent storage required)
**Testing**: N/A (tests optional per constitution, may add integration tests for WebRTC flows)
**Target Platform**: Modern browsers with WebRTC support (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (frontend: React, backend: TanStack Start)
**Performance Goals**:
- 95% of peer connections establish within 10 seconds (SC-001)
- Video streams maintain at least 15 FPS (SC-002)
- Support 4 simultaneous video streams without >500ms latency increase per stream (SC-006)
- Connection state changes reflected within 1 second (SC-007)

**Constraints**:
- STUN-only NAT traversal (no TURN servers initially)
- Graceful degradation when permissions denied or connections fail
- Must reuse existing VideoStreamGrid UI components
- Must not depend on Discord-specific APIs for signaling

**Scale/Scope**:
- Up to 4 players per room simultaneously streaming video (FR-012)
- Typical room size 2-4 players
- Browser-native WebRTC (no server-side media processing)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Browser-First Architecture ✅
- **Status**: COMPLIANT
- **Rationale**: WebRTC runs entirely in browser. No backend media processing required. Signaling backend only routes messages, not media streams. STUN server is external service (Google's public STUN).

### II. Data Contract Discipline ✅
- **Status**: COMPLIANT
- **Rationale**: Signaling messages will have explicit schemas (offers, answers, ICE candidates). Peer connection state transitions documented. Versioned message format if schema evolves.

### III. User-Centric Prioritization ✅
- **Status**: COMPLIANT
- **Rationale**: Feature delivers user value (seeing other players). Performance targets focus on user-perceived metrics (connection time, FPS, latency). Graceful degradation preserves gameplay when video unavailable.

### IV. Specification-Driven Development ✅
- **Status**: COMPLIANT
- **Rationale**: Spec includes user stories, functional requirements, success criteria. This plan document extends specification with technical design.

### V. Monorepo Package Isolation ✅
- **Status**: COMPLIANT
- **Rationale**: WebRTC logic will be in `apps/web` hooks/services. No new packages required. Reuses existing VideoStreamGrid component.

### VI. Performance Through Optimization, Not Complexity ✅
- **Status**: COMPLIANT
- **Rationale**: Uses standard WebRTC APIs. No custom protocols or complex infrastructure. Simple peer-to-peer mesh topology (each player connects to all others).

### VII. Open Source and Community-Driven ✅
- **Status**: COMPLIANT
- **Rationale**: Uses standard WebRTC APIs, no proprietary dependencies. Self-hosting remains viable (STUN server is public Google service).

**Gate Status**: ✅ **PASS** - All constitution principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/001-webrtc-video-streaming/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/web/src/
├── hooks/
│   ├── useWebRTC.ts              # NEW: WebRTC peer connection management hook
│   └── useWebRTCSignaling.ts     # NEW: Signaling integration hook (SSE + createServerFn)
├── components/
│   └── VideoStreamGrid.tsx      # MODIFY: Extend to display remote peer streams
├── server/
│   └── handlers/
│       └── webrtc-signaling.server.ts  # NEW: createServerFn for signaling messages
└── lib/
    └── webrtc/
        ├── peer-connection.ts    # NEW: RTCPeerConnection wrapper/manager
        ├── signaling.ts          # NEW: Signaling message types and utilities
        └── stream-manager.ts     # NEW: MediaStream management (track replacement, cleanup)
```

**Structure Decision**: WebRTC functionality integrated into existing `apps/web` structure. Hooks follow existing pattern (`useWebcam`, `useVoiceChannelEvents`). Server functions follow existing pattern (`discord-rooms.server.ts`). No new packages required.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations detected - complexity tracking not required.*

## Phase Completion Status

### Phase 0: Outline & Research ✅

**Completed**: 2025-01-27

- Research document created: `research.md`
- Technical decisions documented:
  - Peer-to-peer mesh topology
  - SSE + createServerFn signaling protocol
  - STUN server configuration
  - MediaStream track replacement
  - Connection state management
  - Error handling patterns
  - Cleanup and resource management

**No NEEDS CLARIFICATION items remaining** - All technical unknowns resolved.

### Phase 1: Design & Contracts ✅

**Completed**: 2025-01-27

- Data model created: `data-model.md`
  - Entities: PeerConnection, SignalingMessage, PlayerStreamState, RoomParticipant
  - State machines and transitions documented
  - Data flow diagrams included

- API contracts created: `contracts/signaling-api.md`
  - Client → Server: createServerFn for sending messages
  - Server → Client: SSE for receiving messages
  - Message types: offer, answer, ice-candidate
  - Validation rules and error handling

- Quick start guide created: `quickstart.md`
  - Architecture summary
  - Implementation steps
  - Connection flow diagram
  - Key APIs and examples
  - Testing checklist

- Agent context updated: `.cursor/rules/specify-rules.mdc`
  - Added WebRTC APIs and TanStack Start technologies

### Constitution Check (Post-Phase 1) ✅

*Re-checked after Phase 1 design - all principles still satisfied.*

**Gate Status**: ✅ **PASS** - Design maintains compliance with all constitution principles.

## Next Steps

Ready for Phase 2: Task Generation (`/speckit.tasks`)

The implementation plan is complete with:
- ✅ Technical context defined
- ✅ Constitution compliance verified
- ✅ Research completed
- ✅ Data model designed
- ✅ API contracts specified
- ✅ Quick start guide provided

All design artifacts are ready for task breakdown and implementation.

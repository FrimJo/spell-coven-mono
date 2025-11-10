# Implementation Plan: PeerJS WebRTC Migration

**Branch**: `001-peerjs-migration` | **Date**: 2025-11-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-peerjs-migration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Replace custom WebRTC implementation (~1000 lines across 5+ files) with PeerJS library to reduce code complexity by 70-80%. Migration will be executed as a big bang replacement with thorough staging testing. The new implementation will maintain all existing features (video/audio toggle, camera switching, mesh topology for 2-4 players) while using PeerJS cloud signaling initially with capability to migrate to self-hosted server if needed.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (existing project uses TanStack Start + React)
**Primary Dependencies**: PeerJS (^1.5.4), existing React/TanStack Start stack  
**Storage**: N/A (ephemeral WebRTC connections only)  
**Testing**: Existing test infrastructure (Vitest/React Testing Library)  
**Target Platform**: Modern browsers with WebRTC support (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (TanStack Start monorepo)  
**Performance Goals**: <3s connection establishment, 95%+ connection success rate, support 4K video resolution  
**Constraints**: 10-second connection timeout, 3 retry attempts with exponential backoff, mesh topology (2-4 players max)  
**Scale/Scope**: Small-scale multiplayer (2-4 concurrent players per room), ~100-200 lines of WebRTC code (down from ~1000)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASSED - Constitution file is template-only, no specific gates defined for this project yet.

**Notes**: 
- No project-specific constitution principles have been ratified
- Standard software engineering best practices will be followed
- Migration maintains existing test coverage
- Big bang deployment strategy requires thorough staging validation

## Project Structure

### Documentation (this feature)

```text
specs/001-peerjs-migration/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
├── checklists/          # Quality validation checklists
│   └── requirements.md  # Spec quality checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/web/src/
├── hooks/
│   ├── usePeerJS.ts              # NEW: Simplified WebRTC hook using PeerJS
│   ├── useWebRTC.ts              # TO REMOVE: Current custom implementation
│   ├── useWebRTCSignaling.ts     # TO REMOVE: Custom signaling logic
│   └── useVoiceChannelMembersFromEvents.ts  # KEEP: Discord integration
├── lib/
│   └── webrtc/
│       ├── peer-connection.ts    # TO REMOVE: Custom peer connection manager
│       ├── signaling.ts          # TO REMOVE: Custom signaling types
│       ├── types.ts              # TO REMOVE: Custom WebRTC types
│       └── utils.ts              # TO REMOVE: Custom utilities
├── server/
│   ├── handlers/
│   │   └── webrtc-signaling.server.ts  # TO REMOVE: Custom SSE signaling
│   └── managers/
│       └── sse-manager.ts        # KEEP: Used by other features
└── components/
    ├── GameRoom.tsx              # TO UPDATE: Use new usePeerJS hook
    └── VideoStreamGrid.tsx       # TO UPDATE: Simplified peer handling

apps/web/tests/
└── hooks/
    └── usePeerJS.test.ts         # NEW: Tests for PeerJS integration
```

**Structure Decision**: Web application structure (TanStack Start monorepo). The migration will replace custom WebRTC implementation files with a single simplified hook wrapping PeerJS. Server-side signaling infrastructure will be removed as PeerJS handles signaling via its cloud service.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: N/A - No constitution violations. This migration actually reduces complexity significantly (70-80% code reduction).

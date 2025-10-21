# Feature 013: Discord API Integration for Remote MTG Play

**Status**: Draft  
**Branch**: `013-discord-api-integration`  
**Created**: 2025-10-21

## Overview

Integration of Discord's API to provide chat messaging and webcam streaming infrastructure for Spell Coven's remote MTG play platform. This leverages Discord's existing voice channels, video streaming, and text chat capabilities as the backend communication layer.

## Documentation

- **[spec.md](./spec.md)** - Feature specification (WHAT and WHY)
  - User scenarios and acceptance criteria
  - Functional requirements
  - Success criteria
  - Technology-agnostic requirements

- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Implementation reference (HOW)
  - Phase 0: Prerequisites & Discord Developer Portal setup
  - Separation of Concerns (SoC) architecture
  - Package structure and file organization
  - Technical implementation details
  - PKCE OAuth flow explanation
  - Testing strategy
  - UX considerations and wireframes

- **[checklists/requirements.md](./checklists/requirements.md)** - Specification quality validation

## Phased Approach

This feature is implemented in 6 prioritized phases:

- **P1**: Discord Authentication Gate - Foundation for all features
- **P2**: Real-Time Connection Status - Connection transparency
- **P3**: Discord Text Chat Integration - First communication feature
- **P4**: Game Event Embeds - Enhanced gameplay experience
- **P5**: Voice Channel Selection and Room Creation - Game organization
- **P6**: Video Streaming for Card Recognition - Complete remote play

## Next Steps

1. Review and validate the specification
2. Run `/speckit.clarify` if any requirements need clarification
3. Run `/speckit.plan` to generate implementation plan
4. Refer to IMPLEMENTATION_GUIDE.md during development for architecture decisions

## Key Architectural Decisions

- **Authentication**: Discord OAuth2 with PKCE (client-side only, no backend)
- **Architecture**: Separation of Concerns - `@repo/discord-integration` package (pure API logic) + `apps/web` (UI layer)
- **Communication**: Discord Gateway (WebSocket) for real-time events + REST API for actions
- **Video**: Discord RTC protocol (high risk - may require fallback to custom WebRTC)

# Research: WebRTC Video Streaming

**Feature**: 001-webrtc-video-streaming  
**Date**: 2025-01-27  
**Purpose**: Document technical decisions and best practices for WebRTC peer-to-peer video streaming implementation

## WebRTC Peer-to-Peer Mesh Topology

**Decision**: Full mesh topology - each player establishes a peer connection with every other player in the room.

**Rationale**: 
- Simplest topology for small groups (2-4 players)
- No central media server required (browser-first architecture)
- Each peer handles its own encoding/decoding
- Scales acceptably for typical room size (FR-012: up to 4 players)

**Alternatives Considered**:
- SFU (Selective Forwarding Unit): Rejected - requires media server, violates browser-first principle
- Hub-and-spoke: Rejected - creates single point of failure, not needed for 4-player rooms
- Ring topology: Rejected - adds complexity, no benefit for small groups

**Implementation Notes**:
- Maximum 3 peer connections per player (for 4-player room)
- Each peer connection is bidirectional (send/receive)
- Connection establishment happens independently (no coordination needed per FR-002 clarification)

## Signaling Protocol: SSE + createServerFn

**Decision**: Use TanStack Start SSE (server→client) for receiving signaling messages and createServerFn (client→server) for sending signaling messages. Backend routes messages between players in the same room.

**Rationale**:
- Leverages existing infrastructure (no new services)
- Maintains separation from Discord (only uses for room membership)
- SSE provides real-time delivery for incoming messages
- createServerFn provides reliable request/response for outgoing messages
- Aligns with existing patterns (`useVoiceChannelEvents` uses SSE)

**Alternatives Considered**:
- WebSocket service: Rejected - adds new infrastructure, SSE+createServerFn sufficient
- Pure HTTP polling: Rejected - higher latency, poor user experience
- Discord Gateway for signaling: Rejected - violates SoC, Discord might be swapped out

**Message Flow**:
1. Player A creates offer → sends via `createServerFn('sendSignalingMessage')`
2. Backend receives offer → routes to Player B via SSE
3. Player B receives offer via SSE → creates answer → sends via `createServerFn`
4. Backend routes answer to Player A via SSE
5. ICE candidates follow same pattern

**Implementation Notes**:
- Backend maintains mapping: `roomId → Set<userId>` for routing
- SSE connection per player (already exists for voice channel events)
- Signaling messages include: `type` (offer/answer/ice-candidate), `from`, `to`, `roomId`, `payload`

## STUN Server Configuration

**Decision**: Use Google's public STUN server (`stun:stun.l.google.com:19302`) as specified in requirements.

**Rationale**:
- Public, reliable, no configuration needed
- Free to use
- Sufficient for most NAT configurations (SC-003: 90% success rate target)
- No TURN servers required initially (per clarifications)

**Alternatives Considered**:
- Self-hosted STUN: Rejected - adds infrastructure, public STUN sufficient
- Multiple STUN servers: Deferred - can add fallbacks if needed
- TURN servers: Deferred - initial implementation STUN-only per clarifications

**Limitations**:
- Some symmetric NATs may fail (handled gracefully per FR-018)
- Will not work in all network configurations (90% target acceptable)

## MediaStream Track Replacement

**Decision**: Use `RTCRtpSender.replaceTrack()` API when switching cameras. Maintain existing peer connections, only replace video track.

**Rationale**:
- Standard WebRTC API for seamless camera switching
- No renegotiation required (faster, no connection interruption)
- Matches user expectation (seamless switching)
- Simpler than closing/recreating connections

**Alternatives Considered**:
- Close/recreate peer connection: Rejected - causes connection interruption, unnecessary
- Multiple streams simultaneously: Rejected - wastes bandwidth, not needed
- Disable video before switching: Rejected - poor UX, replaceTrack handles it

**Implementation Notes**:
- Call `sender.replaceTrack(newTrack)` for each RTCRtpSender in peer connection
- Handle promise rejection if track replacement fails
- Update local MediaStream reference for UI

## Connection State Management

**Decision**: Track connection state per peer: `disconnected`, `connecting`, `connected`, `failed`, `reconnecting`.

**Rationale**:
- Aligns with RTCPeerConnection.iceConnectionState
- Provides clear UI feedback (FR-009)
- Enables automatic reconnection logic (FR-010)

**State Transitions**:
- `disconnected` → `connecting`: When initiating peer connection
- `connecting` → `connected`: When ICE connection established
- `connected` → `disconnected`: When peer leaves room
- `connected` → `reconnecting`: When connection drops temporarily
- `reconnecting` → `connected`: When reconnection succeeds
- `connecting`/`reconnecting` → `failed`: After timeout (30 seconds per FR-018)

**Implementation Notes**:
- Listen to `RTCPeerConnection.oniceconnectionstatechange`
- Map ICE states to application states
- Reset to `disconnected` when peer leaves room

## Error Handling Patterns

**Decision**: Graceful degradation at all levels - permissions, connection failures, browser compatibility.

**Rationale**:
- Matches browser-first architecture (core gameplay continues)
- User-centric prioritization (don't block gameplay for video issues)
- Aligns with FR-017, FR-018 (permission denials, ICE failures)

**Permission Denial**:
- Show status indicator: "camera unavailable" or "microphone unavailable"
- Provide retry button
- Continue game without video/audio from that player

**ICE Failure**:
- Show "connection failed" error after 30 seconds
- Provide retry button
- Continue game without video from that peer

**Browser Compatibility**:
- Detect WebRTC support: `RTCPeerConnection in window`
- Show "WebRTC not supported" status
- Continue game without video

**Implementation Notes**:
- All error states have UI indicators (FR-009)
- Errors are non-blocking (game continues)
- Users can retry failed operations

## Cleanup and Resource Management

**Decision**: Explicit cleanup when player leaves room: close peer connections, stop media tracks, remove event listeners.

**Rationale**:
- Prevents memory leaks
- Releases camera/microphone resources
- Aligns with FR-016 (cleanup requirement)

**Cleanup Steps**:
1. Close all RTCPeerConnections for that peer
2. Stop all MediaStream tracks (`track.stop()`)
3. Remove event listeners
4. Clear signaling message subscriptions
5. Remove from UI grid

**Implementation Notes**:
- Use `useEffect` cleanup functions in React hooks
- Call `peerConnection.close()` for each connection
- Call `stream.getTracks().forEach(track => track.stop())`
- Cleanup happens when component unmounts or player leaves room

## References

- [MDN: WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [MDN: RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
- [MDN: RTCRtpSender.replaceTrack()](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack)
- [WebRTC Samples: Peer Connection](https://webrtc.github.io/samples/src/content/peerconnection/pc1/)
- [Google STUN Server](https://developers.google.com/talk/libjingle_reference_protocols#stun)


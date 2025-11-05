# Data Model: WebRTC Video Streaming

**Feature**: 001-webrtc-video-streaming  
**Date**: 2025-01-27

## Entities

### PeerConnection

Represents a WebRTC peer connection between two players.

**Fields**:
- `id`: string - Unique identifier for this peer connection (e.g., `localPlayerId-remotePlayerId`)
- `localPlayerId`: string - ID of local player
- `remotePlayerId`: string - ID of remote player
- `roomId`: string - Game room ID
- `rtcPeerConnection`: RTCPeerConnection - Browser WebRTC peer connection object
- `state`: PeerConnectionState - Current connection state
- `localStream`: MediaStream | null - Local player's media stream
- `remoteStream`: MediaStream | null - Remote player's media stream
- `createdAt`: number - Timestamp when connection was created
- `lastStateChange`: number - Timestamp of last state change

**State Transitions**:
```
disconnected → connecting → connected
                ↓            ↓
            reconnecting    failed
                ↓
            connected (on success) or failed (on timeout)
```

**Validation Rules**:
- `localPlayerId` and `remotePlayerId` must be different
- `roomId` must match room management service
- `state` must be valid PeerConnectionState enum value

**Lifecycle**:
- Created when remote player joins room or local player enables video
- State updated via RTCPeerConnection event listeners
- Destroyed when peer leaves room or connection fails permanently

### SignalingMessage

Represents a message exchanged through the signaling service for WebRTC negotiation.

**Fields**:
- `type`: SignalingMessageType - Message type (offer, answer, ice-candidate)
- `from`: string - Player ID sending the message
- `to`: string - Player ID receiving the message
- `roomId`: string - Game room ID
- `payload`: SignalingPayload - Type-specific payload (SDP for offer/answer, ICE candidate for ice-candidate)
- `timestamp`: number - Message timestamp

**Message Types**:
- `offer`: Contains RTCSessionDescriptionInit (SDP)
- `answer`: Contains RTCSessionDescriptionInit (SDP)
- `ice-candidate`: Contains RTCIceCandidateInit

**Validation Rules**:
- `from` and `to` must be different player IDs
- `roomId` must match current room
- `payload` structure must match `type`
- SDP must be valid WebRTC SDP format
- ICE candidate must have valid `candidate` field

**Lifecycle**:
- Created by client when generating offer/answer/ICE candidate
- Sent via createServerFn to backend
- Backend routes to target player via SSE
- Consumed by receiving client to update peer connection

### PlayerStreamState

Represents the video/audio state of a player's stream.

**Fields**:
- `playerId`: string - Player ID
- `videoEnabled`: boolean - Whether video is enabled
- `audioEnabled`: boolean - Whether audio is enabled
- `videoMuted`: boolean - Whether video is muted (local only)
- `audioMuted`: boolean - Whether audio is muted
- `connectionState`: PeerConnectionState - Connection state for this player
- `hasLocalStream`: boolean - Whether local player has active media stream
- `hasRemoteStream`: boolean - Whether remote stream is available

**State Transitions**:
- Video/audio toggles update `videoEnabled`/`audioEnabled`
- Mute toggles update `videoMuted`/`audioMuted`
- Connection state updates via peer connection events

**Validation Rules**:
- `videoEnabled` false implies `hasLocalStream` false (but not vice versa - stream may be unavailable)
- `audioMuted` can be true even if `audioEnabled` is true (user muted)

**Relationships**:
- One PlayerStreamState per player per room
- Updated by VideoStreamGrid component for local player
- Synced via signaling for remote players

### RoomParticipant

Represents a player's presence in a game room (obtained from room management service).

**Fields**:
- `id`: string - Player ID (from room management service)
- `username`: string - Player display name
- `avatar`: string | null - Player avatar URL (optional)
- `joinedAt`: number - Timestamp when player joined room

**Note**: This entity is managed by room management service (Discord), not by WebRTC feature. Used only to determine which peers need connections.

**Relationships**:
- One RoomParticipant per player per room
- List obtained from room management service
- Changes trigger peer connection creation/destruction

## State Management

### Connection State Machine

```
                    ┌─────────────┐
                    │ disconnected│
                    └──────┬───────┘
                           │ initiate
                           ▼
                    ┌─────────────┐
                    │  connecting │
                    └──────┬───────┘
                           │ ICE connected
                           ▼
                    ┌─────────────┐
                    │  connected  │
                    └──────┬───────┘
                           │ ICE failed/timeout
                           ▼
                    ┌─────────────┐
                    │   failed    │
                    └─────────────┘
                    
                    ┌─────────────┐
                    │ reconnecting│─────┐
                    └──────┬───────┘    │
                           │            │ timeout
                           │ ICE connected
                           ▼            │
                    ┌─────────────┐     │
                    │  connected  │◄────┘
                    └─────────────┘
```

### Stream State Synchronization

Local player state changes (video/audio toggle, mute) are:
1. Applied to local MediaStream tracks
2. Broadcast via signaling to all peers
3. Reflected in remote players' UI

Remote player state changes are:
1. Received via signaling
2. Applied to UI state
3. Displayed in VideoStreamGrid

## Data Flow

### Connection Establishment Flow

```
Player A                    Backend                   Player B
   │                           │                          │
   │─── create offer ─────────>│                          │
   │                           │─── route via SSE ───────>│
   │                           │                          │─── create answer
   │                           │<── send answer ──────────│
   │<── route via SSE ─────────│                          │
   │─── set remote desc ───────│                          │
   │                           │                          │
   │─── ICE candidate ───────>│                          │
   │                           │─── route via SSE ───────>│
   │                           │                          │─── add ICE candidate
   │<── ICE candidate ─────────│<── ICE candidate ────────│
   │─── add ICE candidate ─────│                          │
   │                           │                          │
   │◄─── CONNECTED ────────────┼──────────────────────────►│
```

### Stream State Update Flow

```
Player A (local)          Signaling          Player B (remote)
   │                         │                      │
   │─── toggle video ────────>│                      │
   │   (update track)        │─── broadcast ───────>│
   │                         │                      │─── update UI state
   │                         │                      │   (show video off)
```

## Validation

### Signaling Message Validation

- **from/to**: Must be valid player IDs in current room
- **roomId**: Must match current room context
- **type**: Must be one of: `offer`, `answer`, `ice-candidate`
- **payload**: 
  - For `offer`/`answer`: Must contain valid SDP (`type`, `sdp` fields)
  - For `ice-candidate`: Must contain valid ICE candidate (`candidate`, `sdpMLineIndex`, `sdpMid`)

### Peer Connection Validation

- **localPlayerId** ≠ **remotePlayerId**
- **roomId** matches room from room management service
- **state** is valid enum value
- **rtcPeerConnection** is valid RTCPeerConnection instance

### MediaStream Validation

- Stream contains at least one track (video or audio)
- Video tracks have `kind === 'video'`
- Audio tracks have `kind === 'audio'`
- Tracks are enabled/disabled based on player state


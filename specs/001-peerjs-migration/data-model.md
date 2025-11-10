# Data Model: PeerJS WebRTC Migration

**Feature**: 001-peerjs-migration  
**Date**: 2025-11-10

## Overview

This document defines the data structures and state management for the PeerJS WebRTC implementation. Since WebRTC connections are ephemeral (no persistence), this focuses on runtime state management.

## Core Entities

### 1. Peer Connection

**Description**: Represents a PeerJS peer instance and its associated connections

**Fields**:
- `peerId`: string - Unique identifier for this peer (matches Discord user ID)
- `peer`: Peer - PeerJS instance
- `connectionState`: 'disconnected' | 'connecting' | 'connected' | 'failed'
- `createdAt`: number - Timestamp when peer was initialized

**Relationships**:
- Has many: MediaCall (one per remote peer)
- Has one: LocalMediaStream

**Lifecycle**:
1. Created when component mounts
2. Transitions through connection states based on PeerJS events
3. Destroyed when component unmounts or user leaves room

**Validation Rules**:
- `peerId` must match authenticated Discord user ID
- Cannot create multiple peers with same ID
- Must be destroyed before creating new peer with same ID

### 2. Media Call

**Description**: Represents an active WebRTC call between two peers

**Fields**:
- `callId`: string - Unique identifier for this call
- `remotePeerId`: string - ID of the remote peer
- `call`: MediaConnection - PeerJS MediaConnection instance
- `remoteStream`: MediaStream | null - Remote peer's video/audio stream
- `connectionState`: 'connecting' | 'connected' | 'disconnected' | 'failed'
- `videoEnabled`: boolean - Whether remote peer's video is enabled
- `audioEnabled`: boolean - Whether remote peer's audio is enabled
- `createdAt`: number - Timestamp when call was initiated
- `connectedAt`: number | null - Timestamp when call connected

**Relationships**:
- Belongs to: Peer Connection
- Has one: Remote Media Stream

**Lifecycle**:
1. Created when calling remote peer or receiving incoming call
2. Transitions to 'connected' when streams are exchanged
3. Updates when remote peer toggles video/audio
4. Destroyed when peer disconnects or leaves room

**Validation Rules**:
- `remotePeerId` must be different from local peer ID
- Cannot have multiple calls to same remote peer
- `remoteStream` must be set when state is 'connected'

### 3. Local Media Stream

**Description**: Represents the local user's camera and microphone stream

**Fields**:
- `stream`: MediaStream - Browser MediaStream instance
- `videoTrack`: MediaStreamTrack | null - Video track
- `audioTrack`: MediaStreamTrack | null - Audio track
- `videoEnabled`: boolean - Whether video is currently enabled
- `audioEnabled`: boolean - Whether audio is currently enabled
- `selectedDeviceId`: string | null - Currently selected camera device ID
- `availableDevices`: MediaDeviceInfo[] - List of available camera devices

**Relationships**:
- Belongs to: Peer Connection
- Shared with: All Media Calls

**Lifecycle**:
1. Created when user starts video
2. Updated when user toggles video/audio or switches camera
3. Destroyed when user stops video or component unmounts

**Validation Rules**:
- Must have at least one track (video or audio)
- `selectedDeviceId` must match one of `availableDevices`
- Video resolution must not exceed 4K (3840x2160)

### 4. Game Room

**Description**: Represents a collection of players who should be connected via WebRTC

**Fields**:
- `roomId`: string - Discord voice channel ID
- `playerIds`: string[] - List of player Discord IDs in the room
- `localPlayerId`: string - Current user's Discord ID

**Relationships**:
- Has many: Players (via Discord integration)
- Determines: Which peers to call

**Lifecycle**:
1. Loaded from Discord voice channel events
2. Updated when players join/leave Discord voice channel
3. Triggers peer connection creation/cleanup

**Validation Rules**:
- `roomId` must be valid Discord voice channel ID
- `playerIds` must not include `localPlayerId`
- Maximum 4 players total (including local player)

## State Management

### Hook State: usePeerJS

```typescript
interface UsePeerJSState {
  // Peer instance
  peer: Peer | null
  peerId: string
  
  // Local media
  localStream: MediaStream | null
  isVideoActive: boolean
  isAudioMuted: boolean
  isVideoEnabled: boolean
  selectedCameraId: string | null
  
  // Remote connections
  calls: Map<string, MediaCall>
  remoteStreams: Map<string, MediaStream | null>
  connectionStates: Map<string, ConnectionState>
  
  // Track states (from remote peers)
  peerTrackStates: Map<string, {
    videoEnabled: boolean
    audioEnabled: boolean
  }>
  
  // Error state
  error: Error | null
}
```

### State Transitions

**Peer Connection States**:
```
disconnected → connecting → connected
                    ↓
                  failed
```

**Media Call States**:
```
connecting → connected → disconnected
    ↓
  failed
```

**Local Stream States**:
```
null → active (video on) → inactive (video off) → null (stopped)
```

## Data Flow

### 1. Initialization Flow

```
Component Mount
    ↓
Create Peer(localPlayerId)
    ↓
Peer 'open' event
    ↓
Ready to receive/make calls
```

### 2. Outgoing Call Flow

```
New player joins Discord voice
    ↓
Get player ID from voice channel events
    ↓
peer.call(playerId, localStream)
    ↓
Store MediaConnection in calls Map
    ↓
MediaConnection 'stream' event
    ↓
Store remote stream in remoteStreams Map
    ↓
Update connectionStates to 'connected'
```

### 3. Incoming Call Flow

```
Peer 'call' event
    ↓
call.answer(localStream)
    ↓
Store MediaConnection in calls Map
    ↓
MediaConnection 'stream' event
    ↓
Store remote stream in remoteStreams Map
    ↓
Update connectionStates to 'connected'
```

### 4. Track State Update Flow

```
Remote peer toggles video/audio
    ↓
Custom signaling message (via PeerJS data channel)
    ↓
Update peerTrackStates Map
    ↓
UI reflects remote peer's track state
```

### 5. Cleanup Flow

```
Player leaves Discord voice
    ↓
Remove from playerIds
    ↓
call.close() for that player
    ↓
Remove from calls Map
    ↓
Remove from remoteStreams Map
    ↓
Remove from connectionStates Map
```

## Constraints

### Performance Constraints

- **Maximum Players**: 4 (mesh topology limitation)
- **Connection Timeout**: 10 seconds
- **Retry Attempts**: 3 with exponential backoff (0s, 2s, 4s)
- **Video Resolution**: Maximum 4K (3840x2160)

### Browser Constraints

- **WebRTC Support**: Required
- **getUserMedia Support**: Required
- **Minimum Versions**: Chrome 74+, Firefox 66+, Safari 12.1+, Edge 79+

### Network Constraints

- **Bandwidth**: ~25 Mbps upload per stream (4K)
- **Total Bandwidth**: ~75 Mbps upload for 4 players
- **Latency**: <200ms for optimal experience

## Error Handling

### Error Types

```typescript
type PeerJSError =
  | 'peer-unavailable'      // Remote peer not found
  | 'network'               // Network connectivity issue
  | 'browser-incompatible'  // Browser doesn't support WebRTC
  | 'unavailable-id'        // Peer ID already in use
  | 'server-error'          // PeerJS server error
  | 'socket-error'          // WebSocket connection error
  | 'socket-closed'         // WebSocket closed unexpectedly
```

### Error Recovery

- **peer-unavailable**: Retry with exponential backoff (3 attempts)
- **network**: Show network error message, retry on reconnection
- **browser-incompatible**: Show upgrade message, disable video features
- **server-error**: Show error message, suggest refresh
- **socket-error/socket-closed**: Automatic reconnection by PeerJS

## Migration Notes

### Data Preserved

- Discord voice channel integration (unchanged)
- Player presence detection (unchanged)
- Video/audio toggle state (same behavior)
- Camera device selection (same behavior)

### Data Removed

- Custom SSE signaling state (replaced by PeerJS)
- Custom peer connection metadata (replaced by PeerJS)
- Manual ICE candidate tracking (handled by PeerJS)
- Manual SDP offer/answer state (handled by PeerJS)

### Data Added

- PeerJS peer instance
- PeerJS MediaConnection instances
- Simplified connection state tracking

## Testing Considerations

### State Validation Tests

- Verify peer initialization with correct ID
- Verify call creation for each remote player
- Verify remote stream assignment
- Verify track state updates
- Verify cleanup on disconnect

### Edge Case Tests

- Multiple simultaneous connections
- Rapid connect/disconnect cycles
- Camera device switching during call
- Video/audio toggle during call
- Network interruption and recovery

### Performance Tests

- Connection establishment time (<3s)
- Memory usage with 4 active connections
- CPU usage with 4 video streams
- Bandwidth usage measurement

# Data Model: WebRTC Video Streaming Architecture

**Feature**: 002-webrtc-refactor-simplify  
**Date**: 2025-11-06  
**Status**: Current State Documentation

## Overview

This document describes the data flow and state management architecture for WebRTC video streaming in Spell Coven. It captures the current implementation patterns to guide refactoring while preserving functional behavior.

**Purpose**: Ensure refactoring maintains correct data flow and state transitions while simplifying implementation.

---

## Core Data Entities

### 1. MediaStream

**Source**: Browser `navigator.mediaDevices.getUserMedia()`  
**Lifecycle**: Created → Active → Stopped  
**Ownership**: Managed by hooks (useWebRTC, useWebcam)

```typescript
interface MediaStream {
  id: string                    // Browser-generated unique ID
  active: boolean               // Whether stream has active tracks
  getTracks(): MediaStreamTrack[] // Video and audio tracks
  getVideoTracks(): MediaStreamTrack[]
  getAudioTracks(): MediaStreamTrack[]
}

interface MediaStreamTrack {
  kind: 'video' | 'audio'
  enabled: boolean              // Muted/unmuted state
  readyState: 'live' | 'ended'
  stop(): void                  // Ends the track permanently
}
```

**Key Relationships**:
- **Local Stream**: One per user session, attached to `<video>` element and all peer connections
- **Remote Streams**: One per remote peer, received via `RTCPeerConnection.ontrack` event
- **Tracks**: Multiple tracks per stream (video + audio), can be individually enabled/disabled

**State Transitions**:
```
[Browser Permission Request]
         ↓
    [getUserMedia]
         ↓
    Active Stream ──────→ Tracks Added to PeerConnections
         ↓
    User Stops Video
         ↓
    Tracks Stopped ──────→ Stream Inactive
```

---

### 2. RTCPeerConnection

**Source**: Browser WebRTC API  
**Lifecycle**: New → Connecting → Connected → Disconnected/Failed → Closed  
**Ownership**: Managed by PeerConnectionManager

```typescript
interface RTCPeerConnection {
  iceConnectionState: RTCIceConnectionState  // Primary state indicator
  connectionState: RTCPeerConnectionState    // Backup state indicator
  
  // Signaling
  createOffer(): Promise<RTCSessionDescriptionInit>
  createAnswer(): Promise<RTCSessionDescriptionInit>
  setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void>
  setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void>
  
  // ICE candidates
  addIceCandidate(candidate: RTCIceCandidate): Promise<void>
  
  // Tracks
  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender
  getSenders(): RTCRtpSender[]
  removeTrack(sender: RTCRtpSender): void
  
  // Events
  onicecandidate: (event: RTCPeerConnectionIceEvent) => void
  ontrack: (event: RTCTrackEvent) => void
  oniceconnectionstatechange: () => void
  onconnectionstatechange: () => void
}

type RTCIceConnectionState = 
  | 'new'           // Just created
  | 'checking'      // Gathering/checking ICE candidates
  | 'connected'     // At least one working candidate pair
  | 'completed'     // All candidates checked, connection established
  | 'failed'        // No working candidate pairs
  | 'disconnected'  // Connection lost (may recover)
  | 'closed'        // Connection closed permanently
```

**Key Relationships**:
- **One per remote peer**: Each player in room has dedicated peer connection
- **Bidirectional media**: Sends local stream tracks, receives remote stream
- **Signaling via SSE**: Offer/answer/ICE candidates exchanged through server

**State Machine** (mapped to app-level PeerConnectionState):
```
        new ──────────→ checking ──────────→ connected ────→ completed
         ↓                                        ↓              ↓
         ↓                                   disconnected ←──────┘
         ↓                                        ↓
         └──────────→ failed ←───────────────────┘
                      ↓
                    closed
                    
App State Mapping:
- new/checking        → 'connecting'
- connected/completed → 'connected'
- failed              → 'failed'
- disconnected        → 'reconnecting'
- closed              → 'disconnected'
```

---

### 3. PeerConnectionData

**Source**: useWebRTC.ts state  
**Purpose**: Combines connection manager, state, and remote stream for each peer

```typescript
interface PeerConnectionData {
  manager: PeerConnectionManager     // Wrapper around RTCPeerConnection
  state: PeerConnectionState         // App-level connection state
  remoteStream: MediaStream | null   // Stream received from peer
}

type PeerConnectionState = 
  | 'connecting'     // Establishing connection
  | 'connected'      // Connection active
  | 'reconnecting'   // Temporary disconnection
  | 'failed'         // Connection failed permanently
  | 'disconnected'   // Connection closed
```

**Storage**: `Map<string, PeerConnectionData>` keyed by remote player ID

**Lifecycle**:
```
[Player Joins Room]
       ↓
[Create PeerConnectionData]
  - manager: new PeerConnectionManager()
  - state: 'connecting'
  - remoteStream: null
       ↓
[Send Offer → Receive Answer → Exchange ICE]
       ↓
[Receive Remote Track]
  - remoteStream: MediaStream from ontrack event
  - state: 'connected'
       ↓
[Player Leaves or Disconnects]
       ↓
[Close and Delete PeerConnectionData]
```

---

### 4. Signaling Messages

**Transport**: Server-Sent Events (SSE) + HTTP POST  
**Format**: JSON with type discriminator

```typescript
// Message envelope
interface SignalingMessageSSE {
  from: string                // Sender player ID
  roomId: string              // Room context
  message: {
    type: 'offer' | 'answer' | 'ice-candidate'
    payload: SDPPayload | IceCandidatePayload
  }
}

// SDP (offer/answer)
interface SDPPayload {
  type: 'offer' | 'answer'
  sdp: string                 // Session description
}

// ICE candidate
interface IceCandidatePayload {
  candidate: string           // ICE candidate string
  sdpMLineIndex: number | null
  sdpMid: string | null
}
```

**Flow**:
```
Offerer (initiator):
1. createOffer() → local SDP
2. setLocalDescription(offer)
3. Send offer via POST /api/webrtc-signaling
4. Receive answer via SSE
5. setRemoteDescription(answer)
6. Exchange ICE candidates via SSE (both directions)

Answerer (receiver):
1. Receive offer via SSE
2. setRemoteDescription(offer)
3. createAnswer() → local SDP
4. setLocalDescription(answer)
5. Send answer via POST /api/webrtc-signaling
6. Exchange ICE candidates via SSE (both directions)
```

---

## State Management Hierarchy

### Component Level: VideoStreamGrid

**State**:
- `streamStates: Record<string, { video: boolean, audio: boolean }>` - UI toggle state
- `playingRemoteVideos: Set<string>` - Which remote videos are actually playing
- Local UI state (camera selection, popover open, etc.)

**Props** (from parent):
- `remoteStreams: Map<string, MediaStream | null>` - From useWebRTC
- `connectionStates: Map<string, PeerConnectionState>` - From useWebRTC
- `onLocalVideoStart: () => Promise<void>` - Triggers useWebRTC.startVideo()
- `onLocalVideoStop: () => void` - Triggers useWebRTC.stopVideo()

**Data Flow**:
```
VideoStreamGrid
    ↓ renders
Local <video> ← videoRef (from useWebcam)
Remote <video>[] ← remoteVideoRefs (from remoteStreams Map)
    ↓ user clicks camera button
onLocalVideoStart() → triggers useWebRTC.startVideo()
    ↓ receives remote streams
remoteStreams Map updated → video elements get srcObject
```

### Hook Level: useWebRTC

**State**:
- `peerConnections: Map<string, PeerConnectionData>` - All peer connections
- `localStream: MediaStream | null` - Local camera/mic stream
- `isVideoActive: boolean` - Whether local video is running
- `isAudioMuted: boolean` - Whether local audio is muted

**State Updates**:
- **On video start**: Create local stream → create peer connections → send offers
- **On peer join**: Create new peer connection → send offer
- **On peer leave**: Close and delete peer connection
- **On signaling message**: Handle offer/answer/ICE candidate
- **On connection state change**: Update peer connection state
- **On remote track**: Update peer connection remote stream

**Event Sources**:
```
User Actions → Component callbacks → Hook state updates
    ↓
SSE Messages → handleSignalingMessage() → Peer connection operations
    ↓
WebRTC Events → PeerConnectionManager callbacks → Hook state updates
```

### Manager Level: PeerConnectionManager

**State**:
- `rtcPeerConnection: RTCPeerConnection` - Native WebRTC connection
- `metadata: PeerConnectionMetadata` - Connection info and state
- `localStream: MediaStream | null` - Tracks attached to this connection
- `remoteStream: MediaStream | null` - Stream received from peer
- Callback sets for state changes and remote stream updates

**State Updates**:
- **On ICE state change**: Map to app state → notify callbacks
- **On track received**: Store remote stream → notify callbacks
- **On ICE candidate**: Forward to signaling layer via callback

**Isolation**: Each PeerConnectionManager operates independently; no shared state between connections.

---

## Data Flow Diagrams

### 1. Video Start Flow

```
[User clicks camera button]
         ↓
VideoStreamGrid.onLocalVideoStart()
         ↓
useWebRTC.startVideo()
         ↓
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
         ↓
setLocalStream(stream)
setIsVideoActive(true)
         ↓
initializePeerConnections(stream)
    ↓ for each remote player
    new PeerConnectionManager()
    manager.addLocalStream(stream)
    manager.onStateChange(callback)
    manager.onRemoteStream(callback)
    manager.onIceCandidate(callback)
    manager.createOffer()
         ↓
    sendOffer(playerId, offer)
         ↓ POST /api/webrtc-signaling
    Server forwards to peer via SSE
         ↓
    [Peer receives offer, sends answer]
         ↓ SSE message
    handleSignalingMessage({ type: 'answer', ... })
    manager.handleAnswer(answer)
         ↓
    [ICE candidates exchanged]
         ↓
    RTCPeerConnection.iceConnectionState → 'connected'
         ↓
    PeerConnectionManager.oniceconnectionstatechange
    updateState('connected')
         ↓ callback
    setPeerConnections(...update state to 'connected')
         ↓ derived map
    connectionStates.set(playerId, 'connected')
         ↓ prop to component
    VideoStreamGrid renders connection indicator
```

### 2. Remote Stream Receive Flow

```
[Peer sends video/audio tracks]
         ↓
RTCPeerConnection.ontrack event
         ↓
PeerConnectionManager.rtcPeerConnection.ontrack = (event) => {
  const stream = event.streams[0]
  this.remoteStream = stream
  this.remoteStreamCallbacks.forEach(cb => cb(stream))
}
         ↓
useWebRTC manager.onRemoteStream(callback)
callback: (stream) => {
  setPeerConnections(prev => {
    updated.set(playerId, { ...existing, remoteStream: stream })
    return updated
  })
}
         ↓ derived map
remoteStreams.set(playerId, stream)
         ↓ prop to component
VideoStreamGrid remoteStreams Map updated
         ↓
useEffect watches remoteStreams changes
         ↓
videoElement.srcObject = stream
         ↓
<video> element onLoadedMetadata fires
         ↓
videoElement.play()
         ↓
Video displays to user
```

### 3. Connection State Update Flow

```
[Network condition changes]
         ↓
RTCPeerConnection.iceConnectionState changes
         ↓
RTCPeerConnection.oniceconnectionstatechange event
         ↓
PeerConnectionManager listener
const appState = this.mapIceStateToAppState(iceState)
this.updateState(appState)
         ↓
PeerConnectionManager.stateChangeCallbacks.forEach(cb => cb(newState))
         ↓
useWebRTC callback registered in initializePeerConnections
callback: (state) => {
  setPeerConnections(prev => {
    updated.set(playerId, { ...existing, state })
    return updated
  })
}
         ↓ derived map
connectionStates.set(playerId, state)
         ↓ prop to component
VideoStreamGrid connectionStates Map updated
         ↓
Component re-renders connection indicator badge
```

---

## Refactoring Impact

### What Stays the Same

1. **Data Structures**: All interfaces remain unchanged
2. **Data Flow**: Same event propagation (WebRTC → Manager → Hook → Component)
3. **State Hierarchy**: Same three-level architecture (Manager → Hook → Component)
4. **Signaling Protocol**: Same message formats and exchange patterns

### What Changes (Internal Only)

1. **Reduced Logging**: State transitions not logged; only errors logged
2. **Consolidated Utilities**: ID normalization and self-connection checks centralized
3. **Simplified Refs**: Video element refs use standard React patterns
4. **Event-Driven State**: Remove polling interval; rely on WebRTC events only
5. **Error Handling**: Centralized at signaling boundary instead of everywhere

### Validation Strategy

**Data Flow Invariants** (must hold after refactoring):
1. Local stream created once per video start
2. One peer connection per remote player (never to self)
3. Remote streams received via ontrack event only
4. Connection state derived from ICE state only (no polling)
5. Video elements receive streams via srcObject only

**Test Validation**:
- Integration tests verify end-to-end data flow
- Manual testing confirms video displays correctly
- Performance benchmarks ensure no timing regressions

---

## Performance Characteristics

### Current Timing

- **getUserMedia**: 100-500ms (browser permission + camera init)
- **Offer/Answer Exchange**: 50-200ms (network RTT + SDP processing)
- **ICE Candidate Exchange**: 100-1000ms (STUN server queries + candidate testing)
- **First Video Frame**: 1500-2500ms total (from button click to remote video)

### Memory Usage

- **Local Stream**: ~5MB (video + audio buffers)
- **Per Peer Connection**: ~2-3MB (buffers + state)
- **4-Player Room**: ~20-25MB total WebRTC memory

### Goals After Refactoring

- Maintain or improve timing (bundle size reduction helps)
- Reduce memory slightly (less code = smaller closure capture)
- Eliminate polling overhead (setInterval every 2s)

---

## Summary

The WebRTC data architecture is fundamentally sound:
- Clear separation of concerns (Manager → Hook → Component)
- Event-driven state propagation from WebRTC APIs
- Proper isolation between peer connections

**Refactoring will improve**:
- Code clarity by removing noise (logging, defensive checks)
- Consistency by centralizing utilities
- Performance by eliminating polling

**Refactoring will NOT change**:
- Data structures or interfaces
- Event flow or state hierarchy
- Signaling protocol or message formats

**Key Insight**: The current implementation has correct architecture buried under excessive defensive programming. Refactoring reveals the clean design by removing cruft, not redesigning fundamentals.


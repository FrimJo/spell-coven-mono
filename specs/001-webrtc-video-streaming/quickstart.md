# Quick Start: WebRTC Video Streaming

**Feature**: 001-webrtc-video-streaming  
**Date**: 2025-01-27

## Overview

This guide provides a quick start for implementing WebRTC peer-to-peer video streaming between players in game rooms.

## Architecture Summary

- **Frontend**: React hooks manage WebRTC peer connections
- **Backend**: TanStack Start routes signaling messages via SSE + createServerFn
- **Signaling**: Separate from Discord (only uses Discord for room membership)
- **UI**: Extends existing VideoStreamGrid component

## Key Components

### 1. WebRTC Hook (`useWebRTC.ts`)

Manages peer connections for all players in room.

```typescript
const {
  peerConnections,      // Map<playerId, PeerConnection>
  localStream,          // MediaStream | null
  connectionStates,     // Map<playerId, ConnectionState>
  startVideo,           // () => Promise<void>
  stopVideo,            // () => void
  toggleAudio,          // () => void
  switchCamera,         // (deviceId: string) => Promise<void>
} = useWebRTC({
  roomId: string,
  localPlayerId: string,
  players: RoomParticipant[],
});
```

### 2. Signaling Hook (`useWebRTCSignaling.ts`)

Handles signaling message send/receive.

```typescript
const {
  sendOffer,            // (to: string, offer: RTCSessionDescription) => Promise<void>
  sendAnswer,           // (to: string, answer: RTCSessionDescription) => Promise<void>
  sendIceCandidate,     // (to: string, candidate: RTCIceCandidate) => Promise<void>
} = useWebRTCSignaling({
  roomId: string,
  localPlayerId: string,
});
```

### 3. Server Function (`webrtc-signaling.server.ts`)

Routes signaling messages between players.

```typescript
export const sendSignalingMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: SignalingMessageRequest) => data)
  .handler(async ({ data }) => {
    // Validate room membership
    // Route message to target player via SSE
    return { success: true };
  });
```

## Implementation Steps

### Step 1: Create WebRTC Hook

1. Create `apps/web/src/hooks/useWebRTC.ts`
2. Initialize RTCPeerConnection for each remote player
3. Handle offer/answer/ICE candidate exchange
4. Manage connection state transitions
5. Cleanup on unmount

### Step 2: Create Signaling Hook

1. Create `apps/web/src/hooks/useWebRTCSignaling.ts`
2. Subscribe to SSE events for signaling messages
3. Implement `sendSignalingMessage` server function calls
4. Filter messages by room and player ID

### Step 3: Create Server Function

1. Create `apps/web/src/server/handlers/webrtc-signaling.server.ts`
2. Implement `sendSignalingMessage` createServerFn
3. Validate room membership
4. Route messages via SSE manager

### Step 4: Extend VideoStreamGrid

1. Modify `apps/web/src/components/VideoStreamGrid.tsx`
2. Add remote stream video elements for each peer
3. Connect peer connections to video elements
4. Display connection status indicators
5. Handle track replacement on camera switch

### Step 5: Integrate with GameRoom

1. Modify `apps/web/src/components/GameRoom.tsx`
2. Initialize `useWebRTC` hook with room players
3. Pass peer streams to VideoStreamGrid
4. Handle player join/leave events

## Connection Flow

```
1. Player joins room
   ↓
2. Get room participants (from Discord/room service)
   ↓
3. For each participant:
   a. Create RTCPeerConnection
   b. Add local stream tracks
   c. Create offer
   d. Send offer via signaling
   ↓
4. Receive answer via SSE
   ↓
5. Set remote description
   ↓
6. Exchange ICE candidates
   ↓
7. Connection established
   ↓
8. Display remote stream in VideoStreamGrid
```

## Key APIs

### RTCPeerConnection

```typescript
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

// Add local stream
localStream.getTracks().forEach(track => {
  pc.addTrack(track, localStream);
});

// Create offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

// Set remote description
await pc.setRemoteDescription(answer);

// Add ICE candidate
await pc.addIceCandidate(candidate);

// Handle remote stream
pc.ontrack = (event) => {
  const remoteStream = event.streams[0];
  // Display in UI
};
```

### Track Replacement (Camera Switch)

```typescript
const videoTrack = newStream.getVideoTracks()[0];
const sender = pc.getSenders().find(s => s.track?.kind === 'video');
if (sender) {
  await sender.replaceTrack(videoTrack);
}
```

## Error Handling

### Permission Denial

```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
} catch (error) {
  if (error.name === 'NotAllowedError') {
    // Show "camera unavailable" status
    // Provide retry button
    // Continue game without video
  }
}
```

### ICE Failure

```typescript
pc.oniceconnectionstatechange = () => {
  if (pc.iceConnectionState === 'failed') {
    // Show "connection failed" error after 30 seconds
    // Provide retry button
    // Continue game without video
  }
};
```

## Testing

### Manual Testing Checklist

- [ ] Two players join same room → both see each other's video
- [ ] Player enables video → other players see stream
- [ ] Player disables video → other players see "video off"
- [ ] Player mutes audio → other players see muted indicator
- [ ] Player switches camera → stream updates seamlessly
- [ ] Player leaves room → stream removed from grid
- [ ] Network interruption → shows "reconnecting", then resumes
- [ ] Permission denied → shows "camera unavailable", game continues
- [ ] ICE failure → shows "connection failed" after 30s, game continues

### Performance Targets

- [ ] 95% connections establish within 10 seconds
- [ ] Video maintains 15+ FPS
- [ ] Connection state changes reflect within 1 second
- [ ] 4 simultaneous streams without degradation

## Next Steps

1. Implement `useWebRTC` hook
2. Implement `useWebRTCSignaling` hook
3. Create server function for signaling
4. Extend VideoStreamGrid component
5. Integrate with GameRoom
6. Test with multiple players
7. Handle edge cases (permissions, failures)

## References

- [Specification](./spec.md)
- [Research](./research.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/signaling-api.md)


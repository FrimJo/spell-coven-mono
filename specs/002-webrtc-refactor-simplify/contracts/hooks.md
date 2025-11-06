# Hook API Contracts

**Feature**: 002-webrtc-refactor-simplify  
**Purpose**: Document hook interfaces that MUST remain stable during refactoring

## useWebRTC Hook

**File**: `apps/web/src/hooks/useWebRTC.ts`

### Public Interface (MUST NOT CHANGE)

```typescript
// Hook input options
interface UseWebRTCOptions {
  roomId: string
  localPlayerId: string
  players: RoomParticipant[]
  enabled?: boolean
}

interface RoomParticipant {
  id: string
  name: string
  isOnline?: boolean
}

// Hook return value
interface UseWebRTCReturn {
  // State
  peerConnections: Map<string, PeerConnectionData>
  localStream: MediaStream | null
  connectionStates: Map<string, PeerConnectionState>
  remoteStreams: Map<string, MediaStream | null>
  isVideoActive: boolean
  isAudioMuted: boolean
  
  // Actions
  startVideo: () => Promise<void>
  stopVideo: () => void
  toggleVideo: () => void
  toggleAudio: () => void
  switchCamera: (deviceId: string) => Promise<void>
}

interface PeerConnectionData {
  manager: PeerConnectionManager
  state: PeerConnectionState
  remoteStream: MediaStream | null
}

type PeerConnectionState = 
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'disconnected'
```

### Export Signature

```typescript
export function useWebRTC(options: UseWebRTCOptions): UseWebRTCReturn
```

### Contract Validation

**Refactoring Rules**:
- ✅ Can change: Internal state management, connection creation logic, event handling
- ✅ Can change: Internal helper functions, effect implementations
- ❌ Cannot change: Options interface, return value interface
- ❌ Cannot change: Map key types (player ID as string)
- ❌ Cannot change: Callback signatures (startVideo, stopVideo, etc.)

**Breaking Changes** (require consumer updates):
- Adding required options
- Removing return values
- Changing return value types
- Changing method signatures

**Non-Breaking Changes** (allowed):
- Adding optional options with defaults
- Adding new return values
- Changing internal implementation
- Performance optimizations

### Integration Points

**Consumers**:
- `apps/web/src/routes/game.$gameId.tsx` - Main game page

**Integration Contract**:
```typescript
// Consumer usage pattern that MUST continue working
const {
  connectionStates,
  remoteStreams,
  startVideo,
  stopVideo,
  isVideoActive
} = useWebRTC({
  roomId: gameId,
  localPlayerId: currentPlayer.id,
  players: allPlayers,
  enabled: true
})

// Pass to VideoStreamGrid
<VideoStreamGrid
  remoteStreams={remoteStreams}
  connectionStates={connectionStates}
  onLocalVideoStart={startVideo}
  onLocalVideoStop={stopVideo}
  // ...
/>
```

### Test Coverage

**Must pass after refactoring**:
- Hook returns expected shape
- startVideo() creates local stream and peer connections
- stopVideo() stops local stream
- Connection states update on peer events
- Remote streams populate when tracks received
- Maps use player ID as string keys
- All callbacks function correctly

---

## useWebRTCSignaling Hook

**File**: `apps/web/src/hooks/useWebRTCSignaling.ts`

### Public Interface (MUST NOT CHANGE)

```typescript
// Hook input options
interface UseWebRTCSignalingOptions {
  roomId: string
  localPlayerId: string
  onSignalingMessage?: (message: SignalingMessageSSE) => void
  enabled?: boolean
}

// Signaling message structure
interface SignalingMessageSSE {
  from: string
  roomId: string
  message: {
    type: 'offer' | 'answer' | 'ice-candidate'
    payload: SDPPayload | IceCandidatePayload
  }
}

interface SDPPayload {
  type: 'offer' | 'answer'
  sdp: string
}

interface IceCandidatePayload {
  candidate: string
  sdpMLineIndex: number | null
  sdpMid: string | null
}

// Hook return value
interface UseWebRTCSignalingReturn {
  sendOffer: (to: string, offer: RTCSessionDescriptionInit) => Promise<void>
  sendAnswer: (to: string, answer: RTCSessionDescriptionInit) => Promise<void>
  sendIceCandidate: (to: string, candidate: RTCIceCandidateInit) => Promise<void>
}
```

### Export Signature

```typescript
export function useWebRTCSignaling(
  options: UseWebRTCSignalingOptions
): UseWebRTCSignalingReturn
```

### Contract Validation

**Refactoring Rules**:
- ✅ Can change: Internal SSE handling, message parsing, error handling
- ✅ Can change: Internal logging, validation logic
- ❌ Cannot change: Options interface, callback signature
- ❌ Cannot change: Return value interface
- ❌ Cannot change: Message format (SignalingMessageSSE)

**Breaking Changes** (require consumer updates):
- Changing message structure
- Changing callback parameters
- Removing send methods
- Changing send method signatures

**Non-Breaking Changes** (allowed):
- Adding optional options
- Improving error messages
- Performance optimizations
- Internal error handling changes

### Integration Points

**Consumers**:
- `apps/web/src/hooks/useWebRTC.ts` - Wraps signaling for peer connections

**Integration Contract**:
```typescript
// Consumer usage pattern that MUST continue working
const { sendOffer, sendAnswer, sendIceCandidate } = useWebRTCSignaling({
  roomId,
  localPlayerId,
  onSignalingMessage: handleSignalingMessage,
  enabled: true
})

// Used in connection lifecycle
manager.createOffer()
  .then(offer => sendOffer(remotePlayerId, offer))
  
manager.onIceCandidate(candidate => {
  if (candidate) {
    sendIceCandidate(remotePlayerId, candidate)
  }
})
```

### Test Coverage

**Must pass after refactoring**:
- Hook returns expected send functions
- SSE connection establishes correctly
- Messages parsed and delivered to callback
- sendOffer() sends via server function
- sendAnswer() sends via server function
- sendIceCandidate() sends via server function
- Error handling preserves throw behavior

---

## useWebcam Hook

**File**: `apps/web/src/lib/webcam.ts` (exports `setupWebcam`, used by `useWebcam` wrapper)

**Note**: This refactoring primarily targets WebRTC code. Webcam module changes are limited to removing unused features and blob logging. Core contract remains unchanged.

### Public Interface (MUST NOT CHANGE)

```typescript
// Setup function signature
async function setupWebcam(args: {
  video: HTMLVideoElement
  overlay: HTMLCanvasElement
  cropped: HTMLCanvasElement
  fullRes: HTMLCanvasElement
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
  onCrop?: (canvas: HTMLCanvasElement) => void
  onProgress?: (msg: string) => void
}): Promise<WebcamControls>

// Return value
interface WebcamControls {
  startVideo: (deviceId?: string | null) => Promise<void>
  getCameras: () => Promise<MediaDeviceInfo[]>
  getCurrentDeviceId: () => string | null
  getCroppedCanvas: () => HTMLCanvasElement
  stopDetection: () => void
}
```

### Contract Validation

**Refactoring Changes**:
- Remove: Video file source support
- Remove: Performance metrics tracking
- Remove: Blob URL logging
- Keep: All public methods and signatures

**Test Coverage**:
- startVideo() acquires camera
- getCameras() enumerates devices
- Card detection works on click
- Cropped canvas available after detection

---

## Contract Compliance Checklist

Before completing refactoring:
- [ ] useWebRTC options and return value unchanged
- [ ] useWebRTCSignaling options and return value unchanged
- [ ] setupWebcam signature unchanged
- [ ] All PeerConnectionData, SignalingMessageSSE types unchanged
- [ ] All Map key types consistent (string for player IDs)
- [ ] All existing consumers work without changes
- [ ] Type checking passes for all consumers


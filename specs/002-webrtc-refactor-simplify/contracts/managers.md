# Manager API Contracts

**Feature**: 002-webrtc-refactor-simplify  
**Purpose**: Document manager class interfaces that MUST remain stable during refactoring

## PeerConnectionManager Class

**File**: `apps/web/src/lib/webrtc/peer-connection.ts`

### Public Interface (MUST NOT CHANGE)

```typescript
// Constructor configuration
interface PeerConnectionConfig {
  localPlayerId: string
  remotePlayerId: string
  roomId: string
}

// Metadata structure
interface PeerConnectionMetadata {
  id: string
  localPlayerId: string
  remotePlayerId: string
  roomId: string
  state: PeerConnectionState
  createdAt: number
  lastStateChange: number
}

type PeerConnectionState = 
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'disconnected'

// Class interface
class PeerConnectionManager {
  constructor(config: PeerConnectionConfig)
  
  // Stream management
  addLocalStream(stream: MediaStream): void
  removeLocalStream(): void
  
  // Signaling
  createOffer(): Promise<RTCSessionDescriptionInit>
  handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>
  handleAnswer(answer: RTCSessionDescriptionInit): Promise<void>
  handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void>
  
  // Track management
  replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void>
  
  // State access
  getRTCPeerConnection(): RTCPeerConnection
  getMetadata(): PeerConnectionMetadata
  getState(): PeerConnectionState
  getLocalStream(): MediaStream | null
  getRemoteStream(): MediaStream | null
  
  // Event registration
  onStateChange(callback: (state: PeerConnectionState) => void): () => void
  onRemoteStream(callback: (stream: MediaStream | null) => void): () => void
  onIceCandidate(callback: (candidate: RTCIceCandidateInit | null) => void): () => void
  
  // Lifecycle
  close(): void
}
```

### Export Signature

```typescript
export class PeerConnectionManager {
  // ... (full interface above)
}
```

### Contract Validation

**Refactoring Rules**:
- ✅ Can change: Internal event listener setup, state mapping logic, logging
- ✅ Can change: Private methods, internal state management
- ❌ Cannot change: Public method signatures
- ❌ Cannot change: Constructor signature
- ❌ Cannot change: Callback signatures
- ❌ Cannot change: Return types

**Breaking Changes** (require consumer updates):
- Changing method signatures
- Removing public methods
- Changing constructor parameters
- Changing callback types
- Changing return types

**Non-Breaking Changes** (allowed):
- Adding new public methods
- Adding private methods
- Changing internal implementation
- Performance optimizations
- Improving error messages

### Integration Points

**Consumers**:
- `apps/web/src/hooks/useWebRTC.ts` - Creates and manages instances

**Integration Contract**:
```typescript
// Consumer usage pattern that MUST continue working

// 1. Create manager
const manager = new PeerConnectionManager({
  localPlayerId,
  remotePlayerId,
  roomId
})

// 2. Setup callbacks
manager.onStateChange((state) => {
  // Update UI state
})

manager.onRemoteStream((stream) => {
  // Display remote video
})

manager.onIceCandidate((candidate) => {
  if (candidate) {
    // Send via signaling
  }
})

// 3. Add local media
manager.addLocalStream(localStream)

// 4. Signaling flow (initiator)
const offer = await manager.createOffer()
// ... send offer via signaling ...
// ... receive answer via signaling ...
await manager.handleAnswer(answer)

// 5. Signaling flow (receiver)
// ... receive offer via signaling ...
const answer = await manager.handleOffer(offer)
// ... send answer via signaling ...

// 6. ICE candidate exchange
// ... receive candidate via signaling ...
await manager.handleIceCandidate(candidate)

// 7. Cleanup
manager.close()
```

### State Machine Contract

**ICE Connection State → App State Mapping** (MUST remain consistent):

```typescript
RTCIceConnectionState → PeerConnectionState:
- 'new'           → 'connecting'
- 'checking'      → 'connecting'
- 'connected'     → 'connected'
- 'completed'     → 'connected'
- 'failed'        → 'failed'
- 'disconnected'  → 'reconnecting'
- 'closed'        → 'disconnected'
```

**State Transition Events**:
- State changes trigger `onStateChange` callbacks
- Remote track received triggers `onRemoteStream` callback
- ICE candidates trigger `onIceCandidate` callback

### Method Contracts

#### addLocalStream(stream: MediaStream): void
- **Pre**: stream is valid MediaStream
- **Post**: All tracks added to RTCPeerConnection
- **Side Effects**: Tracks become available to remote peer
- **Errors**: None thrown (should not fail)

#### createOffer(): Promise<RTCSessionDescriptionInit>
- **Pre**: Connection created
- **Post**: Local description set, offer returned
- **Side Effects**: RTCPeerConnection.localDescription set
- **Errors**: Throws on WebRTC API failure

#### handleOffer(offer): Promise<RTCSessionDescriptionInit>
- **Pre**: offer is valid SDP
- **Post**: Remote description set, answer created and set locally
- **Side Effects**: RTCPeerConnection descriptions set
- **Errors**: Throws on WebRTC API failure
- **Returns**: Answer to send back to offerer

#### handleAnswer(answer): Promise<void>
- **Pre**: answer is valid SDP, offer was sent previously
- **Post**: Remote description set
- **Side Effects**: RTCPeerConnection.remoteDescription set
- **Errors**: Throws on WebRTC API failure

#### handleIceCandidate(candidate): Promise<void>
- **Pre**: candidate is valid ICE candidate
- **Post**: Candidate added to connection
- **Side Effects**: ICE gathering may complete
- **Errors**: Logs but does not throw (ICE errors are non-fatal)

#### close(): void
- **Pre**: Connection exists
- **Post**: Connection closed, callbacks cleared
- **Side Effects**: Local stream tracks stopped, state → 'disconnected'
- **Errors**: None thrown

### Test Coverage

**Must pass after refactoring**:
- Constructor creates valid instance
- addLocalStream() adds tracks correctly
- createOffer() returns valid SDP
- handleOffer() returns valid answer
- handleAnswer() sets remote description
- handleIceCandidate() adds candidates
- State transitions fire callbacks
- Remote stream callback fires on track
- ICE candidate callback fires
- close() cleans up properly
- No memory leaks from callbacks

---

## Contract Compliance Checklist

Before completing refactoring:
- [ ] PeerConnectionManager constructor signature unchanged
- [ ] All public method signatures unchanged
- [ ] All callback signatures unchanged
- [ ] PeerConnectionConfig interface unchanged
- [ ] PeerConnectionMetadata interface unchanged
- [ ] State machine mapping unchanged
- [ ] All return types unchanged
- [ ] All error throwing behavior unchanged
- [ ] All existing consumers work without changes
- [ ] Type checking passes for all consumers


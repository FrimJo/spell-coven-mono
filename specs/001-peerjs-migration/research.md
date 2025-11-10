# Research: PeerJS WebRTC Migration

**Feature**: 001-peerjs-migration  
**Date**: 2025-11-10  
**Status**: Complete

## Overview

Research findings for migrating from custom WebRTC implementation to PeerJS library, focusing on best practices, integration patterns, and migration strategy.

## Technology Decisions

### Decision 1: PeerJS Library Selection

**Decision**: Use PeerJS (^1.5.4) as the WebRTC abstraction library

**Rationale**:
- Battle-tested library with 20.7k+ GitHub dependents
- Provides complete abstraction over WebRTC complexity (signaling, ICE, SDP)
- Built-in signaling server (cloud or self-hosted options)
- Simple API for mesh topology: `peer.call(id, stream)`
- Automatic reconnection and error handling
- Active maintenance and community support

**Alternatives Considered**:
- **Simple-Peer**: Simpler but requires custom signaling server implementation
- **PeerJS-Server (self-hosted)**: Considered for future migration, not initial implementation
- **Raw WebRTC API**: Current approach, too complex (1000+ lines)
- **Peers-web library**: Less mature, smaller community

### Decision 2: Signaling Strategy

**Decision**: Use PeerJS cloud signaling service initially

**Rationale**:
- Zero infrastructure setup required
- Free tier sufficient for 2-4 player rooms
- Allows rapid development and testing
- Migration path to self-hosted available if needed
- Reduces operational complexity for MVP

**Alternatives Considered**:
- **Self-hosted PeerJS server**: Adds deployment complexity, deferred to future
- **Custom SSE signaling**: Current approach, being removed
- **WebSocket signaling**: Requires custom server implementation

### Decision 3: Migration Approach

**Decision**: Big bang replacement with thorough staging testing

**Rationale**:
- Cleaner codebase (no feature flags or dual implementations)
- Faster completion (no incremental complexity)
- Simpler testing (single implementation to validate)
- Lower maintenance burden post-migration
- Acceptable risk given thorough staging validation

**Alternatives Considered**:
- **Incremental migration**: Adds complexity with dual implementations
- **Parallel run**: Requires maintaining both systems simultaneously
- **Feature flag toggle**: Adds code complexity and testing burden

## Integration Patterns

### Pattern 1: PeerJS Hook Wrapper

**Pattern**: Create `usePeerJS` React hook that wraps PeerJS library

**Implementation**:
```typescript
interface UsePeerJSOptions {
  roomId: string
  localPlayerId: string
}

function usePeerJS({ roomId, localPlayerId }: UsePeerJSOptions) {
  // Initialize peer with player ID
  const peer = new Peer(localPlayerId)
  
  // Handle incoming calls
  peer.on('call', (call) => {
    call.answer(localStream)
    call.on('stream', (remoteStream) => {
      // Add to remote streams map
    })
  })
  
  // Call other players
  const callPeer = (peerId: string) => {
    const call = peer.call(peerId, localStream)
    call.on('stream', (remoteStream) => {
      // Add to remote streams map
    })
  }
  
  return { peer, remoteStreams, callPeer, ... }
}
```

**Benefits**:
- Encapsulates PeerJS complexity
- Provides React-friendly API
- Manages connection lifecycle
- Handles cleanup on unmount

### Pattern 2: Discord Integration Preservation

**Pattern**: Keep existing `useVoiceChannelMembersFromEvents` hook unchanged

**Implementation**:
- Discord voice channel events continue to provide player list
- `usePeerJS` hook receives player IDs from Discord integration
- When new player joins Discord voice → automatically call them via PeerJS
- When player leaves Discord voice → clean up PeerJS connection

**Benefits**:
- Zero changes to Discord integration
- Maintains existing player presence detection
- Separates concerns (Discord = presence, PeerJS = video)

### Pattern 3: Connection Lifecycle Management

**Pattern**: Implement retry logic and timeouts in `usePeerJS` hook

**Implementation**:
```typescript
const connectWithRetry = async (peerId: string, attempts = 3) => {
  for (let i = 0; i < attempts; i++) {
    try {
      const call = peer.call(peerId, localStream, {
        connectionTimeout: 10000 // 10 second timeout
      })
      
      await waitForConnection(call)
      return call
    } catch (error) {
      if (i < attempts - 1) {
        await delay(Math.pow(2, i) * 1000) // Exponential backoff
      }
    }
  }
  throw new Error('Connection failed after retries')
}
```

**Benefits**:
- Handles transient network issues
- Provides user feedback on failures
- Prevents infinite retry loops

## Best Practices

### Practice 1: Video Quality Constraints

**Recommendation**: Enforce 4K maximum resolution via getUserMedia constraints

**Implementation**:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 3840, max: 3840 },
    height: { ideal: 2160, max: 2160 }
  },
  audio: true
})
```

**Rationale**:
- Prevents bandwidth saturation in mesh topology
- Ensures stable connections for all 4 players
- Balances quality with performance

### Practice 2: Error Handling

**Recommendation**: Implement comprehensive error handling for all PeerJS events

**Key Error Scenarios**:
- Peer connection failures
- Signaling server unavailable
- Browser doesn't support WebRTC
- User denies camera/microphone permissions
- Network connectivity issues

**Implementation**:
```typescript
peer.on('error', (error) => {
  switch (error.type) {
    case 'peer-unavailable':
      // Handle peer not found
    case 'network':
      // Handle network issues
    case 'browser-incompatible':
      // Show browser upgrade message
    default:
      // Generic error handling
  }
})
```

### Practice 3: Testing Strategy

**Recommendation**: Test with multiple browsers and network conditions

**Test Scenarios**:
- 2-4 players joining simultaneously
- Players joining/leaving mid-session
- Network throttling (slow 3G, fast 3G, 4G)
- Browser compatibility (Chrome, Firefox, Safari, Edge)
- Camera device switching during active call
- Audio/video toggle during active call

## Performance Considerations

### Consideration 1: Mesh Topology Limitations

**Finding**: Mesh topology scales poorly beyond 4 players

**Analysis**:
- Each player maintains N-1 connections (3 connections for 4 players)
- Bandwidth requirement: O(N²) for N players
- 4K video requires ~25 Mbps upload per stream
- 4 players = 75 Mbps upload bandwidth required

**Mitigation**:
- Enforce 4-player maximum (already in spec)
- Consider SFU (Selective Forwarding Unit) for future scaling
- Monitor connection quality and auto-downgrade resolution if needed

### Consideration 2: Connection Establishment Time

**Finding**: PeerJS connection establishment typically takes 1-2 seconds

**Analysis**:
- ICE candidate gathering: 500-1000ms
- Signaling round-trip: 200-500ms
- Connection establishment: 300-500ms
- Total: ~1-2 seconds (well under 3-second requirement)

**Optimization**:
- Use STUN servers for faster ICE gathering
- Parallel connection establishment for multiple peers
- Pre-warm connections when player list changes

## Migration Risks & Mitigation

### Risk 1: PeerJS Cloud Service Outage

**Likelihood**: Low (99.9% uptime SLA)  
**Impact**: High (complete video failure)

**Mitigation**:
- Monitor PeerJS service status
- Implement graceful degradation (show error message)
- Plan migration to self-hosted server if reliability issues occur
- Document self-hosting procedure in quickstart guide

### Risk 2: Browser Compatibility Issues

**Likelihood**: Medium (older browsers may lack WebRTC support)  
**Impact**: Medium (some users unable to use video)

**Mitigation**:
- Detect WebRTC support on page load
- Show clear upgrade message for unsupported browsers
- Document minimum browser versions in quickstart
- Test on all major browsers during staging

### Risk 3: Network Bandwidth Limitations

**Likelihood**: Medium (users on slow connections)  
**Impact**: Medium (poor video quality or connection failures)

**Mitigation**:
- Implement adaptive bitrate (auto-downgrade resolution)
- Show network quality indicator to users
- Provide manual quality settings
- Document bandwidth requirements in quickstart

## Dependencies

### Required npm Packages

```json
{
  "dependencies": {
    "peerjs": "^1.5.4"
  }
}
```

### Browser Requirements

- Chrome 74+
- Firefox 66+
- Safari 12.1+
- Edge 79+

All browsers must support:
- WebRTC API
- getUserMedia API
- RTCPeerConnection API

## Next Steps

1. **Phase 1**: Create data model and contracts
2. **Phase 1**: Generate quickstart guide
3. **Phase 2**: Create detailed implementation tasks
4. **Implementation**: Build `usePeerJS` hook
5. **Implementation**: Update `GameRoom` and `VideoStreamGrid` components
6. **Testing**: Comprehensive staging validation
7. **Deployment**: Big bang production release
8. **Cleanup**: Remove old WebRTC files

## References

- [PeerJS Documentation](https://peerjs.com/docs/)
- [PeerJS GitHub](https://github.com/peers/peerjs)
- [WebRTC Best Practices](https://webrtc.org/getting-started/overview)
- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)

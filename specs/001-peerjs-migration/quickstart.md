# Quickstart: PeerJS WebRTC Migration

**Feature**: 001-peerjs-migration  
**Date**: 2025-11-10  
**For**: Developers implementing the PeerJS migration

## Overview

This guide provides step-by-step instructions for migrating from the custom WebRTC implementation to PeerJS.

## Prerequisites

### Required Knowledge
- TypeScript/React fundamentals
- React Hooks (useState, useEffect, useCallback)
- WebRTC concepts (media streams, peer connections)
- Existing codebase familiarity

### Required Tools
- Node.js 18+ with pnpm
- Modern browser (Chrome 74+, Firefox 66+, Safari 12.1+, Edge 79+)
- Access to Discord voice channel for testing

### Environment Setup
```bash
# Install PeerJS dependency
pnpm add peerjs@^1.5.4

# Install type definitions
pnpm add -D @types/peerjs
```

## Implementation Steps

### Step 1: Create usePeerJS Hook

**File**: `apps/web/src/hooks/usePeerJS.ts`

**Key Requirements**:
- Initialize PeerJS peer with local player ID
- Handle incoming and outgoing calls
- Manage local media stream (camera/mic)
- Track remote streams and connection states
- Implement retry logic (3 attempts, exponential backoff)
- Implement 10-second connection timeout
- Broadcast track state changes to peers

**Reference Implementation Pattern**:
```typescript
export function usePeerJS({ roomId, localPlayerId, remotePlayerIds }: UsePeerJSOptions) {
  const [peer, setPeer] = useState<Peer | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream | null>>(new Map())
  
  // Initialize peer
  useEffect(() => {
    const newPeer = new Peer(localPlayerId)
    
    newPeer.on('open', (id) => {
      console.log('Peer connected:', id)
      setPeer(newPeer)
    })
    
    newPeer.on('call', (call) => {
      // Answer incoming call
      call.answer(localStream)
      
      call.on('stream', (remoteStream) => {
        setRemoteStreams(prev => new Map(prev).set(call.peer, remoteStream))
      })
    })
    
    return () => newPeer.destroy()
  }, [localPlayerId])
  
  // Call remote peers when they join
  useEffect(() => {
    if (!peer || !localStream) return
    
    remotePlayerIds.forEach(peerId => {
      const call = peer.call(peerId, localStream)
      
      call.on('stream', (remoteStream) => {
        setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream))
      })
    })
  }, [peer, localStream, remotePlayerIds])
  
  // ... rest of implementation
}
```

**See**: `contracts/usePeerJS-hook.ts` for complete API contract

### Step 2: Update GameRoom Component

**File**: `apps/web/src/components/GameRoom.tsx`

**Changes Required**:
1. Replace `useWebRTC` import with `usePeerJS`
2. Update hook call with new API
3. Remove SSE signaling logic
4. Simplify connection state handling

**Before**:
```typescript
const {
  peerConnections,
  localStream,
  connectionStates,
  remoteStreams,
  startVideo,
  stopVideo,
  toggleVideo,
  toggleAudio,
  switchCamera,
  isVideoActive,
  isAudioMuted,
  isVideoEnabled,
} = useWebRTC({
  roomId,
  localPlayerId,
})
```

**After**:
```typescript
const {
  localStream,
  remoteStreams,
  connectionStates,
  peerTrackStates,
  startVideo,
  stopVideo,
  toggleVideo,
  toggleAudio,
  switchCamera,
  isVideoActive,
  isAudioMuted,
  isVideoEnabled,
  error,
} = usePeerJS({
  roomId,
  localPlayerId,
  remotePlayerIds: members.map(m => m.id).filter(id => id !== localPlayerId),
  autoStart: true,
})
```

### Step 3: Update VideoStreamGrid Component

**File**: `apps/web/src/components/VideoStreamGrid.tsx`

**Changes Required**:
1. Simplify peer connection handling
2. Remove custom connection state logic
3. Use `remoteStreams` Map directly
4. Use `peerTrackStates` for video/audio indicators

**Before**:
```typescript
const connectionData = peerConnections.get(playerId)
const stream = connectionData?.remoteStream
const videoEnabled = connectionData?.videoEnabled
```

**After**:
```typescript
const stream = remoteStreams.get(playerId)
const trackState = peerTrackStates.get(playerId)
const videoEnabled = trackState?.videoEnabled ?? true
```

### Step 4: Remove Old Files

**Files to Delete**:
```bash
# Remove custom WebRTC implementation
rm apps/web/src/hooks/useWebRTC.ts
rm apps/web/src/hooks/useWebRTCSignaling.ts
rm apps/web/src/lib/webrtc/peer-connection.ts
rm apps/web/src/lib/webrtc/signaling.ts
rm apps/web/src/lib/webrtc/types.ts
rm apps/web/src/lib/webrtc/utils.ts
rm apps/web/src/server/handlers/webrtc-signaling.server.ts

# Remove webrtc directory if empty
rmdir apps/web/src/lib/webrtc
```

**Files to Keep**:
- `apps/web/src/hooks/useVoiceChannelMembersFromEvents.ts` (Discord integration)
- `apps/web/src/server/managers/sse-manager.ts` (used by other features)

### Step 5: Add Tests

**File**: `apps/web/tests/hooks/usePeerJS.test.ts`

**Test Coverage Required**:
- Peer initialization
- Incoming call handling
- Outgoing call creation
- Remote stream assignment
- Connection state transitions
- Retry logic (3 attempts)
- Timeout handling (10 seconds)
- Track state updates
- Error handling
- Cleanup on unmount

**Example Test**:
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { usePeerJS } from '@/hooks/usePeerJS'

describe('usePeerJS', () => {
  it('initializes peer with local player ID', async () => {
    const { result } = renderHook(() => usePeerJS({
      roomId: 'test-room',
      localPlayerId: 'player-1',
      remotePlayerIds: [],
    }))
    
    await waitFor(() => {
      expect(result.current.peer).not.toBeNull()
      expect(result.current.peerId).toBe('player-1')
    })
  })
  
  // ... more tests
})
```

## Testing Checklist

### Unit Tests
- [ ] Peer initialization
- [ ] Call creation and answering
- [ ] Stream management
- [ ] Connection state tracking
- [ ] Retry logic
- [ ] Timeout handling
- [ ] Error handling
- [ ] Cleanup

### Integration Tests
- [ ] 2-player connection
- [ ] 4-player mesh connection
- [ ] Player join mid-session
- [ ] Player leave mid-session
- [ ] Camera device switching
- [ ] Video/audio toggle
- [ ] Network interruption recovery

### Browser Compatibility Tests
- [ ] Chrome 74+
- [ ] Firefox 66+
- [ ] Safari 12.1+
- [ ] Edge 79+

### Performance Tests
- [ ] Connection establishment < 3 seconds
- [ ] Connection success rate ≥ 95%
- [ ] 4K video support
- [ ] Memory usage with 4 connections
- [ ] CPU usage with 4 video streams

## Deployment Steps

### 1. Staging Validation

```bash
# Build for staging
pnpm build

# Deploy to staging environment
# (deployment command depends on your infrastructure)

# Test with real users
# - 2-player scenario
# - 4-player scenario
# - Network throttling
# - Multiple browsers
```

### 2. Production Deployment

**Pre-deployment Checklist**:
- [ ] All staging tests passed
- [ ] No regressions in video functionality
- [ ] Performance metrics met
- [ ] Error handling validated
- [ ] Browser compatibility confirmed

**Deployment**:
```bash
# Build for production
pnpm build

# Deploy to production
# (deployment command depends on your infrastructure)
```

**Post-deployment Monitoring**:
- Monitor error rates
- Track connection success rates
- Measure connection establishment times
- Watch for PeerJS service issues

### 3. Rollback Plan

**If critical issues occur**:

Since we chose "no fallback" strategy, rollback requires redeployment:

```bash
# Revert to previous commit
git revert <migration-commit-sha>

# Rebuild and redeploy
pnpm build
# deploy command
```

**Note**: This is why thorough staging validation is critical.

## Configuration

### PeerJS Cloud Service

**Default Configuration** (no setup required):
```typescript
const peer = new Peer(localPlayerId) // Uses PeerJS cloud
```

**Custom Configuration** (if needed):
```typescript
const peer = new Peer(localPlayerId, {
  host: 'peerjs-server.example.com',  // Self-hosted server
  port: 9000,
  path: '/myapp',
  secure: true,
})
```

### Video Quality Constraints

**Enforce 4K Maximum**:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 3840, max: 3840 },
    height: { ideal: 2160, max: 2160 },
  },
  audio: true,
})
```

### Connection Timeouts

**10-Second Timeout**:
```typescript
const connectWithTimeout = (call: MediaConnection) => {
  return Promise.race([
    waitForStream(call),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    ),
  ])
}
```

### Retry Logic

**3 Attempts with Exponential Backoff**:
```typescript
const delays = [0, 2000, 4000] // 0s, 2s, 4s

for (let i = 0; i < 3; i++) {
  try {
    await connectToPeer(peerId)
    return // Success
  } catch (error) {
    if (i < 2) await delay(delays[i + 1])
  }
}
throw new Error('Max retries exceeded')
```

## Troubleshooting

### Issue: Peer connection fails immediately

**Symptoms**: Connection state goes directly to 'failed'

**Possible Causes**:
- PeerJS cloud service unavailable
- Network firewall blocking WebRTC
- Invalid peer ID

**Solutions**:
1. Check PeerJS service status
2. Verify network allows WebRTC traffic
3. Ensure peer IDs are unique and valid

### Issue: Video stream not appearing

**Symptoms**: Connection succeeds but no video shows

**Possible Causes**:
- Camera permissions denied
- Wrong video element srcObject assignment
- Track is disabled

**Solutions**:
1. Check browser permissions
2. Verify `srcObject` is set correctly
3. Check track enabled state

### Issue: Connection timeout after 10 seconds

**Symptoms**: All connections timeout

**Possible Causes**:
- Poor network conditions
- STUN/TURN server issues
- Firewall blocking ICE candidates

**Solutions**:
1. Test network quality
2. Configure TURN server if needed
3. Check firewall settings

## Migration Metrics

### Success Criteria

Track these metrics post-migration:

- **Code Reduction**: 70-80% reduction (target: ~100-200 lines)
- **File Count**: 40-60% reduction (target: 2-3 files)
- **Connection Time**: <3 seconds (measure with performance.now())
- **Success Rate**: ≥95% (track failed connections)
- **Developer Onboarding**: <30 minutes to understand code

### Monitoring

**Key Metrics to Monitor**:
```typescript
// Connection establishment time
const startTime = performance.now()
await connectToPeer(peerId)
const duration = performance.now() - startTime
console.log(`Connection time: ${duration}ms`)

// Connection success rate
const totalAttempts = attempts.length
const successfulAttempts = attempts.filter(a => a.success).length
const successRate = (successfulAttempts / totalAttempts) * 100
console.log(`Success rate: ${successRate}%`)
```

## Resources

### Documentation
- [PeerJS Documentation](https://peerjs.com/docs/)
- [PeerJS API Reference](https://peerjs.com/docs/#api)
- [WebRTC Best Practices](https://webrtc.org/getting-started/overview)

### Code References
- Specification: `specs/001-peerjs-migration/spec.md`
- Research: `specs/001-peerjs-migration/research.md`
- Data Model: `specs/001-peerjs-migration/data-model.md`
- API Contract: `specs/001-peerjs-migration/contracts/usePeerJS-hook.ts`

### Support
- PeerJS GitHub Issues: https://github.com/peers/peerjs/issues
- WebRTC Community: https://webrtc.org/support/

## Next Steps

After completing this migration:

1. **Monitor Production**: Track metrics for 1-2 weeks
2. **Gather Feedback**: Collect user feedback on video quality
3. **Optimize**: Address any performance issues
4. **Document Learnings**: Update this guide with lessons learned
5. **Consider Self-Hosting**: Evaluate if PeerJS cloud meets needs or if self-hosting is required

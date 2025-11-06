# WebRTC Refactor Migration Guide

**Version**: 1.0  
**Date**: November 6, 2025  
**Branch**: `002-webrtc-refactor-simplify`

## Overview

This guide documents the changes made during the WebRTC refactoring and how they affect the codebase.

## Breaking Changes

**None** - This is a pure refactoring with no breaking changes to the public API.

## Key Changes

### 1. Shared Utilities (New)

**File**: `/apps/web/src/lib/webrtc/utils.ts`

Three new utility functions are now available:

#### `normalizePlayerId(id: string | number | undefined): string`
Normalizes player IDs to strings for consistent comparison.

**Before**:
```typescript
const normalizedId = String(playerId)
```

**After**:
```typescript
import { normalizePlayerId } from '@/lib/webrtc/utils'
const normalizedId = normalizePlayerId(playerId)
```

#### `isSelfConnection(localId: string | number, remoteId: string | number): boolean`
Checks if two player IDs represent the same player.

**Before**:
```typescript
if (normalizePlayerId(localId) === normalizePlayerId(remoteId)) {
  // self-connection
}
```

**After**:
```typescript
import { isSelfConnection } from '@/lib/webrtc/utils'
if (isSelfConnection(localId, remoteId)) {
  // self-connection
}
```

#### `createPeerConnectionWithCallbacks(config): PeerConnectionManager`
Creates a peer connection with all callbacks configured.

**Before**:
```typescript
const manager = new PeerConnectionManager({ ... })
manager.addLocalStream(stream)
manager.onStateChange(callback)
manager.onRemoteStream(callback)
manager.onIceCandidate(callback)
```

**After**:
```typescript
import { createPeerConnectionWithCallbacks } from '@/lib/webrtc/utils'
const manager = createPeerConnectionWithCallbacks({
  localPlayerId,
  remotePlayerId,
  roomId,
  localStream,
  onStateChange,
  onRemoteStream,
  onIceCandidate,
})
```

### 2. Removed Polling

**Removed**: State sync polling interval from `useWebRTC.ts`

**Impact**: 
- No more `setInterval` for state synchronization
- All state updates now event-driven via callbacks
- Reduced server load and memory usage

**Migration**: None required - automatic via event listeners

### 3. Removed Retry Mechanism

**Removed**: Pending offers retry mechanism from `useWebRTC.ts`

**Before**:
```typescript
const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map())
// ... retry logic when players come online
```

**After**:
```typescript
// Offers sent immediately when connections created
// No retry needed - connection establishment handles timing
```

**Migration**: None required - offers sent on connection creation

### 4. Removed Self-Connection Cleanup

**Removed**: Self-connection cleanup useEffect from `useWebRTC.ts`

**Before**:
```typescript
useEffect(() => {
  // Clean up any self-connections that were created
  setPeerConnections((prev) => {
    // ... cleanup logic
  })
}, [localPlayerId, peerConnections])
```

**After**:
```typescript
// Self-connections prevented at creation time via isSelfConnection checks
// No cleanup needed
```

**Migration**: None required - prevention is now in place

### 5. Removed Defensive State Checks

**Removed**: Defensive state checks after setup and callback registration

**Before**:
```typescript
// Immediately check and update state in case it changed during setup
const currentIceState = this.rtcPeerConnection.iceConnectionState
const currentAppState = this.mapIceStateToAppState(currentIceState)
if (currentAppState !== initialState) {
  this.updateState(currentAppState)
}

// Check current state after setup (in case it changed during callback registration)
setTimeout(() => {
  const currentState = manager.getState()
  if (currentState !== initialState) {
    setPeerConnections((prev) => { ... })
  }
}, 0)
```

**After**:
```typescript
// Event listeners handle all state changes
// No defensive checks needed
```

**Migration**: None required - event listeners are sufficient

### 6. Simplified Connection State Listeners

**Removed**: Duplicate `onconnectionstatechange` listener

**Before**:
```typescript
this.rtcPeerConnection.oniceconnectionstatechange = () => { ... }
this.rtcPeerConnection.onconnectionstatechange = () => { ... } // backup
```

**After**:
```typescript
this.rtcPeerConnection.oniceconnectionstatechange = () => { ... } // primary only
```

**Migration**: None required - `oniceconnectionstatechange` is sufficient

## File Changes Summary

### Modified Files

| File | Changes | Impact |
|------|---------|--------|
| `useWebRTC.ts` | Removed polling, retry, cleanup, defensive checks | -357 lines |
| `peer-connection.ts` | Removed defensive checks, duplicate listeners | -92 lines |
| `VideoStreamGrid.tsx` | No changes in Phase 5 | -187 lines (from US1) |
| `useWebRTCSignaling.ts` | Centralized error handling | -42 lines |
| `webcam.ts` | No changes in Phase 5 | -182 lines (from US1) |

### New Files

| File | Purpose | Size |
|------|---------|------|
| `utils.ts` | Shared utilities | 82 lines |

## Import Changes

### useWebRTC.ts

**Before**:
```typescript
import { PeerConnectionManager } from '@/lib/webrtc/peer-connection'
```

**After**:
```typescript
import { PeerConnectionManager } from '@/lib/webrtc/peer-connection'
import { isSelfConnection, normalizePlayerId, createPeerConnectionWithCallbacks } from '@/lib/webrtc/utils'
```

### useWebRTCSignaling.ts

**Before**:
```typescript
// No imports from utils
```

**After**:
```typescript
import { isSelfConnection } from '@/lib/webrtc/utils'
```

## Testing Recommendations

### Unit Tests
- ✅ All existing tests pass without modification
- ✅ No new tests required (refactoring only)

### Integration Tests
- ✅ Run full integration test suite
- ✅ Verify 4-player room functionality
- ✅ Test connection establishment timing

### Manual Testing
- ✅ Test video streaming in 2, 4, and 8-player rooms
- ✅ Test camera switching
- ✅ Test audio muting/unmuting
- ✅ Test network disruption recovery

## Performance Expectations

### No Regressions Expected
- Connection establishment time: ~1.5-2 seconds (unchanged)
- Memory usage: Slightly improved (polling overhead removed)
- CPU usage: Slightly improved (no polling)
- Bundle size: 10-15% reduction expected

## Rollback Plan

If issues arise:

1. **Revert commits**: `git revert <commit-hash>`
2. **Restore polling**: Re-add setInterval from git history
3. **Restore retry**: Re-add pendingOffersRef logic
4. **Restore cleanup**: Re-add self-connection cleanup useEffect

All changes are isolated and can be reverted independently.

## FAQ

### Q: Why remove polling if it was working?
**A**: Polling is inefficient and unnecessary. Event-driven updates are:
- More responsive (instant vs 2-second delay)
- More efficient (no wasted requests)
- More reliable (no race conditions)

### Q: Why remove the retry mechanism?
**A**: Retry was a workaround for timing issues. With proper event-driven architecture:
- Connections are created when players are ready
- Offers sent immediately on connection creation
- No need to retry

### Q: Why remove self-connection cleanup?
**A**: Prevention is better than cleanup. Now:
- Self-connections prevented at creation time
- No cleanup needed
- Simpler code

### Q: Will this affect performance?
**A**: No, performance should be maintained or improved:
- Polling overhead removed
- Event-driven is more efficient
- Connection establishment time unchanged

### Q: Do I need to update my code?
**A**: Only if you're using the internal utilities:
- Use `isSelfConnection()` instead of manual normalization
- Use `normalizePlayerId()` for ID normalization
- Use `createPeerConnectionWithCallbacks()` for connection creation

## Support

For questions or issues:
1. Check the RESULTS.md for metrics and verification
2. Review the commit history for detailed changes
3. Refer to the spec.md for original requirements
4. Contact the team for clarification

## Conclusion

This refactoring improves code quality and maintainability without breaking changes. All functionality is preserved, and the codebase is now cleaner and more efficient.

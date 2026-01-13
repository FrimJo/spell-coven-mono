# Code Review: Game Room & WebRTC Implementation

**Date:** December 22, 2025
**Reviewer:** AI Code Review
**Scope:** Supabase Presence + WebRTC video streaming implementation

---

## Architecture Overview

The implementation follows a layered architecture:

1. **Channel Layer**: `ChannelManager` (singleton) manages shared Supabase Realtime channels
2. **Presence Layer**: `PresenceManager` → `useSupabasePresence` (external store) → `PresenceContext`
3. **Signaling Layer**: `SignalingManager` handles WebRTC signaling via Supabase broadcast
4. **WebRTC Layer**: `WebRTCManager` manages peer connections (transport-agnostic)

---

## 🔴 Critical Issues

### 1. No TURN Server Configuration

**File:** `apps/web/src/lib/webrtc/ice-config.ts`

**Problem:** Only STUN servers are configured. STUN works for ~70-80% of users, but corporate firewalls, symmetric NATs, and restrictive networks will **fail completely**. This is the biggest reliability issue.

**Fix:** Add TURN servers. Options:
- **[Twilio TURN](https://www.twilio.com/docs/stun-turn)**: Pay-per-use, battle-tested
- **[Metered TURN](https://www.metered.ca/stun-turn)**: Free tier available
- **[Coturn](https://github.com/coturn/coturn)**: Self-hosted option

```typescript
// Example with dynamic TURN credentials (typically fetched from backend)
export async function createIceConfiguration(): Promise<RTCConfiguration> {
  const turnCredentials = await fetchTurnCredentials() // from your backend
  return {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302'] },
      {
        urls: turnCredentials.urls,
        username: turnCredentials.username,
        credential: turnCredentials.credential,
      },
    ],
    iceCandidatePoolSize: 10,
  }
}
```

### 2. Race Condition: Signaling Before Presence is Ready

**File:** `apps/web/src/hooks/useSupabaseWebRTC.ts`

The code tries to prevent this via `presenceReady` flag, but there's still a race. If signaling initializes while presence is still joining (but `isLoading` = false briefly), the channel may be created with the wrong presence key, leading to presence tracking failures.

**Mitigation:** The `ChannelManager` handles this reasonably well, but consider adding an explicit "presence subscribed" event rather than just "not loading."

### 3. ICE Candidate Handling Can Drop Candidates

**File:** `apps/web/src/lib/webrtc/WebRTCManager.ts`

ICE candidates are queued, but the flush happens in a non-awaited loop. If `flushPendingCandidates` is called multiple times rapidly, or if adding a candidate fails, subsequent candidates may not be applied correctly.

**Fix:** Use `Promise.allSettled` and proper error handling.

---

## 🟠 Flakiness / Reliability Issues

### 4. Magic Timeout After Presence Track

**File:** `apps/web/src/lib/supabase/presence.ts` (lines 76-78)

```typescript
// Allow time for presence sync, then manually trigger sync
await new Promise((resolve) => setTimeout(resolve, 500))
this.handlePresenceSync()
```

**Problem:** Hardcoded 500ms delay is arbitrary and doesn't guarantee sync completed. On slow networks, this may not be enough; on fast networks, it's wasted time.

**Fix:** Wait for the first sync event instead:

```typescript
private async waitForInitialSync(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Sync timeout')), 10000)

    const handler = () => {
      clearTimeout(timeout)
      this.channel?.off('presence', { event: 'sync' }, handler)
      resolve()
    }

    this.channel?.on('presence', { event: 'sync' }, handler)
  })
}
```

### 5. Track State Polling Instead of Events

**File:** `apps/web/src/lib/webrtc/WebRTCManager.ts` (lines 362-372)

**Problem:** Polling every 500ms is wasteful and adds latency. Tracks have built-in events.

**Fix:** Use track events directly:

```typescript
stream.getTracks().forEach(track => {
  track.addEventListener('mute', () => this.updateTrackState(peerId, stream))
  track.addEventListener('unmute', () => this.updateTrackState(peerId, stream))
  track.addEventListener('ended', () => this.updateTrackState(peerId, stream))
})
```

### 6. No ICE Restart Mechanism

**File:** `apps/web/src/lib/webrtc/WebRTCManager.ts`

When connections fail or disconnect, there's no automatic ICE restart.

**Fix:** Implement ICE restart for `failed` or prolonged `disconnected` states:

```typescript
pc.oniceconnectionstatechange = () => {
  if (pc.iceConnectionState === 'failed') {
    // Attempt ICE restart
    pc.restartIce()
    // Create new offer with iceRestart: true
    pc.createOffer({ iceRestart: true }).then(offer => {
      pc.setLocalDescription(offer)
      this.sendSignal({ type: 'offer', ... })
    })
  }
}
```

### 7. Broadcast Listeners Never Cleaned Up

**File:** `apps/web/src/hooks/useSupabasePresence.ts` (lines 571-585)

**Problem:** There's no `removeBroadcastListener` method being called in cleanup. This can lead to memory leaks and duplicate event handling when components remount.

---

## 🟡 Redundant Logic / Code Smell

### 8. Duplicate Presence Key Generation

**File:** `apps/web/src/lib/supabase/presence.ts`

The sessionId is generated once by `getOrCreateSessionId()` and passed in, but there's fallback logic generating a new UUID. This could create inconsistency.

### 9. Channel State Checked Multiple Places

Both `PresenceManager.subscribeToChannel` and `SignalingManager.ensureSubscribed` have nearly identical subscription logic. Consider extracting to `ChannelManager`:

```typescript
// In ChannelManager
async ensureSubscribed(roomId: string): Promise<void> {
  // Centralized subscription logic
}
```

### 10. Video Element Attachment Complexity

**File:** `apps/web/src/hooks/useVideoStreamAttachment.ts`

The hook has complex change detection logic that duplicates what React already does. This could be simplified by memoizing the Maps properly upstream or using `useSyncExternalStore` with proper snapshots.

---

## 🟢 Optimization Opportunities

### 11. Consider WebRTC Library

For more robust, battle-tested WebRTC handling, consider:

- **[simple-peer](https://github.com/feross/simple-peer)**: ~10KB, simpler API, handles negotiation
- **[PeerJS](https://peerjs.com/)**: Higher-level, includes server option
- **[LiveKit](https://livekit.io/)**: SFU-based, better for >2 participants, highly scalable

For 1-on-1 or small groups (2-4), the P2P mesh is fine. For larger rooms, an **SFU (Selective Forwarding Unit)** would be better since mesh doesn't scale well (N×(N-1) connections).

### 12. Perfect Negotiation Pattern

**File:** `apps/web/src/hooks/useSupabaseWebRTC.ts`

The current signaling uses lexicographic ID comparison for tie-breaking, which works but is fragile. The **[Perfect Negotiation Pattern](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)** is the modern, recommended approach that handles renegotiation gracefully:

```typescript
// One peer is "polite", the other is "impolite"
const polite = localPeerId > remotePeerId

pc.onnegotiationneeded = async () => {
  try {
    makingOffer = true
    await pc.setLocalDescription()
    sendSignal({ type: 'offer', sdp: pc.localDescription.sdp, ... })
  } finally {
    makingOffer = false
  }
}

// In handleSignal for offers:
const offerCollision = description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable')

if (offerCollision) {
  if (!polite) return // Impolite peer ignores incoming offer during collision
  // Polite peer rolls back and accepts incoming offer
  await pc.setLocalDescription({ type: 'rollback' })
}
await pc.setRemoteDescription(description)
```

### 13. SDP Munging for Bandwidth Control

Consider adding bandwidth constraints for video to prevent quality issues:

```typescript
function limitBandwidth(sdp: string, bandwidth: number): string {
  return sdp.replace(/b=AS:.*\r\n/g, '')
    .replace(/(m=video.*\r\n)/g, `$1b=AS:${bandwidth}\r\n`)
}
```

---

## 📋 Summary of Recommendations

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| 🔴 Critical | No TURN servers | Add Twilio/Metered TURN servers |
| 🔴 Critical | No ICE restart | Implement ICE restart on failure |
| 🟠 High | Polling track state | Use track mute/unmute events |
| 🟠 High | Magic timeout | Wait for sync event, not setTimeout |
| 🟠 High | Listener memory leak | Add removeBroadcastListener |
| 🟡 Medium | No Perfect Negotiation | Implement for renegotiation support |
| 🟡 Medium | Duplicate subscription logic | Centralize in ChannelManager |
| 🟢 Nice-to-have | Consider SFU | For scaling beyond 4 players |

---

## Third-Party Libraries to Consider

### For WebRTC simplification:
- [simple-peer](https://github.com/feross/simple-peer) - Minimal wrapper, good for small group calls

### For production-grade video calling:
- [LiveKit](https://livekit.io/) - Open-source SFU, React SDK available
- [Twilio Video](https://www.twilio.com/video) - Managed service
- [Daily.co](https://www.daily.co/) - Managed service with React hooks

### For TURN servers:
- [Metered TURN](https://www.metered.ca/stun-turn) - Free tier, easy integration
- [Twilio Network Traversal](https://www.twilio.com/docs/stun-turn) - Production-grade

---

## Files Reviewed

- `apps/web/src/lib/supabase/presence.ts`
- `apps/web/src/lib/supabase/channel-manager.ts`
- `apps/web/src/lib/supabase/signaling.ts`
- `apps/web/src/lib/supabase/types.ts`
- `apps/web/src/lib/webrtc/WebRTCManager.ts`
- `apps/web/src/lib/webrtc/ice-config.ts`
- `apps/web/src/lib/webrtc/signal-handlers.ts`
- `apps/web/src/lib/webrtc/track-utils.ts`
- `apps/web/src/hooks/useSupabasePresence.ts`
- `apps/web/src/hooks/useSupabaseWebRTC.ts`
- `apps/web/src/hooks/useVideoStreamAttachment.ts`
- `apps/web/src/contexts/PresenceContext.tsx`
- `apps/web/src/components/GameRoom.tsx`
- `apps/web/src/components/VideoStreamGrid.tsx`
- `apps/web/src/types/webrtc-signal.ts`



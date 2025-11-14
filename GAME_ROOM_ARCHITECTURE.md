# Game Room Architecture - Independent of Discord

## Overview

The game room video streaming is now **completely independent** of Discord voice channels. This allows:

- Users to join the game room without being in Discord voice channel
- Users to be in Discord voice channel but not in the game room
- Users to leave and rejoin the game room while staying in voice channel
- Future removal of Discord integration without affecting video streaming

## Architecture

### Key Principle
**Game room participants ≠ Voice channel members**

### Components

#### 1. Game Room Participant Tracking

**Client-Side: `useGameRoomParticipants` Hook**
- Location: `apps/web/src/hooks/useGameRoomParticipants.ts`
- Announces presence when user opens game room page
- Listens for other participants joining/leaving via SSE
- Automatically removes presence when user closes page or unmounts component

**Server-Side: `GameRoomManager`**
- Location: `apps/web/src/server/managers/gameroom-manager.ts`
- Tracks participants in memory (Map-based, per room)
- Broadcasts join/leave events to all participants in same room
- Manages SSE connections for real-time updates

#### 2. API Endpoints

**POST /api/gameroom/join**
- Announce presence in a room
- Returns current list of participants
- Broadcasts `gameroom.joined` event to others

**POST /api/gameroom/leave**
- Remove presence from a room
- Broadcasts `gameroom.left` event to others

**GET /api/gameroom/stream**
- SSE endpoint for real-time room events
- Streams `gameroom.joined` and `gameroom.left` events
- Auto-removes participant on disconnect

#### 3. Video Streaming (PeerJS)

**Flow:**
```
User A opens game room page
  ↓
useGameRoomParticipants announces presence
  ↓
POST /api/gameroom/join
  ↓
GameRoomManager adds to participants list
  ↓
GET /api/gameroom/stream (SSE connection)
  ↓
User B opens game room page
  ↓
User B announces presence
  ↓
GameRoomManager broadcasts gameroom.joined event
  ↓
User A receives event via SSE
  ↓
User A's remotePlayerIds updates with User B's ID
  ↓
usePeerJS.connectToPeers([User B])
  ↓
User A completes media setup
  ↓
initializeLocalMedia() → creates stream
  ↓
connectToPeers() → creates PeerJS call to User B
  ↓
User B receives incoming call
  ↓
User B completes media setup
  ↓
initializeLocalMedia() → answers pending call + creates outgoing call to User A
  ↓
Both users now have bi-directional video streams
```

## Integration Points

### GameRoom.tsx (updated)
```typescript
// OLD (wrong - uses Discord voice channel)
const { members: voiceChannelMembers } = useVoiceChannelMembersFromEvents({
  gameId: roomId,
  userId: userId,
})

// NEW (correct - uses game room participants)
const { participants: gameRoomParticipants } = useGameRoomParticipants({
  roomId,
  userId,
  username: playerName,
  enabled: true,
})

const remotePlayerIds = useMemo(
  () => gameRoomParticipants.filter((p) => p.id !== userId).map((p) => p.id),
  [gameRoomParticipants, userId],
)
```

### GameRoomVideoGrid.tsx (updated)
```typescript
// OLD (wrong - uses Discord voice channel)
const { members: voiceChannelMembers } = useVoiceChannelMembersFromEvents({
  gameId: roomId,
  userId: userId,
})

// NEW (correct - uses game room participants)
const { participants: gameRoomParticipants } = useGameRoomParticipants({
  roomId,
  userId,
  username: playerName,
  enabled: true,
})
```

## Benefits

1. **Independence**: Game room works without Discord
2. **Flexibility**: Users can join/leave game room without affecting Discord status
3. **Simplicity**: Clear separation of concerns
4. **Future-proof**: Easy to remove Discord integration later
5. **Correctness**: Video connections reflect actual game room presence

## Migration Path

### Current State ✅
- Game room participant tracking implemented
- PeerJS connections use game room participants
- Old voice channel integration still exists (for voice chat features)

### Future (when removing Discord)
- Remove `useVoiceChannelEvents` and `useVoiceChannelMembersFromEvents` hooks
- Remove Discord SSE endpoints (`/api/stream`)
- Remove Discord REST API calls
- Game room video streaming continues to work unchanged

## Testing

### Test Scenario 1: Basic Connection
1. User A opens game room → announces presence
2. User B opens game room → announces presence
3. Both users complete media setup
4. Both should see each other's video streams

### Test Scenario 2: Late Join
1. User A opens game room and completes media setup
2. User A's camera is streaming
3. User B opens game room later
4. User B should see User A in participant list
5. After User B completes media setup, both should see each other

### Test Scenario 3: Disconnect/Reconnect
1. User A and B connected with video streams
2. User A closes browser tab
3. User B should see User A removed from participant list
4. PeerJS connection should close
5. User A reopens game room
6. User A announces presence again
7. Connection re-established

### Test Scenario 4: Camera Toggle
1. Users connected with video streams
2. User A clicks video off button
3. User B should see "Camera Off" for User A
4. User A clicks video on button
5. User B should see User A's video again

## Console Logs to Watch

```
[GameRoomParticipants] Announcing presence in room: <roomId>
[GameRoomParticipants] Successfully joined room, current participants: 2
[GameRoomParticipants] Participant joined: <username>
[GameRoom] 🎥 Remote streams update: { gameRoomParticipants: [...], remotePlayerIds: [...] }
[PeerJSManager] Connecting to remote peers: [...]
[PeerJSManager] Creating outgoing call to: <peerId>
[PeerJSManager] Received remote stream from: <peerId>
[VideoStreamGrid] Attaching stream to video element for <peerId>
```

## Known Issues & Limitations

### Current
- Participants stored in memory (lost on server restart)
  - Solution: Add Redis/database persistence later if needed
- No reconnection logic for SSE failures
  - Solution: Add exponential backoff retry in `useGameRoomParticipants`

### Not Issues (By Design)
- Discord voice channel status ignored for video ✅
- Users can be in game room without voice channel ✅
- Video works independently of Discord ✅

## Files Changed/Created

### Created
- `apps/web/src/hooks/useGameRoomParticipants.ts`
- `apps/web/src/server/managers/gameroom-manager.ts`
- `apps/web/src/routes/api/gameroom/join.ts`
- `apps/web/src/routes/api/gameroom/leave.ts`
- `apps/web/src/routes/api/gameroom/stream.ts`

### Modified
- `apps/web/src/components/GameRoom.tsx` - Use game room participants instead of voice channel members
- `apps/web/src/components/GameRoomVideoGrid.tsx` - Use game room participants instead of voice channel members
- `apps/web/src/lib/peerjs/PeerJSManager.ts` - Enhanced logging and track state fixes
- `apps/web/src/components/VideoStreamGrid.tsx` - Track state detection fixes and logging

## Summary

The video streaming system now correctly tracks who's **actually in the game room web page**, not who's in Discord voice channel. This is the architecturally correct approach and allows for future Discord removal while keeping video streaming functional.


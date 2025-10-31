# Voice Channel Members Sync

## Overview

The video grid and player list now automatically sync with Discord voice channel members. When users join the voice channel, they appear in the video grid (max 4) and player list in real-time.

## Architecture

### Server Function: `getVoiceChannelMembers`

**Location:** `/apps/web/src/server/discord-rooms.ts`

Fetches all members currently in a voice channel:

```typescript
export const getVoiceChannelMembers = createServerFn({ method: 'POST' })
  .inputValidator((data: { gameId: string; userId: string }) => data)
  .handler(async ({ data: { gameId, userId } }): Promise<VoiceChannelMember[]> => {
    // 1. Get all voice states for the guild
    // 2. Filter to members in target channel
    // 3. Fetch guild member details (max 4)
    // 4. Return member list with username, avatar, isActive
  })
```

**Returns:**
```typescript
interface VoiceChannelMember {
  id: string              // Discord user ID
  username: string        // Discord username
  avatar: string | null   // Avatar URL or null
  isActive: boolean       // Whether this is the current user
}
```

### Hook: `useVoiceChannelMembers`

**Location:** `/apps/web/src/hooks/useVoiceChannelMembers.ts`

Polls the server for voice channel members:

```typescript
const { members, isLoading, error } = useVoiceChannelMembers({
  gameId: string              // Voice channel ID
  userId: string              // Current user ID
  enabled?: boolean           // Enable/disable polling (default: true)
  pollIntervalMs?: number     // Poll interval in ms (default: 2000)
})
```

**Features:**
- Automatically fetches members immediately on mount
- Polls every 2 seconds (configurable)
- Stops polling when component unmounts
- Returns loading and error states
- Gracefully handles network errors

### GameRoom Integration

**Location:** `/apps/web/src/components/GameRoom.tsx`

The GameRoom component:

1. Calls `useVoiceChannelMembers` hook with gameId and userId
2. Syncs returned members to local `players` state
3. Converts Discord members to Player objects:
   - `id` → Discord user ID
   - `username` → Player name
   - `life` → Default 20
   - `isActive` → First member is active turn
4. Passes `auth?.userId` as `ownerId` to PlayerList

```typescript
// Fetch voice channel members
const { members: voiceChannelMembers } = useVoiceChannelMembers({
  gameId,
  userId: auth?.userId || '',
  enabled: !!auth,
  pollIntervalMs: 2000,
})

// Sync to players state
useEffect(() => {
  if (voiceChannelMembers.length > 0) {
    const updatedPlayers = voiceChannelMembers.map((member, index) => ({
      id: member.id,
      name: member.username,
      life: 20,
      isActive: index === 0,
    }))
    setPlayers(updatedPlayers)
  }
}, [voiceChannelMembers])
```

### PlayerList Updates

**Location:** `/apps/web/src/components/PlayerList.tsx`

Updated to accept optional `ownerId` prop:

```typescript
interface PlayerListProps {
  players: Player[]
  isLobbyOwner: boolean
  localPlayerName: string
  onRemovePlayer: (playerId: string) => void
  ownerId?: string  // Discord user ID of room owner
}
```

Owner detection now uses Discord user ID:
```typescript
const isOwner = ownerId ? player.id === ownerId : player.id === '1'
```

## Data Flow

```
Discord Voice Channel
         ↓
    User joins/leaves
         ↓
getVoiceChannelMembers() fetches voice states
         ↓
useVoiceChannelMembers polls every 2s
         ↓
GameRoom syncs to players state
         ↓
VideoStreamGrid renders up to 4 players
PlayerList renders all players
```

## Real-Time Updates

- **Poll Interval:** 2 seconds (configurable)
- **Max Players in Grid:** 4
- **Max Players in List:** Unlimited
- **Automatic Sync:** No manual refresh needed
- **Error Handling:** Graceful degradation on network errors

## Example Usage

```typescript
// In GameRoom component
const { members } = useVoiceChannelMembers({
  gameId: '123456789',
  userId: 'user-discord-id',
  enabled: true,
  pollIntervalMs: 2000,
})

// Members automatically synced to players state
// VideoStreamGrid and PlayerList update automatically
```

## Testing

1. Create a game room
2. Share invite link with friends
3. Friends join the Discord voice channel
4. Verify:
   - VideoStreamGrid shows up to 4 players
   - PlayerList shows all connected players
   - Owner badge shows on room creator
   - Real-time updates when members join/leave

## Performance Considerations

- **Polling Interval:** 2 seconds is a good balance between responsiveness and server load
- **Max Members:** Limited to 4 in video grid, unlimited in player list
- **Guild Member Fetches:** Only fetches details for members in the channel (max 4)
- **Cleanup:** Polling stops automatically when component unmounts

## Future Enhancements

- WebSocket-based real-time updates (instead of polling)
- Member status indicators (speaking, muted, deafened)
- Custom polling intervals per component
- Caching to reduce server calls
- Member avatars in video grid

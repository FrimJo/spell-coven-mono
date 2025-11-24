# Room Management Architecture (No Database)

This document describes the simplified room management using only Supabase Realtime channels - no database required.

## Overview

The application uses a lightweight approach:

- **Room Management**: Realtime channels (created automatically on first join)
- **WebRTC Streaming**: Same channels for video/audio signaling

**Key Insight**: With Supabase Realtime, channels are created automatically when the first person subscribes. There's no need to check if a room "exists" - any room ID is valid!

## Benefits

✅ **Simple**: No database migrations or schemas
✅ **Fast**: Instant room creation (automatic)
✅ **Scalable**: Supabase handles channel management
✅ **Clean**: Channels auto-cleanup when empty
✅ **No Validation**: Any room ID works - channel is created on first join

## How Realtime Channels Work

### Channel Lifecycle

```
User navigates to /game/ABC123
        ↓
Component subscribes to channel "game:ABC123"
        ↓
Channel is created automatically (if it doesn't exist)
        ↓
User joins presence
        ↓
Channel now has 1 participant
        ↓
Other users can join the same channel
        ↓
Last user leaves
        ↓
Channel is automatically cleaned up by Supabase
```

### Important: No "Room Exists" Check Needed!

**Before (Wrong Thinking)**:

- ❌ Check if room exists
- ❌ If no participants, room doesn't exist
- ❌ First person can't join because room doesn't exist
- ❌ Catch-22!

**After (Correct Understanding)**:

- ✅ Any room ID is valid
- ✅ Channel created automatically on first subscription
- ✅ First person creates the channel by joining
- ✅ No validation needed!

## Architecture

### No Database Schema

Rooms are just Realtime channel names (e.g., `game:game-AB12CD`). They:

1. Are created automatically when first person subscribes
2. Exist as long as someone is subscribed
3. Are cleaned up automatically when everyone leaves
4. Don't require any pre-creation or validation

### File Structure

```
apps/web/src/
├── lib/supabase/
│   ├── client.ts                  # Supabase client
│   ├── room-types.ts              # Simple types (no validation)
│   ├── room-service.ts            # Optional helper (get participant count)
│   ├── presence.ts                # Presence management (existing)
│   ├── signaling.ts               # WebRTC signaling (existing)
│   └── channel-manager.ts         # Shared channel manager (existing)
├── hooks/
│   ├── useGameRoom.ts             # Track participant count
│   ├── useSupabasePresence.ts     # Presence hook (existing)
│   └── useSupabaseWebRTC.ts       # WebRTC hook (existing)
├── routes/
│   ├── index.tsx                  # Landing page with create game
│   └── game.$gameId.tsx           # Game room route (no validation!)
└── components/
    ├── LandingPage.tsx            # Create game modal
    ├── CreateGameDialog.tsx       # Create game dialog component
    ├── GameRoom.tsx               # Game room component
    └── GameRoomPlayerCount.tsx    # Player count display
```

## Flow Diagrams

### Creating a Game Room

```
User clicks "Create Game"
        ↓
Modal opens (loading state)
        ↓
Generate room ID (game-XXXXXX)
        ↓
Save to session storage
        ↓
Modal shows success state with room ID
        ↓
User clicks "Enter Game Room"
        ↓
Navigate to /game/$gameId
        ↓
First participant subscribes → Channel created automatically!
```

### Joining a Game Room

```
User navigates to /game/$gameId
        ↓
Render GameRoom component
        ↓
Subscribe to Realtime channel (created if doesn't exist)
        ↓
Join presence
        ↓
Channel now exists with this participant
        ↓
WebRTC streaming starts
```

### The Beauty of This Approach

**Any URL works**:

- `/game/ABC123` - Valid! Channel created when first person joins
- `/game/my-cool-game` - Valid! Channel created when first person joins
- `/game/random-12345` - Valid! Channel created when first person joins

**No 404s needed**: Every room ID is valid because channels are created automatically.

## Key Components

### 1. Room Service (`room-service.ts`)

**Purpose**: Optional helper to get participant count

**Functions**:

- `getRoomParticipantCount()` - Get current count (returns 0 if empty)

**Note**: No validation functions needed!

**Example**:

```typescript
// Optional - get current participant count
const count = await getRoomParticipantCount('game-AB12CD')
console.log(`Room has ${count} participants`)
// Returns 0 if no one is there yet - room will be created when someone joins!
```

### 2. useGameRoom Hook (`useGameRoom.ts`)

**Purpose**: Track real-time participant count

**Features**:

- Real-time presence updates
- Participant count tracking
- Error handling
- Automatic cleanup

**Example**:

```typescript
const { participantCount, isLoading, error } = useGameRoom({
  roomId: 'game-AB12CD',
  onParticipantCountChange: (count) => {
    console.log('Participants:', count)
  },
  onError: (error) => {
    console.error('Error:', error)
  },
})
```

### 3. Game Route (`game.$gameId.tsx`)

**Purpose**: Simple route rendering - no validation needed!

**No `beforeLoad` or `loader` validation** - every room ID is valid because channels are created automatically when someone subscribes.

```typescript
// Just render the component - no checks needed!
function GameRoomRoute() {
  const { gameId } = Route.useParams()

  return <GameRoom roomId={gameId} ... />
}
```

### 4. Landing Page Modal (`LandingPage.tsx` + `CreateGameDialog.tsx`)

**Purpose**: Generate room ID and show success modal

**States**:

1. **Idle** - User can click "Create Game"
2. **Loading** - Brief animation for UX (500ms)
3. **Success** - Shows room ID and "Enter Room" button

## Setup Instructions

### No Setup Required! 🎉

Since we're not using a database and channels are created automatically, there's nothing to set up. Just:

1. **Start the dev server**:

   ```bash
   cd apps/web
   npm run dev
   ```

2. **Create a game** and start playing!

## How It Really Works

### Room Creation

When you click "Create Game":

1. Generate random room ID (`game-XXXXXX`)
2. Save to session storage
3. Show success modal
4. Navigate to room

### Channel Creation (Automatic)

When first person navigates to a room:

1. GameRoom component renders
2. useSupabasePresence hook subscribes to channel
3. **Channel is created automatically by Supabase**
4. User joins presence
5. Room now "exists" with 1 participant

### Participant Tracking

- Uses Supabase Presence API
- Real-time updates when people join/leave
- Displayed as "N/4 Players" in UI
- Returns 0 if channel is empty (but still valid!)

### When Everyone Leaves

- Last person unsubscribes
- Channel is automatically cleaned up by Supabase
- No manual cleanup needed
- Room effectively "doesn't exist" anymore
- But it will be recreated when someone joins again!

## Error Handling

The system follows: **Fail loudly, never use fallbacks** [[memory:10824677]]

### Channel Errors

- Connection errors → Show error toast
- Subscription fails → Display error message
- Never silently fall back

## Testing

### Manual Testing Checklist

**Create Game Flow**:

- [x] ✅ Click "Create Game" shows modal
- [x] ✅ Modal displays loading state (500ms)
- [x] ✅ Modal shows success with room ID
- [x] ✅ "Enter Room" button navigates

**Join Game Flow**:

- [x] ✅ Navigate to ANY room ID → Always works
- [x] ✅ First person to join creates the channel
- [x] ✅ Player count updates in real-time
- [x] ✅ No 404 errors (every room ID is valid!)

**Room State**:

- [x] ✅ Channel created when first person subscribes
- [x] ✅ Channel exists while participants present
- [x] ✅ Channel cleaned up when everyone leaves
- [x] ✅ Participant count tracks presence
- [x] ✅ Max players displayed (default: 4)

## Advantages vs Database Approach

| Feature         | Database            | Realtime Only         |
| --------------- | ------------------- | --------------------- |
| Setup           | Migrations required | None                  |
| Room validation | beforeLoad check    | Not needed!           |
| Room creation   | Manual insert       | Automatic             |
| Room cleanup    | Manual/scheduled    | Automatic             |
| First join      | Must exist first    | Creates automatically |
| Complexity      | High                | Very Low              |
| Latency         | DB query            | Instant               |
| Scalability     | DB limits           | Supabase scale        |

## Common Misconceptions

### ❌ Wrong: "Need to check if room exists before joining"

**Reality**: Channels are created automatically. Any room ID is valid.

### ❌ Wrong: "Room doesn't exist if no participants"

**Reality**: Channel is created when first person subscribes. Count of 0 just means no one is there yet.

### ❌ Wrong: "Need beforeLoad validation"

**Reality**: No validation needed - every room ID works!

### ✅ Correct: "First person creates the room by joining"

**Yes!** That's exactly how Supabase Realtime works.

## Future Enhancements

1. **Optional Room Metadata**
   - Store in session/localStorage
   - Share via URL params
   - No DB needed

2. **Room Discovery**
   - List active channels via Supabase API
   - Filter by participant count > 0

3. **Room Settings**
   - Store in channel metadata
   - Broadcast to participants

## Troubleshooting

### "No participants" after joining

Check:

1. Presence hook is working
2. Channel subscription succeeded
3. User ID and username are set
4. Console logs: `[WebRTC:Presence]`

### Can't join room

Check:

1. Supabase connection working
2. Environment variables set
3. Network tab for failed requests
4. Console for errors

### Room "doesn't exist"

**Remember**: Rooms don't need to exist beforehand! They're created when the first person joins. If you're seeing "doesn't exist" errors, the issue is likely in the code logic, not with Supabase.

## Related Documentation

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Supabase Presence Docs](https://supabase.com/docs/guides/realtime/presence)
- [WebRTC Implementation](./specs/001-webrtc-video-streaming/)

## Support

For issues:

1. Check console logs: `[RoomService]`, `[useGameRoom]`
2. Verify Supabase connection
3. Check Realtime inspector in dashboard
4. Review this documentation

## Key Takeaway

🎯 **With Supabase Realtime, channels are created automatically when the first person subscribes. There's no need for room validation - any room ID is valid!**

# Discord API Integration - Feature Descriptions

**Overview**: Integrate Discord's API to provide chat messaging and webcam streaming infrastructure for Spell Coven's remote MTG play platform. This leverages Discord's existing voice channels, video streaming, and text chat capabilities as the backend communication layer.

**Authentication Strategy**: Discord authentication is **required** for all users. Discord does not support guest/anonymous access, and since video streaming is core to the game experience, all players must authenticate via Discord OAuth2 before creating or joining games.

**Implementation Strategy**: Split into 5 phases (0-4) for incremental delivery and testing.

**Separation of Concerns (SoC) Principle**: Throughout all phases, maintain clear architectural boundaries:
- **`@repo/discord-integration` package**: Pure Discord API logic (OAuth, WebSocket, REST client, no UI)
- **`apps/web` components**: UI layer only (React components, hooks, no direct Discord API calls)
- **Type definitions**: Shared in `@repo/discord-integration/types` for contract enforcement
- **Configuration**: Environment variables for secrets, never hardcode credentials
- **State management**: Discord state separate from game state, clear data flow

---

## Phase 0: Prerequisites & Setup

**Goal**: Prepare Discord Developer Portal configuration and local development environment before any implementation begins.

**Your Action Items**:

1. **Create Discord Account** (if you don't have one):
   - Visit [discord.com](https://discord.com)
   - Sign up for a free account
   - Verify your email address

2. **Create Discord Application**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application"
   - Name: "Spell Coven" (or your preferred name)
   - **Save the Application ID (Client ID)** - you'll need this

3. **Configure OAuth2 Settings**:
   - Navigate to OAuth2 → General in your application
   - **Skip the Client Secret** - not needed for PKCE flow
   - Add Redirect URIs:
     - Development: `http://localhost:3000/auth/discord/callback`
     - Production: `https://yourdomain.com/auth/discord/callback` (update when you have a domain)
   - Select OAuth2 Scopes: `identify`, `guilds`, `messages.read`

4. **Create Bot User** (optional - for Phase 2+ if you add backend):
   - Navigate to Bot section in your application
   - Click "Add Bot"
   - Enable "Message Content Intent" (required for text chat in Phase 2)
   - **Copy and save the Bot Token** (keep this secure!)
   - **Note**: Bot token only needed if you add a backend server later

5. **Set Up Environment Variables**:
   - Add to existing `apps/web/.env.development`:
     ```env
     VITE_DISCORD_CLIENT_ID=your_client_id_here
     # Note: No CLIENT_SECRET needed - we use PKCE for client-side OAuth
     # Note: BOT_TOKEN only needed if we add a backend later
     ```
   - **Safe to commit** - Client ID is public and contains no secrets
   - Users can override with their own Client ID if self-hosting

6. **Create Test Discord Server** (recommended):
   - Create a private Discord server for testing
   - Invite your bot to this server:
     - Go to OAuth2 → URL Generator in Developer Portal
     - Select scopes: `bot`, `applications.commands`
     - Select bot permissions: `Send Messages`, `Read Message History`, `Manage Channels`
     - Copy generated URL and open in browser
     - Select your test server and authorize

**Deliverables**:
- Discord Application created with Client ID (Client Secret not needed for PKCE)
- Bot user created with Bot Token (for future backend features)
- `apps/web/.env.development` updated with Client ID
- Test Discord server with bot invited (optional but recommended)

**Security Checklist**:
- ✓ Using PKCE flow - no Client Secret needed in browser
- ✓ Bot Token is NOT in version control (only needed for backend)
- ✓ Client ID is public and **safe to commit** to git
- ✓ `.env.development` can be committed - contains no secrets

**Estimated Time**: 30-60 minutes

**Success Criteria**: You have all credentials ready and can proceed to Phase 1 implementation.

**Package Dependencies**:
- Install `discord-api-types` for TypeScript type definitions:
  ```bash
  pnpm add discord-api-types
  ```
- **Do NOT install `discord.js`** - it's for Node.js backends, not browsers
- You'll implement Discord API calls using native browser APIs (fetch, WebSocket, crypto)

**Documentation Resources**:
- Use **Context7 MCP server** to get up-to-date documentation during implementation:
  ```
  1. Resolve library ID: /discordjs/discord-api-types
  2. Fetch docs with specific topics like "OAuth2", "Gateway", "REST API"
  3. Get current API patterns and type definitions
  ```
- Context7 provides the latest Discord API type definitions, usage examples, and best practices
- Especially useful for OAuth2 flows, Gateway events, and REST endpoint types

---

## Phase 1: Discord Authentication & Basic Connection (PKCE)

### Minimal First Step (Phase 1a)

**Goal**: Get Discord OAuth working with PKCE (client-side only, no backend) and visual confirmation

**Key Architecture Decision**: Using PKCE (Proof Key for Code Exchange) for secure client-side OAuth without requiring a backend or client secret.

**Deliverables**:
1. Implement PKCE flow: generate `code_verifier` and `code_challenge`
2. Discord OAuth modal component
3. OAuth redirect to Discord with PKCE parameters
4. Callback handler at `/auth/discord/callback` with PKCE verification
5. Display user's Discord profile (avatar + username) in header
6. Gate "Create Game" / "Join Game" behind auth check

**Success Metric**: User can click "Create Game", see Discord OAuth modal, authenticate via PKCE flow, and see their Discord profile in the header.

**Estimated Time**: 2-3 days

**What's NOT Included** (deferred to Phase 1b):
- Gateway WebSocket connection
- Token refresh logic (will also use PKCE when implemented)
- Connection status indicators
- Heartbeat mechanism

---

### Feature Description for `/speckit.specify`

**Feature Name**: Discord OAuth2 Authentication and Gateway Connection

**User Value**: MTG players can authenticate with their Discord accounts and establish a secure connection to Discord's real-time messaging infrastructure, enabling them to use Discord as the communication backend for game sessions.

**Core Capabilities**:

1. **Discord OAuth2 Login Flow (PKCE - Client-Side Only)**
   - Implement Discord OAuth2 authorization code flow with PKCE in browser
   - **PKCE (Proof Key for Code Exchange)**: Secure OAuth without client secret
     - Generate `code_verifier` (random string) and `code_challenge` (SHA256 hash)
     - Send `code_challenge` to Discord during authorization
     - Send `code_verifier` during token exchange (proves you initiated the flow)
   - Request permissions: `identify`, `guilds`, `messages.read`
   - Handle OAuth callback and token exchange (client-side only, no backend)
   - Display user's Discord profile (username, avatar) in Spell Coven UI
   - **Authentication Gate**: Intercept "Create Game" and "Join Game" actions to check auth status
   - Show Discord OAuth modal if user is not authenticated
   - Redirect to Discord OAuth page (full-page redirect, not popup for mobile compatibility)
   - Handle callback at `/auth/discord/callback` route

2. **Token Management (Client-Side)**
   - Store Discord access tokens in localStorage with automatic refresh
   - Use short-lived access tokens (1-2 hours) with refresh token flow
   - Refresh tokens client-side using PKCE (no backend needed)
   - Clear tokens on explicit logout
   - Implement strict Content Security Policy to mitigate XSS risks
   - Handle token expiration gracefully with automatic refresh

3. **Discord Gateway WebSocket Connection**
   - Establish WebSocket connection to Discord Gateway from browser
   - Implement heartbeat mechanism for connection keep-alive
   - Handle reconnection logic with exponential backoff
   - Display connection status in UI (connected/disconnecting/reconnecting)
   - Receive and parse Discord Gateway events

**Technical Requirements**:

**SoC: `@repo/discord-integration` package** (Pure API logic, no UI):
- Create Discord OAuth client with PKCE: `DiscordOAuthClient` class
  - Methods: `generatePKCE()`, `getAuthUrl()`, `exchangeCodeForToken()`, `refreshToken()`
  - PKCE implementation: generate `code_verifier` and `code_challenge`
  - No localStorage access - return tokens to caller
  - **No client secret needed** - uses PKCE for security
- Create WebSocket connection manager: `DiscordGatewayClient` class
  - Methods: `connect()`, `disconnect()`, `send()`, event emitters
  - Heartbeat and reconnection logic
  - No React dependencies
- Use `discord-api-types` for TypeScript types
- Export types: `DiscordToken`, `DiscordUser`, `GatewayEvent`, `PKCEChallenge`

**SoC: `apps/web` UI layer** (React components and hooks only):
- Create React hooks (consume `@repo/discord-integration` API):
  - `useDiscordAuth()`: Manages token storage in localStorage, calls OAuth client
  - `useDiscordConnection()`: Manages Gateway connection lifecycle
  - `useDiscordUser()`: Fetches and caches user profile
- Build UI components (no direct Discord API calls):
  - `DiscordAuthModal`: Modal explaining Discord requirement with "Connect Discord" button
  - `DiscordLoginButton`: Prominent button in header (uses Discord brand color #5865F2)
  - `DiscordUserProfile`: Display avatar + username when authenticated
  - `ConnectionStatus`: Show Gateway connection state
- Create route handler: `/auth/discord/callback` for OAuth redirect
- Update `LandingPage` component to gate Create/Join actions behind auth check

**SoC: Configuration**:
- Environment variables in `apps/web/.env.development` (safe to commit - no secrets)
- Config module: `apps/web/src/config/discord.ts` to read env vars
- Type-safe config with validation
- Users can override with `.env.local` for self-hosting

**Success Criteria**:
- Users can authenticate via Discord OAuth2 within 10 seconds
- WebSocket connection establishes within 5 seconds of authentication
- Connection automatically reconnects within 30 seconds of network failure
- Token refresh happens automatically without user intervention
- Connection status is clearly visible to users

**Edge Cases**:
- User denies OAuth permissions (show error message, allow retry)
- User doesn't have Discord account (show message directing to Discord signup)
- Network failures during authentication (show retry button)
- Token refresh fails (requires re-authentication)
- Discord API rate limits during connection (implement exponential backoff)
- User revokes app permissions from Discord settings (detect and prompt re-auth)
- User clicks "Create Game" or "Join Game" without Discord auth (show auth modal)

**Constitutional Alignment**:
- ✓ Browser-First: All OAuth and WebSocket connections run client-side
- ✓ User-Centric: Familiar Discord login, clear connection status
- ✓ Data Contracts: Define token storage schema and Gateway event types

**Client-Side Limitations**:
- ⚠ **Phase 2+ (Text Chat)**: Discord Gateway can receive messages, but sending messages requires REST API calls
  - User OAuth tokens have limited permissions
  - For full bot functionality (sending messages as bot), you'll need a backend with bot token
  - **Workaround for Phase 1**: Users can only read messages, not send (or send as themselves with user token)
- ⚠ **Phase 3+ (Voice/Video)**: Creating channels requires elevated permissions
  - User tokens can join existing channels
  - Creating new channels typically requires bot permissions
  - **Workaround**: Users create channels manually in Discord, then select them in Spell Coven

---

## Phase 2: Discord Text Chat Integration

### Feature Description for `/speckit.specify`

**Feature Name**: Discord Text Channel Messaging

**User Value**: MTG players can send and receive text messages through Discord channels directly from the Spell Coven interface, enabling game coordination, card discussions, and social interaction without switching between applications.

**Core Capabilities**:

1. **Channel Selection**
   - Display list of user's accessible Discord text channels
   - Filter channels by server/guild
   - Allow users to select active channel for game session
   - Show channel name and server context in UI

2. **Message Display**
   - Receive real-time messages from selected Discord channel via Gateway
   - Display messages in Spell Coven chat UI with Discord formatting
   - Show message author (username, avatar, role colors)
   - Support Discord markdown (bold, italic, code blocks)
   - Display timestamps in user's local timezone
   - Handle message edits and deletions

3. **Message Sending**
   - Send text messages to Discord channel from Spell Coven UI
   - Support basic Discord markdown formatting
   - Handle Discord rate limits with message queuing
   - Show message send status (sending/sent/failed)
   - Retry failed messages with user confirmation

4. **Rich Embeds for Game Events**
   - Send card lookup results as Discord embeds (card image, name, mana cost, oracle text)
   - Broadcast game state updates (life totals, turn changes) as formatted messages
   - Support custom embed colors and formatting for different event types

**Technical Requirements**:

**SoC: `@repo/discord-integration` package** (Pure API logic):
- Extend with Discord REST API client: `DiscordRestClient` class
  - Methods: `sendMessage()`, `getMessages()`, `getChannels()`, `createEmbed()`
  - Rate limit handling with exponential backoff
  - No React dependencies, returns promises
- Message formatter: `formatDiscordMessage()` utility
  - Handles Discord markdown parsing
  - No UI rendering logic
- Define message schema types: `GameEventMessage`, `CardLookupEmbed`
  - Include version field for schema evolution

**SoC: `apps/web` UI layer** (React components and hooks):
- Create React hooks (consume REST client):
  - `useDiscordChannel()`: Channel selection and metadata
  - `useDiscordMessages()`: Real-time message subscription via Gateway
  - `useSendMessage()`: Message sending with queue and retry logic
- Build UI components (presentation only):
  - `ChannelSelector`: Dropdown for channel selection
  - `MessageList`: Scrollable message display with virtualization
  - `MessageInput`: Text input with markdown preview
  - `MessageEmbed`: Render game event embeds
- No direct Discord API calls in components

**SoC: Data Layer**:
- Message cache in `apps/web/src/stores/messageStore.ts`
- Separate from Discord API client
- Clear cache invalidation strategy

**Success Criteria**:
- Messages appear in Spell Coven UI within 1 second of being sent in Discord
- Messages sent from Spell Coven appear in Discord within 2 seconds
- Rate limits are handled gracefully without message loss
- Card lookup embeds display correctly in both Spell Coven and Discord
- Users can switch between channels without losing message history

**Edge Cases**:
- User lacks permission to send messages in selected channel
- Discord API rate limits exceeded (queue and retry)
- Message content violates Discord's content policy
- Channel is deleted while user is viewing it
- Large message history (pagination and lazy loading)
- Emoji and custom Discord emotes rendering

**Dependencies**:
- Requires Phase 1 (authentication and Gateway connection)

**Constitutional Alignment**:
- ✓ Browser-First: All message operations via client-side REST API calls
- ✓ Data Contracts: Versioned schema for game event embeds
- ✓ User-Centric: Real-time messaging with clear send status

**Client-Side Implementation Note**:
- Messages can be sent using user's OAuth token (messages appear as from the user)
- No backend needed - REST API calls made directly from browser
- User must have permission to send messages in the selected channel
- Rate limits apply per-user (not per-bot)

---

## Phase 3: Discord Voice Channel & Room Management

### Feature Description for `/speckit.specify`

**Feature Name**: Discord Voice Channel Integration and Game Room Coordination

**User Value**: MTG players can create and join game sessions mapped to Discord voice channels, with automatic room setup, player presence tracking, and voice communication infrastructure provided by Discord.

**Core Capabilities**:

1. **Voice Channel Selection**
   - Display list of user's accessible Discord voice channels
   - Show current voice channel occupancy (who's in the channel)
   - Allow users to join/leave voice channels from Spell Coven UI
   - Display voice connection status (connecting/connected/disconnected)

2. **Game Room Creation**
   - Create new Discord voice channel for game session
   - Create paired text channel for game coordination
   - Set channel permissions (private/invite-only or public)
   - Store game metadata in channel topic (format, power level, player count)
   - Generate shareable invite link for game session

3. **Room Metadata Management**
   - Define JSON schema for game room metadata (version, format, power level, max players)
   - Store metadata in Discord channel topic or pinned message
   - Sync metadata updates to Discord in real-time
   - Validate metadata on room join
   - Display room metadata in Spell Coven UI

4. **Player Presence Tracking**
   - Track which players are in voice channel
   - Display player list with Discord avatars and usernames
   - Show voice state (muted, deafened, speaking)
   - Handle players joining/leaving during game
   - Support spectator mode (in text channel but not voice)

5. **Room Lifecycle Management**
   - Implement room states: lobby → in-game → completed
   - Handle room cleanup after game completion
   - Archive game history to text channel (optional)
   - Delete temporary channels or mark as archived

**Technical Requirements**:

**SoC: `@repo/discord-integration` package** (Pure API logic):
- Extend REST client with voice channel methods:
  - `createVoiceChannel()`, `deleteChannel()`, `updateChannelTopic()`
  - `getVoiceChannels()`, `getChannelMembers()`
- Voice state tracker: `VoiceStateManager` class
  - Subscribes to Gateway VOICE_STATE_UPDATE events
  - Maintains voice state cache
  - Emits events for UI consumption
- Room metadata utilities:
  - `encodeRoomMetadata()`, `decodeRoomMetadata()`, `validateRoomMetadata()`
  - Schema validation with Zod or similar
- Define types: `RoomMetadata`, `VoiceState`, `VoiceChannel`

**SoC: `apps/web` UI layer** (React components and hooks):
- Create React hooks (consume voice API):
  - `useDiscordVoiceChannel()`: Voice channel selection and state
  - `useGameRoom()`: Room lifecycle management
  - `useRoomMetadata()`: Metadata CRUD operations
  - `usePlayerPresence()`: Real-time player list updates
- Build UI components (presentation only):
  - `VoiceChannelSelector`: Dropdown with occupancy display
  - `RoomCreator`: Form for room configuration
  - `PlayerList`: Grid of player avatars with voice state indicators
  - `RoomMetadata`: Display and edit room settings
- No direct Discord API calls in components

**SoC: State Management**:
- Room state in `apps/web/src/stores/roomStore.ts`
- Voice state in `apps/web/src/stores/voiceStore.ts`
- Clear separation from Discord client state

**Success Criteria**:
- Users can create game room with Discord voice channel in <15 seconds
- Room metadata syncs to Discord within 2 seconds of updates
- Player presence updates appear in UI within 3 seconds
- Invite links work correctly for both Discord and Spell Coven
- Room cleanup completes within 10 seconds of game end

**Edge Cases**:
- User lacks permission to create channels in server
- Voice channel reaches Discord's capacity limit
- Metadata exceeds Discord channel topic character limit (1024 chars)
- Room creator leaves before game starts
- Network failure during room creation
- Multiple users try to create room simultaneously

**Dependencies**:
- Requires Phase 1 (authentication and Gateway connection)
- Requires Phase 2 (text chat for game coordination)

**Constitutional Alignment**:
- ✓ Browser-First: Channel management via client-side REST API
- ✓ Data Contracts: Versioned room metadata schema with validation
- ✓ User-Centric: Simple room creation with clear player presence

---

## Phase 4: Discord Video Streaming Integration

### Feature Description for `/speckit.specify`

**Feature Name**: Discord Video Streaming for Webcam Feeds

**User Value**: MTG players can stream their overhead webcam views of playmats through Discord's video infrastructure, enabling remote opponents to see their physical cards in real-time without requiring custom WebRTC servers.

**Core Capabilities**:

1. **Discord RTC Connection**
   - Establish Discord RTC (Real-Time Communication) connection for video
   - Use Discord's voice/video WebSocket protocol
   - Handle RTC connection lifecycle (connect/disconnect/reconnect)
   - Display video connection status in UI

2. **Webcam Stream Setup**
   - Enumerate available webcam devices
   - Allow user to select camera for streaming
   - Configure video quality settings (resolution, framerate, bitrate)
   - Preview local webcam feed before streaming
   - Start/stop video stream to Discord voice channel

3. **Multi-Stream Reception**
   - Receive video streams from other players in voice channel
   - Display 2-4 simultaneous video feeds in grid layout
   - Support different view modes (grid, spotlight, focus on active player)
   - Handle stream quality adaptation based on bandwidth
   - Show player name overlay on each video feed

4. **Stream Quality Management**
   - Adapt video quality based on network conditions
   - Support Discord's video quality tiers (720p for Nitro users, 480p standard)
   - Display bandwidth usage and stream health metrics
   - Allow manual quality adjustment
   - Handle graceful degradation on poor connections

5. **Integration with Card Recognition**
   - Capture frames from Discord video stream for card recognition
   - Run CLIP model on received video feeds (not just local camera)
   - Display card identification results for all players' cameras
   - Optimize frame capture rate to balance recognition speed and performance

**Technical Requirements**:

**SoC: `@repo/discord-integration` package** (Pure API logic):
- Extend with RTC connection manager: `DiscordRtcClient` class
  - Methods: `connect()`, `startVideo()`, `stopVideo()`, `setQuality()`
  - Implements Discord Voice/Video protocol (UDP + WebSocket)
  - No browser API dependencies (MediaStream passed as parameter)
  - Event emitters for remote streams
- Video codec negotiation utilities
- Stream quality adapter: `VideoQualityAdapter` class
  - Monitors bandwidth and adjusts quality
  - No UI dependencies
- Define types: `RtcConnection`, `VideoStream`, `StreamQuality`

**SoC: `apps/web` UI layer** (React components and hooks):
- Create React hooks (consume RTC client):
  - `useDiscordVideo()`: RTC connection lifecycle
  - `useVideoStream()`: Local camera access via MediaStream API
  - `useRemoteStreams()`: Subscribe to remote video feeds
  - `useStreamQuality()`: Quality monitoring and adjustment
- Build UI components (presentation only):
  - `CameraSelector`: Dropdown for camera device selection
  - `VideoGrid`: Layout for multiple video feeds
  - `StreamControls`: Start/stop video, mute, quality settings
  - `QualityIndicator`: Bandwidth and stream health display
- No direct Discord RTC protocol handling in components

**SoC: Integration with Card Recognition**:
- Card recognition pipeline in `apps/web/src/lib/card-recognition/`
- Accepts video frames from any source (local or remote)
- No coupling to Discord video implementation
- Use adapter pattern: `VideoFrameAdapter` to extract frames from Discord streams

**Success Criteria**:
- Video stream starts within 10 seconds of user clicking "Start Video"
- Stream latency <200ms under normal network conditions
- Support 2-4 simultaneous 720p streams without frame drops
- Card recognition works on remote video feeds with >80% accuracy
- Automatic quality adaptation maintains smooth playback on varying bandwidth
- Video streams survive network interruptions with auto-reconnect

**Edge Cases**:
- User's camera is already in use by another application
- Browser denies camera permissions
- Discord voice channel doesn't support video (server boost level)
- Network bandwidth insufficient for multiple video streams
- Discord RTC connection fails (fallback to voice-only)
- Video codec not supported by browser
- Stream quality too low for card recognition

**Technical Challenges**:
- Discord's RTC protocol is not fully documented (may require reverse engineering)
- Discord.js library may not support video streaming from browser
- Alternative: Use Discord's "Go Live" screen share feature instead of camera
- Fallback: Implement custom WebRTC if Discord video proves infeasible

**Dependencies**:
- Requires Phase 1 (authentication and Gateway connection)
- Requires Phase 3 (voice channel and room management)
- Integrates with existing card recognition system (Phase 1 of main app)

**Constitutional Alignment**:
- ✓ Browser-First: RTC connections established client-side
- ⚠ Complexity: Discord video protocol may require significant reverse engineering
- ✓ User-Centric: Leverages Discord's proven video infrastructure
- ⚠ Privacy: Requires internet connectivity; not fully offline-capable

**Risk Assessment**:
- **HIGH RISK**: Discord's video streaming protocol may not be accessible from browser JavaScript
- **Mitigation**: Research Discord.js capabilities and Discord Gateway documentation before committing to this phase
- **Fallback Plan**: Implement custom WebRTC peer-to-peer video as originally planned in Phase 2 roadmap

---

## UX Considerations & User Flow

### Landing Page Updates

**Hero Section Messaging**:
- Update copy to emphasize Discord integration: "Play MTG remotely using Discord's voice and video infrastructure"
- Add Discord logo/mention in feature highlights
- Make "Sign In with Discord" button prominent (use Discord brand color #5865F2)

**Header Sign In Button**:
- Replace generic "Sign In" with "Sign In with Discord"
- Show Discord logo icon
- When authenticated: Display user's Discord avatar + username instead

### Authentication Flow

**Trigger Points**:
1. User clicks "Create Game" button → Check auth → Show modal if not authenticated
2. User clicks "Join Game" button → Check auth → Show modal if not authenticated
3. User clicks "Sign In with Discord" in header → Show modal

**Discord Auth Modal Content**:
```
┌────────────────────────────────────────────┐
│  🎮 Connect Discord to Play                │
│                                            │
│  Spell Coven uses Discord for:             │
│  • Voice and video chat                    │
│  • Text messaging                          │
│  • Game room coordination                  │
│                                            │
│  [Connect with Discord]  [Cancel]          │
│                                            │
│  Don't have Discord? Sign up at           │
│  discord.com                               │
└────────────────────────────────────────────┘
```

**OAuth Flow**:
1. User clicks "Connect with Discord"
2. Full-page redirect to Discord OAuth (not popup - better mobile support)
3. Discord shows permission screen (identify, guilds, messages.read)
4. Redirect back to `/auth/discord/callback`
5. Show loading state: "Connecting to Discord..."
6. Exchange code for token, store in localStorage
7. Redirect back to original action (create game or join game)

**Authenticated State**:
- Header shows Discord profile (avatar + username)
- "Create Game" and "Join Game" work immediately
- Connection status indicator shows Gateway state

### Why This Approach?

**Target Audience Alignment**:
- MTG players are gamers who likely already use Discord
- Discord is free and ubiquitous in gaming communities
- Familiar OAuth flow reduces friction

**Technical Benefits**:
- No guest mode complexity
- Consistent feature set for all users
- Leverages Discord's proven infrastructure
- No custom WebRTC signaling servers needed

**User Experience Benefits**:
- Clear value proposition (Discord provides voice/video)
- No feature limitations or "upgrade to unlock" prompts
- Familiar Discord branding builds trust
- Mobile-friendly (full-page redirect, not popup)

---

## Implementation Order Recommendation

### Phase 0: Prerequisites (30-60 minutes)
**Priority: CRITICAL** - Must be completed before any implementation
- Create Discord account (if needed)
- Create Discord application in Developer Portal
- Configure OAuth2 settings and redirect URIs
- Create bot user and enable required intents
- Set up `.env.local` with all credentials
- Create test Discord server (recommended)
- **Deliverable**: All credentials ready, environment configured

### Phase 1a: Discord Auth Gate (Week 1)
**Priority: CRITICAL** - Blocks all other features
- **SoC**: Create `@repo/discord-integration` package structure
- **SoC**: Implement `DiscordOAuthClient` (no UI dependencies)
- **SoC**: Create React hooks that consume OAuth client
- Discord OAuth modal component
- Authentication check on Create/Join game actions
- OAuth callback route handler
- Token storage in localStorage (via hooks, not in client)
- Discord profile display in header
- Landing page messaging updates

### Phase 1b: Gateway Connection (Week 1-2)
- **SoC**: Implement `DiscordGatewayClient` (no React dependencies)
- **SoC**: Create hooks for Gateway connection management
- WebSocket connection to Discord Gateway
- Heartbeat and reconnection logic
- Connection status display

### Phase 2: Text Chat (Week 2-3)
- **SoC**: Implement `DiscordRestClient` for messaging
- **SoC**: Create message store separate from Discord client
- **SoC**: Build UI components that consume hooks only
- Channel selection and message display
- Message sending with rate limiting
- Game event embeds

### Phase 3: Voice Channels (Week 3-4)
- **SoC**: Extend REST client with voice channel methods
- **SoC**: Implement `VoiceStateManager` for presence tracking
- **SoC**: Create room and voice state stores
- Voice channel management
- Room creation and metadata
- Player presence tracking

### Phase 4: Video Streaming (Week 4-7)
**Research feasibility first** - High technical risk
- **SoC**: Implement `DiscordRtcClient` (protocol only, no MediaStream)
- **SoC**: Create adapter for card recognition integration
- **SoC**: Build video UI components separate from RTC logic
- Discord RTC protocol investigation
- Video streaming implementation
- Card recognition integration
- **Fallback**: Custom WebRTC if Discord video proves infeasible

**Critical Path**:
1. Phase 0 must be completed before any implementation
2. Phase 1a must be completed before any other development work
3. Maintain SoC throughout all phases for testability and maintainability

---

## Cross-Phase Considerations

### Package Structure (Enforcing SoC)

**`@repo/discord-integration`** - Pure Discord API logic (no UI, no React):
```
@repo/discord-integration/
├── src/
│   ├── clients/
│   │   ├── DiscordOAuthClient.ts      # OAuth flow (no localStorage)
│   │   ├── DiscordGatewayClient.ts    # WebSocket connection (no React)
│   │   ├── DiscordRestClient.ts       # REST API (no UI)
│   │   └── DiscordRtcClient.ts        # RTC protocol (no MediaStream)
│   ├── managers/
│   │   ├── VoiceStateManager.ts       # Voice state tracking
│   │   └── VideoQualityAdapter.ts     # Quality management
│   ├── utils/
│   │   ├── formatters.ts              # Message formatting
│   │   └── validators.ts              # Schema validation
│   ├── types/
│   │   ├── auth.ts                    # DiscordToken, DiscordUser
│   │   ├── gateway.ts                 # GatewayEvent, VoiceState
│   │   ├── messages.ts                # Message, Embed schemas
│   │   └── rooms.ts                   # RoomMetadata, VoiceChannel
│   └── index.ts                       # Public API exports
├── package.json
└── tsconfig.json
```

**`apps/web`** - UI layer only (React components and hooks):
```
apps/web/src/
├── config/
│   └── discord.ts                     # Read env vars, type-safe config
├── hooks/
│   ├── useDiscordAuth.ts              # Consumes DiscordOAuthClient
│   ├── useDiscordConnection.ts        # Consumes DiscordGatewayClient
│   ├── useDiscordMessages.ts          # Consumes DiscordRestClient
│   ├── useDiscordVideo.ts             # Consumes DiscordRtcClient
│   └── useVideoStream.ts              # MediaStream API wrapper
├── components/
│   ├── discord/
│   │   ├── DiscordAuthModal.tsx       # Presentation only
│   │   ├── DiscordLoginButton.tsx     # Presentation only
│   │   ├── MessageList.tsx            # Presentation only
│   │   └── VideoGrid.tsx              # Presentation only
│   └── ...
├── stores/
│   ├── messageStore.ts                # Message cache (separate from client)
│   ├── roomStore.ts                   # Room state
│   └── voiceStore.ts                  # Voice state
└── lib/
    └── card-recognition/
        └── VideoFrameAdapter.ts       # Adapter for Discord streams
```

**Key SoC Principles**:
- ✓ `@repo/discord-integration` has ZERO React dependencies
- ✓ `@repo/discord-integration` has ZERO browser storage dependencies
- ✓ UI components NEVER import Discord clients directly
- ✓ Hooks are the ONLY bridge between UI and Discord API
- ✓ State management is separate from API clients
- ✓ Types are shared via `@repo/discord-integration/types`

### Data Contracts
- **Discord Token Schema**: `{ accessToken: string, refreshToken: string, expiresAt: number, version: "1.0" }`
- **Room Metadata Schema**: `{ version: "1.0", format: string, powerLevel: number, maxPlayers: number, createdAt: string }`
- **Game Event Schema**: `{ version: "1.0", type: string, data: object, timestamp: string }`

### Testing Strategy (Enabled by SoC)

**Unit Tests** (Easy due to SoC):
- `@repo/discord-integration` clients are pure functions/classes
- No React dependencies = easy to test in isolation
- Mock WebSocket and fetch for Gateway/REST clients
- Test OAuth flow without browser environment
- Test rate limiting logic independently

**Integration Tests**:
- Test hooks with mocked Discord clients
- Test UI components with mocked hooks
- Integration tests with Discord's staging environment (if available)
- Manual testing with real Discord accounts and servers

**Load Testing**:
- Rate limit handling under high message volume
- WebSocket reconnection under network failures
- Video stream quality adaptation

**Benefits of SoC for Testing**:
- ✓ Can test Discord API logic without rendering React components
- ✓ Can test UI components without real Discord connections
- ✓ Can swap Discord implementation without changing UI
- ✓ Faster test execution (no browser needed for API tests)
- ✓ Easier to mock and stub dependencies

### Security Considerations
- Implement Content Security Policy headers
- Validate all Discord API responses
- Sanitize user input before sending to Discord
- Handle Discord rate limits to avoid account suspension
- Document Discord's data retention and privacy policies for users

### Why PKCE? (Browser-First Architecture)

**Problem**: Traditional OAuth requires a `client_secret` which must be kept secure. In a browser-only app, there's no secure place to store secrets.

**Solution**: PKCE (Proof Key for Code Exchange) - RFC 7636
- No client secret needed
- Uses cryptographic challenge/response instead
- Secure for public clients (browsers, mobile apps)
- Supported by Discord OAuth2

**How PKCE Works**:
1. Generate random `code_verifier` (43-128 characters)
2. Create `code_challenge` = SHA256(code_verifier)
3. Send `code_challenge` to Discord during authorization
4. Discord returns authorization code
5. Exchange code + `code_verifier` for access token
6. Discord verifies: SHA256(code_verifier) == code_challenge

**Benefits for Spell Coven**:
- ✓ No backend needed for OAuth
- ✓ No secrets to manage or expose
- ✓ Fully client-side authentication
- ✓ Secure against authorization code interception
- ✓ Aligns with browser-first architecture

### Discord Developer Portal Setup (PKCE Configuration)

**Required Before Implementation**:

1. **Create Discord Application**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application"
   - Name: "Spell Coven" (or your preferred name)
   - Note the **Application ID** (Client ID)

2. **Configure OAuth2 for PKCE**:
   - Navigate to OAuth2 → General
   - **Important**: You do NOT need to copy the Client Secret (not used with PKCE)
   - Add Redirect URIs:
     - Development: `http://localhost:3000/auth/discord/callback`
     - Production: `https://yourdomain.com/auth/discord/callback`
   - Select OAuth2 Scopes: `identify`, `guilds`, `messages.read`
   - **No special PKCE configuration needed** - Discord supports it automatically

3. **Environment Variables** (Client ID only):
   - Add to `apps/web/.env.development`:
   ```env
   VITE_DISCORD_CLIENT_ID=your_client_id_here
   # No CLIENT_SECRET needed - using PKCE!
   ```
   - Safe to commit - no secrets involved

4. **Bot Configuration** (for future phases):
   - Navigate to Bot section
   - Create bot user (needed for Phase 2+ features)
   - Enable "Message Content Intent" for text chat
   - Copy bot token (store securely, only needed if you add backend later)

**Security Notes**:
- ✓ Client ID is public (safe in frontend code and git)
- ✓ No client secret needed with PKCE
- ✓ PKCE flow is secure for browser-only apps
- ✓ Bot token only needed for backend features (Phase 2+)
- ✓ `.env.development` can be committed (contains no secrets)
- ✓ Users can override with `.env.local` for self-hosting (add to `.gitignore`)

### Self-Hosting Option
- Users can create their own Discord application
- Provide configuration UI for custom Discord app credentials
- Document Discord Developer Portal setup process in README
- Support both shared app (default) and self-hosted app modes

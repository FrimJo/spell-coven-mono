# Implementation Plan — Discord Private Voice Rooms

_Reference spec: [`discord-room-spec.md`](../../discord-room-spec.md)_

## 1. Separation of Concerns Overview
- **Frontend (apps/web)** — orchestrate user interaction on `/game/$gameId` (`apps/web/src/routes/game.$gameId.tsx`), handle Discord OAuth (via existing `useDiscordAuth`), invoke backend join/create server functions, and render success/error states including the Discord deep-link UI.
- **Backend server functions (apps/web/src/server)** — encapsulate room lifecycle logic (`discord-rooms.ts`), token signing/verification utilities, and Discord REST orchestration. Expose `createRoom`, `joinRoom`, `ensureUserInGuild`, and cleanup helpers without leaking bot-token calls to the client.
- **Discord integration package (`packages/discord-integration`)** — expand the REST client with role/channel helpers, permission-checked builders, and response validation so application code remains declarative.
- **Gateway worker** — optionally observes voice-state events for cleanup, staying decoupled from synchronous join/create APIs.

## 2. Backend Modules & Flows
- **TokenService (`apps/web/src/server/room-tokens.ts`)**
  - Implement HMAC (HS256) signing & verification using `jose`, loading `ROOM_TOKEN_SECRET` from env via `createServerOnlyFn`.
  - Define payload schema (`v`, `purpose`, `guild_id`, `channel_id`, `role_id`, `creator_id`, `iat`, `exp`, optional `max_seats`, `room_name`, `jti`).
  - Provide helpers: `createRoomInviteToken`, `verifyRoomInviteToken`, and typed error enums.
- **Room creation server fn (`createRoom` enhancement)**
  - Leverage new Discord client helpers to create role + voice channel with safe overwrites.
  - Generate invite token + shareable URL (`/game/${channelId}?t=...`).
  - Return structured payload (channel metadata, token, deep link) for UI copy/share modules.
- **Join server fn (`joinRoom`)**
  - Validate incoming token with `TokenService`; reject missing/expired/invalid tokens.
  - Fetch channel + role, enforce overwrite + permission invariants, and optional seat limits (count voice members via Discord API or gateway cache).
  - Call `ensureUserInGuild` with OAuth access token when needed, then assign the room role.
  - Respond with deep link + room metadata for frontend rendering.
- **Cleanup utilities**
  - Extend existing cleanup scripts (if any) to delete channels & roles once empty/expired, using gateway worker hooks.

## 3. Discord REST Client Extensions (`packages/discord-integration`)
- Add methods: `getChannel`, `getGuildRole`, `createRole`, `deleteRole`, `addMemberRole`, `removeMemberRole`, `countVoiceChannelMembers` (or expose raw voice-state fetch), all with zod validation and audit-log reason support.
- Introduce permission-overwrite builders (`buildDenyEveryone`, `buildAllowRole`, etc.) ensuring safe allow/deny bitfields in one place.
- Centralize Discord-specific error translation (rate limits, missing perms) so server functions can map to spec error codes.

## 4. Frontend Implementation (`apps/web/src/routes/game.$gameId.tsx`)
- Parse query param `t`; if absent, render invite/token error state without hitting backend.
- Use `useDiscordAuth` to enforce PKCE sign-in; trigger login redirect when unauthenticated.
- After auth, call `joinRoom` server fn with `{ channelId: gameId, token: t, accessToken: discordToken.accessToken }` using React Query mutation and display loading states.
- On success, show room metadata + prominent "Open in Discord" button (deep link). Persist relevant state (playerName, join status) in session storage as needed.
- Handle backend error codes (`TOKEN_EXPIRED`, `ROOM_FULL`, etc.) with user-friendly messaging and call-to-action (e.g., request new invite, retry login).

## 5. Creator UX Enhancements (`apps/web/src/components`)
- Update `LandingPage` flow so `createRoom` mutation surfaces generated invite token + share link for copying, alongside the deep link for the creator.
- Provide optional “Regenerate invite” action that refreshes token via `TokenService` (new server fn) without recreating channel/role, respecting expiration windows.

## 6. Observability & Telemetry
- Instrument server functions with structured logs (token `jti`, `channel_id`, error codes) routed through existing logging.
- Surface Discord API failures with actionable context (HTTP status, missing permission) to aid operations.
- Consider feature flags/toggles for staged rollout in non-production environments.

## 7. Testing Strategy
- **Unit tests**
  - Token service signing/verification and invariant checks (expiry, purpose, seat limit).
  - Permission-overwrite builders produce expected bitfields.
- **Integration tests (server)**
  - Mock Discord API responses to validate create/join flows, error mapping, and guild join handling.
- **Frontend tests**
  - Component tests for `/game/$gameId` route states (unauthenticated redirect, join success/error views).
  - Snapshot/interaction tests for share-link UI on the landing page.
- **Manual QA**
  - End-to-end guild join + role assignment in a staging guild.
  - Verify deep links on desktop/mobile Discord clients and ensure expired tokens are rejected.

## 8. Rollout Considerations
- Gate new join flow behind configuration (e.g., `ENABLE_PRIVATE_ROOMS`) to allow incremental release.
- Document required environment variables (`DISCORD_BOT_TOKEN`, `PRIMARY_GUILD_ID`, `ROOM_TOKEN_SECRET`, `DISCORD_CLIENT_ID`, etc.) and expected permissions for the bot role.
- Provide remediation steps for common failure codes (missing `guilds.join`, bot role position) in runbooks.

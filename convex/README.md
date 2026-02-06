# Convex Backend

This directory contains the Convex backend for Spell Coven.

## Setup

### 1. Create Convex Project

Run the following command and follow the prompts:

```bash
bunx convex dev
```

This will:

- Prompt you to log in to Convex (creates account if needed)
- Create a new Convex project
- Generate the `_generated/` folder with types
- Start watching for changes

### 2. Configure Discord OAuth

After creating the project, configure Discord OAuth in the Convex dashboard:

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the following environment variables:

```
AUTH_DISCORD_ID=<your-discord-client-id>
AUTH_DISCORD_SECRET=<your-discord-client-secret>
```

5. In your Discord Developer Portal, add the Convex callback URL:
   - `https://<your-convex-deployment>.convex.site/api/auth/callback/discord`

### 3. Add Convex URL to Local Env

Copy the Convex URL from the dashboard and add to your `.env.development.local`:

```
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

## Directory Structure

```
convex/
├── _generated/     # Auto-generated types (do not edit)
├── auth.ts         # Discord OAuth configuration
├── bans.ts         # Player ban mutations/queries
├── http.ts         # HTTP router for auth callbacks
├── players.ts      # Player join/leave/presence
├── rooms.ts        # Room creation/state management
├── schema.ts       # Database schema
├── signals.ts      # WebRTC signaling
└── tsconfig.json   # TypeScript configuration
```

## Tables

| Table         | Purpose                                   |
| ------------- | ----------------------------------------- |
| `rooms`       | Room metadata (owner, status)             |
| `roomPlayers` | Players in rooms (also used for presence) |
| `roomSignals` | WebRTC signaling messages                 |
| `roomBans`    | Persistent ban records                    |

See `SUPABASE_TO_CONVEX_PLAN.md` for the full data model.

## Development

```bash
# Start Convex dev server (watches for changes)
bunx convex dev

# Run in separate terminal
bun run dev
```

## Migration Status (Phase 3)

The Convex backend is currently in **Phase 3** of the Supabase → Convex migration:

| Feature   | Status     | Notes                    |
| --------- | ---------- | ------------------------ |
| Schema    | ✅ Done    | All tables defined       |
| Presence  | ✅ Done    | `useConvexPresence` hook |
| Signaling | ⏳ Phase 4 | Using Supabase broadcast |
| Auth      | ⏳ Phase 5 | Using Supabase Auth      |

### Phase 3 Notes

Mutations currently accept `userId`/`callerId` as parameters instead of using
`getAuthUserId` from Convex Auth. This is intentional for Phase 3 (presence
migration) since we're still using Supabase Auth.

**In Phase 5**, all mutations will be updated to use `getAuthUserId` for proper
authorization.

### Feature Flag

To revert presence to Supabase, edit `apps/web/src/contexts/PresenceContext.tsx`:

```typescript
const USE_CONVEX_PRESENCE = false // Set to false to use Supabase
```

## Deployment

Convex automatically deploys when you push to production. To manually deploy:

```bash
bunx convex deploy
```

## Observability (Sentry)

The backend uses Sentry for error tracking and tracing. Set the following
environment variables in the Convex dashboard:

```
SENTRY_DSN=...
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=local-dev
```

Use the `triggerSentryError` mutation (development only) to verify ingestion.

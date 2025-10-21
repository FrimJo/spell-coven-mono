# Quick Start Guide: Discord Integration Setup

**Feature**: Discord API Integration for Remote MTG Play  
**Audience**: Developers setting up Discord integration for the first time  
**Time Required**: 30-60 minutes

## Prerequisites

- Discord account (create at [discord.com](https://discord.com) if needed)
- Access to [Discord Developer Portal](https://discord.com/developers/applications)
- Local development environment with Node.js and pnpm

## Phase 0: Discord Developer Portal Setup

### Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Name: **"Spell Coven"** (or your preferred name)
4. Click **"Create"**
5. **Save the Application ID (Client ID)** - you'll need this for `.env.development`

### Step 2: Configure OAuth2 Settings

1. Navigate to **OAuth2 → General** in the left sidebar
2. **Skip the Client Secret** - NOT needed for PKCE flow
3. Click **"Add Redirect"** under **Redirect URIs**:
   - Development: `http://localhost:3000/auth/discord/callback`
   - Production (later): `https://yourdomain.com/auth/discord/callback`
4. Click **"Save Changes"**

### Step 3: Select OAuth2 Scopes

Under **OAuth2 → General**, note the scopes you'll request:

**Phase 1 (Authentication)**:
- `identify` - Get user's Discord username, avatar, ID
- `guilds` - See which Discord servers the user is in
- `messages.read` - Read messages in channels

**Phase 3+ (Voice/Video)** - Add later:
- `rpc` - Voice/video connection
- `rpc.voice.read` - Read voice state
- `rpc.activities.write` - Update user activity (optional)

### Step 4: Create Bot User (Optional - for future backend features)

1. Navigate to **Bot** section in the left sidebar
2. Click **"Add Bot"**
3. Enable **"Message Content Intent"** (required for text chat in Phase 2)
4. **Copy and save the Bot Token** (keep this secure!)
5. **Note**: Bot token only needed if you add a backend server later

### Step 5: Create Test Discord Server (Recommended)

1. Open Discord app or web client
2. Click **"+"** button in server list
3. Select **"Create My Own"**
4. Name: **"Spell Coven Test"**
5. Invite your bot to this server:
   - Go to **OAuth2 → URL Generator** in Developer Portal
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions: `Send Messages`, `Read Message History`, `Manage Channels`
   - Copy generated URL and open in browser
   - Select your test server and authorize

## Local Development Setup

### Step 6: Update Environment Variables

Add to `apps/web/.env.development`:

```env
VITE_DISCORD_CLIENT_ID=your_client_id_here
# Note: No CLIENT_SECRET needed - we use PKCE for client-side OAuth
# Note: BOT_TOKEN only needed if we add a backend later
```

**Important**: 
- Client ID is **public** and **safe to commit** to git
- This file can be committed (contains no secrets)
- Users can override with `.env.local` for self-hosting (gitignored)

### Step 7: Install Dependencies

```bash
# From repository root
pnpm install

# Add discord-api-types to the new package
cd packages/discord-integration
pnpm add discord-api-types zod
pnpm add -D vitest @types/node

# Add package dependency to web app
cd ../../apps/web
pnpm add @repo/discord-integration@workspace:*
```

### Step 8: Verify Setup

1. Start the development server:
   ```bash
   pnpm --filter @repo/web dev
   ```

2. Open http://localhost:3000
3. Click **"Create Game"** (should show Discord auth modal)
4. Click **"Connect with Discord"**
5. You should be redirected to Discord OAuth page
6. Authorize the app
7. You should be redirected back to Spell Coven with your Discord profile visible

## Security Checklist

Before proceeding to implementation:

- ✅ Using PKCE flow - no Client Secret needed in browser
- ✅ Bot Token is NOT in version control (only needed for backend)
- ✅ Client ID is public and **safe to commit** to git
- ✅ `.env.development` can be committed - contains no secrets
- ✅ Test server created for safe testing
- ✅ OAuth redirect URIs configured correctly

## Troubleshooting

### "Invalid OAuth2 redirect_uri"
- Verify redirect URI in Discord Developer Portal matches exactly: `http://localhost:3000/auth/discord/callback`
- Check for trailing slashes (should not have one)
- Ensure port 3000 matches your dev server

### "Invalid client_id"
- Double-check Client ID in `.env.development` matches Application ID in Developer Portal
- Restart dev server after changing `.env.development`

### "Access denied" during OAuth
- User clicked "Cancel" on Discord OAuth page
- Implement retry logic in auth modal

### Bot not appearing in server
- Check bot permissions in OAuth URL Generator
- Ensure bot is not banned from server
- Verify bot token is valid (if using backend)

## Next Steps

1. ✅ Discord Developer Portal configured
2. ✅ Local environment set up
3. ✅ OAuth flow tested manually
4. → Proceed to implementation (Phase 1: Authentication)
5. → Review `IMPLEMENTATION_GUIDE.md` for architecture details
6. → Review `data-model.md` for entity schemas
7. → Review `contracts/` for API contracts

## Resources

- **Discord API Docs**: https://discord.com/developers/docs
- **PKCE RFC 7636**: https://datatracker.ietf.org/doc/html/rfc7636
- **Implementation Guide**: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- **Data Model**: [data-model.md](./data-model.md)
- **API Contracts**: [contracts/](./contracts/)

## Support

If you encounter issues:
1. Check Discord Developer Portal configuration
2. Verify environment variables are set correctly
3. Review browser console for errors
4. Check Discord API status: https://discordstatus.com
5. Refer to IMPLEMENTATION_GUIDE.md for detailed architecture

## Quick Start Complete

You're now ready to implement the Discord integration! Start with Phase 1 (Authentication) and refer to the implementation guide for detailed instructions.

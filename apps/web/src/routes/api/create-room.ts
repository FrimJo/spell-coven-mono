import { createFileRoute } from '@tanstack/react-router'
import { CreateRoomRequestSchema, CreateRoomResponseSchema } from '@/server/schemas';
import { extractBearerToken, verifyJWT } from '@/server/jwt';
import { createVoiceChannel } from '@/server/discord';
import { wsManager } from '@/server/ws-manager';

/**
 * POST /api/create-room
 * 
 * Create a Discord voice channel for a game session
 * 
 * Headers:
 *   Authorization: Bearer <jwt>
 * 
 * Body:
 *   {
 *     "name": "spell-coven-abc123",
 *     "parentId": "1234567890123456789", // optional
 *     "userLimit": 4 // optional, default 4
 *   }
 * 
 * Response:
 *   {
 *     "channelId": "1234567890123456789",
 *     "name": "spell-coven-abc123",
 *     "guildId": "9876543210987654321"
 *   }
 */
export const Route = createFileRoute('/api/create-room')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
    try {
      // Extract and verify JWT
      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);
      
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Missing Authorization header' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      const jwtConfig = {
        issuer: process.env.JWT_ISSUER!,
        audience: process.env.JWT_AUDIENCE!,
        jwksUrl: process.env.JWT_PUBLIC_JWK_URL!,
      };
      
      try {
        await verifyJWT(token, jwtConfig);
      } catch (error) {
        console.error('[API] JWT verification failed:', error);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Parse and validate request body
      const body = await request.json();
      const parseResult = CreateRoomRequestSchema.safeParse(body);
      
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request body', details: parseResult.error.issues }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      const { name, parentId, userLimit } = parseResult.data;
      
      // Get configuration
      const botToken = process.env.DISCORD_BOT_TOKEN!;
      const guildId = process.env.PRIMARY_GUILD_ID!;
      
      // Generate channel name if not provided
      const channelName = name || `spell-coven-${Date.now().toString(36)}`;
      
      // Create voice channel in Discord
      console.log(`[API] Creating voice channel: ${channelName}`);
      const channel = await createVoiceChannel(botToken, {
        name: channelName,
        guildId,
        parentId,
        userLimit,
      });
      
      // Prepare response
      const response = CreateRoomResponseSchema.parse({
        channelId: channel.id,
        name: channel.name,
        guildId: channel.guild_id,
      });
      
      // Broadcast room.created event to WebSocket clients
      wsManager.broadcastToGuild(guildId, 'room.created', {
        channelId: channel.id,
        name: channel.name,
        guildId: channel.guild_id,
        parentId: channel.parent_id,
        userLimit: channel.user_limit ?? 0,
      });
      
      console.log(`[API] Voice channel created: ${channel.id}`);
      
      return new Response(JSON.stringify(response), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[API] Failed to create room:', error);
      
      if (error instanceof Error) {
        return new Response(
          JSON.stringify({ error: 'Failed to create room', message: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
      },
    },
  },
});

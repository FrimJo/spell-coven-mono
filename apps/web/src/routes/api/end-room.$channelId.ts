import { createFileRoute } from '@tanstack/react-router'
import { DeleteRoomResponseSchema } from '@/server/schemas';
import { extractBearerToken, verifyJWT } from '@/server/jwt';
import { deleteChannel } from '@/server/discord';
import { wsManager } from '@/server/ws-manager';

/**
 * DELETE /api/end-room/:channelId
 * 
 * Delete a Discord voice channel
 * 
 * Headers:
 *   Authorization: Bearer <jwt>
 * 
 * Response:
 *   {
 *     "ok": true
 *   }
 */
export const Route = createFileRoute('/api/end-room/$channelId')({
  server: {
    handlers: {
      DELETE: async ({ request, params }: { request: Request; params: { channelId: string } }) => {
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
      
      // Get channel ID from params
      const { channelId } = params;
      
      if (!channelId || !/^\d+$/.test(channelId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid channel ID' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Get configuration
      const botToken = process.env.DISCORD_BOT_TOKEN!;
      const guildId = process.env.PRIMARY_GUILD_ID!;
      
      // Delete channel in Discord
      console.log(`[API] Deleting voice channel: ${channelId}`);
      await deleteChannel(botToken, channelId);
      
      // Broadcast room.deleted event to WebSocket clients
      wsManager.broadcastToGuild(guildId, 'room.deleted', {
        channelId,
        guildId,
      });
      
      console.log(`[API] Voice channel deleted: ${channelId}`);
      
      const response = DeleteRoomResponseSchema.parse({ ok: true });
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[API] Failed to delete room:', error);
      
      if (error instanceof Error) {
        // Check if channel not found
        if (error.message.includes('404')) {
          return new Response(
            JSON.stringify({ error: 'Channel not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Check if permission error
        if (error.message.includes('403')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions to delete channel' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to delete room', message: error.message }),
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

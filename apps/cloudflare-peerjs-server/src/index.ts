/**
 * Cloudflare Workers Entry Point
 *
 * Main HTTP request handler that routes requests to appropriate handlers
 * and manages WebSocket upgrades for PeerJS signaling
 */

import { handleHealth, handleMetrics } from "./handlers/health";
import { createLogger } from "./lib/logger";

const logger = createLogger({ component: "worker" });

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string; // Comma-separated list of allowed CORS origins
}

/**
 * Main request handler for Cloudflare Worker
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle OPTIONS requests for CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: getCorsHeaders(env),
      });
    }
    const url = new URL(request.url);

    try {
      // Health check endpoint
      if (url.pathname === "/health") {
        return handleHealth(request, env);
      }

      // Metrics endpoint (stub)
      if (url.pathname === "/metrics") {
        return handleMetrics(request, env);
      }

      // PeerJS WebSocket signaling endpoint
      if (url.pathname === "/peerjs") {
        return handlePeerJS(request, env);
      }

      // 404 for unknown routes
      return new Response("Not Found", { status: 404 });
    } catch (error) {
      logger.error("Request handling error", error, { path: url.pathname });
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};

/**
 * Handle PeerJS WebSocket signaling requests
 */
async function handlePeerJS(request: Request, env: Env): Promise<Response> {
  // Extract query parameters
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const peerId = url.searchParams.get("id");
  const token = url.searchParams.get("token");

  // Validate required parameters
  if (!key || !peerId || !token) {
    return new Response("Missing required query parameters: key, id, token", {
      status: 400,
    });
  }

  // Use token (Discord channel ID) as room ID for Durable Object
  const roomId = env.GAME_ROOM.idFromName(token);

  // Get Durable Object instance for this room
  const gameRoom = env.GAME_ROOM.get(roomId);

  // Forward request to Durable Object for WebSocket upgrade
  return gameRoom.fetch(request);
}

/**
 * Get CORS headers for cross-origin requests
 */
function getCorsHeaders(env: Env): Record<string, string> {
  // Get allowed origins from environment or default to wildcard
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(",") || ["*"];
  const origin = allowedOrigins.includes("*")
    ? "*"
    : (allowedOrigins[0] ?? "*");

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

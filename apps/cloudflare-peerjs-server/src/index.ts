/**
 * Cloudflare Workers Entry Point
 *
 * Main HTTP request handler that routes requests to appropriate handlers
 * and manages WebSocket upgrades for PeerJS signaling
 */

import { handleHealth, handleMetrics } from "./handlers/health";
import { createLogger } from "./lib/logger";
import { GameRoomCoordinator } from "./durable-objects/GameRoomCoordinator";

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
      // PeerJS library appends /peerjs to the path you provide,
      // so if path is set to '/peerjs', it becomes '/peerjs/peerjs'
      // Forward to Durable Object which will handle WebSocket upgrade validation
      if (url.pathname === "/peerjs/peerjs") {
        return handlePeerJS(request, env);
      }

      // 404 for unknown routes
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      logger.error("Request handling error", error, { path: url.pathname });
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};

// Export Durable Object class for Cloudflare Workers
export { GameRoomCoordinator };

/**
 * Handle PeerJS WebSocket signaling requests
 */
async function handlePeerJS(request: Request, env: Env): Promise<Response> {
  try {
    logger.info("handlePeerJS called", {
      url: request.url,
      method: request.method,
      upgrade: request.headers.get("Upgrade"),
    });

    // Extract token from query parameters to determine which room
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    // Token is required to determine which Durable Object (room) to use
    if (!token) {
      logger.warn("Missing token parameter", { url: request.url });
      return new Response(
        JSON.stringify({ error: "Missing required query parameter: token" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Use token (Discord channel ID) as room ID for Durable Object
    const roomId = env.GAME_ROOM.idFromName(token);
    logger.info("Routing to Durable Object", {
      token,
      roomId: roomId.toString(),
    });

    // Get Durable Object instance for this room
    const gameRoom = env.GAME_ROOM.get(roomId);

    // Forward request to Durable Object for WebSocket upgrade
    // The Durable Object will handle all validation and WebSocket upgrade
    logger.info("Calling Durable Object fetch", { roomId: roomId.toString() });
    const response = await gameRoom.fetch(request);

    logger.info("Durable Object returned response", {
      status: response.status,
      hasWebSocket: "webSocket" in response,
    });

    // Ensure the response is returned as-is (don't modify WebSocket responses)
    return response;
  } catch (error) {
    logger.error("Error in handlePeerJS", error, {
      url: request.url,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    // Return a proper JSON error response instead of throwing
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
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

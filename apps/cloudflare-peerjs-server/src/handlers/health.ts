/**
 * Health Check Endpoint Handler
 * 
 * Provides health check and metrics endpoints for monitoring
 */

import { createLogger } from '../lib/logger';

const logger = createLogger({ component: 'health' });

/**
 * Handle health check endpoint
 * Returns 200 OK if the Worker is running
 */
export function handleHealth(request: Request, env?: { ALLOWED_ORIGINS?: string }): Response {
  const healthResponse = {
    status: 'ok',
    timestamp: Date.now(),
    version: '1.0.0',
  };

  logger.debug('Health check requested', { timestamp: healthResponse.timestamp });

  return new Response(JSON.stringify(healthResponse), {
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(env),
    },
  });
}

/**
 * Handle metrics endpoint (stub implementation)
 * Returns basic metrics about the signaling server
 */
export function handleMetrics(request: Request, env?: { ALLOWED_ORIGINS?: string }): Response {
  // TODO: Implement actual metrics collection from Durable Objects
  const metrics = {
    status: 'ok',
    timestamp: Date.now(),
    metrics: {
      activeRooms: 0,
      activePeers: 0,
      messagesPerSecond: 0,
      errorRate: 0,
    },
  };

  logger.debug('Metrics requested', { timestamp: metrics.timestamp });

  return new Response(JSON.stringify(metrics), {
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(env),
    },
  });
}

/**
 * Get CORS headers for cross-origin requests
 */
function getCorsHeaders(env?: { ALLOWED_ORIGINS?: string }): Record<string, string> {
  // Get allowed origins from environment or default to wildcard
  const allowedOrigins = env?.ALLOWED_ORIGINS?.split(',').filter(Boolean) || ['*'];
  const origin = allowedOrigins.includes('*') ? '*' : (allowedOrigins[0] as string);
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}


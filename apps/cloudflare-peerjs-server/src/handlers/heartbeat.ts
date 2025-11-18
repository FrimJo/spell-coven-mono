/**
 * Heartbeat Message Handler
 * 
 * Handles HEARTBEAT messages from peers to maintain connection liveness
 */

import type { HeartbeatMessage } from '../protocol/messages';
import type { Peer } from '../lib/peer-registry';
import { createLogger } from '../lib/logger';

const logger = createLogger({ component: 'heartbeat' });

/**
 * Handle HEARTBEAT message from a peer
 * Updates the peer's lastHeartbeat timestamp
 */
export function handleHeartbeat(
  message: HeartbeatMessage,
  peer: Peer,
  updateHeartbeat: (peerId: string) => boolean
): void {
  logger.debug('Heartbeat received', { peerId: peer.id });
  
  // Update heartbeat timestamp
  const updated = updateHeartbeat(peer.id);
  if (!updated) {
    logger.warn('Failed to update heartbeat for peer', { peerId: peer.id });
  }
}


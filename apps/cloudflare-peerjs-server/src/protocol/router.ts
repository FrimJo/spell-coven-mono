/**
 * Message Router
 * 
 * Routes PeerJS protocol messages between peers in a game room
 */

import type {
  OfferMessage,
  AnswerMessage,
  CandidateMessage,
  LeaveMessage,
  ServerOfferMessage,
  ServerAnswerMessage,
  ServerCandidateMessage,
  ServerLeaveMessage,
} from './messages';
import type { Peer } from '../lib/peer-registry';
import { createLogger } from '../lib/logger';

const logger = createLogger({ component: 'router' });

/**
 * Route OFFER message from source peer to destination peer
 */
export function routeOffer(
  message: OfferMessage,
  srcPeer: Peer,
  getPeer: (peerId: string) => Peer | undefined
): boolean {
  const dstPeer = getPeer(message.dst);
  
  if (!dstPeer) {
    logger.warn('Destination peer not found for OFFER', {
      src: message.src,
      dst: message.dst,
    });
    return false;
  }

  // Transform client message to server message format
  const serverMessage: ServerOfferMessage = {
    type: 'OFFER',
    src: message.src,
    payload: message.payload,
  };

  // Send to destination peer
  try {
    dstPeer.connection.send(JSON.stringify(serverMessage));
    logger.debug('OFFER routed', {
      src: message.src,
      dst: message.dst,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send OFFER message', error, {
      src: message.src,
      dst: message.dst,
    });
    return false;
  }
}

/**
 * Route ANSWER message from source peer to destination peer
 */
export function routeAnswer(
  message: AnswerMessage,
  srcPeer: Peer,
  getPeer: (peerId: string) => Peer | undefined
): boolean {
  const dstPeer = getPeer(message.dst);
  
  if (!dstPeer) {
    logger.warn('Destination peer not found for ANSWER', {
      src: message.src,
      dst: message.dst,
    });
    return false;
  }

  // Transform client message to server message format
  const serverMessage: ServerAnswerMessage = {
    type: 'ANSWER',
    src: message.src,
    payload: message.payload,
  };

  // Send to destination peer
  try {
    dstPeer.connection.send(JSON.stringify(serverMessage));
    logger.debug('ANSWER routed', {
      src: message.src,
      dst: message.dst,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send ANSWER message', error, {
      src: message.src,
      dst: message.dst,
    });
    return false;
  }
}

/**
 * Route CANDIDATE message from source peer to destination peer
 */
export function routeCandidate(
  message: CandidateMessage,
  srcPeer: Peer,
  getPeer: (peerId: string) => Peer | undefined
): boolean {
  const dstPeer = getPeer(message.dst);
  
  if (!dstPeer) {
    logger.warn('Destination peer not found for CANDIDATE', {
      src: message.src,
      dst: message.dst,
    });
    return false;
  }

  // Transform client message to server message format
  const serverMessage: ServerCandidateMessage = {
    type: 'CANDIDATE',
    src: message.src,
    payload: message.payload,
  };

  // Send to destination peer
  try {
    dstPeer.connection.send(JSON.stringify(serverMessage));
    logger.debug('CANDIDATE routed', {
      src: message.src,
      dst: message.dst,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send CANDIDATE message', error, {
      src: message.src,
      dst: message.dst,
    });
    return false;
  }
}

/**
 * Broadcast LEAVE message to all other peers in the room
 */
export function routeLeave(
  message: LeaveMessage,
  srcPeer: Peer,
  getAllPeers: () => Peer[],
  getOtherPeers: (excludePeerId: string) => Peer[]
): void {
  const otherPeers = getOtherPeers(message.src);
  
  // Transform client message to server message format
  const serverMessage: ServerLeaveMessage = {
    type: 'LEAVE',
    peerId: message.src,
  };

  // Broadcast to all other peers
  let successCount = 0;
  for (const peer of otherPeers) {
    try {
      peer.connection.send(JSON.stringify(serverMessage));
      successCount++;
    } catch (error) {
      logger.error('Failed to send LEAVE message', error, {
        leavingPeer: message.src,
        targetPeer: peer.id,
      });
    }
  }

  logger.debug('LEAVE broadcasted', {
    leavingPeer: message.src,
    notifiedPeers: successCount,
    totalPeers: otherPeers.length,
  });
}


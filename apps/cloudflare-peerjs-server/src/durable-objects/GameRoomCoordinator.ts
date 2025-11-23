/**
 * Game Room Coordinator Durable Object
 *
 * Manages WebSocket connections and peer coordination for a single game room.
 * Each game room is represented by a Durable Object instance.
 *
 * Implements PeerJS protocol v0.3.x for WebRTC signaling coordination.
 */

import { PeerRegistry, type Peer } from "../lib/peer-registry";
import { RateLimiter } from "../lib/rate-limiter";
import {
  validateClientMessage,
  validatePeerId,
  validateMessageSize,
} from "../protocol/validator";
import type {
  ClientMessage,
  OpenMessage,
  ServerErrorMessage,
} from "../protocol/messages";
import { handleHeartbeat } from "../handlers/heartbeat";
import {
  routeOffer,
  routeAnswer,
  routeCandidate,
  routeLeave,
} from "../protocol/router";
import { createLogger } from "../lib/logger";

const logger = createLogger({ component: "GameRoomCoordinator" });

interface QueuedMessage {
  message: ClientMessage;
  timestamp: number;
  senderId: string;
}

export class GameRoomCoordinator {
  private state: DurableObjectState;
  private env: unknown;
  private peerRegistry: PeerRegistry;
  private rateLimiter: RateLimiter;
  private lastActivityAt: number;
  // Queue for messages (especially CANDIDATE) sent to peers that haven't registered yet
  // Key: destination peer ID, Value: array of queued messages
  private messageQueue: Map<string, QueuedMessage[]>;
  // Maximum time to keep messages in queue (5 seconds)
  private readonly MESSAGE_QUEUE_TIMEOUT_MS = 5000;
  // Maximum number of messages to queue per peer (prevent memory issues)
  private readonly MAX_QUEUED_MESSAGES_PER_PEER = 50;

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
    this.env = env;
    this.peerRegistry = new PeerRegistry({
      maxPeers: 4,
      heartbeatTimeout: 5000,
    });
    this.rateLimiter = new RateLimiter({
      maxMessages: 100,
      windowDuration: 1000,
    });
    this.lastActivityAt = Date.now();
    this.messageQueue = new Map();

    // Configure WebSocket Hibernation API
    // This allows the Durable Object to hibernate while maintaining WebSocket connections
    // The object will automatically reactivate when a WebSocket message arrives
    // We track lastActivityAt to monitor hibernation state
  }

  /**
   * Handle HTTP requests and WebSocket upgrades
   * This method is called for all requests routed to this Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade request
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    // HTTP request (should not happen for /peerjs endpoint)
    logger.warn("Received HTTP request to Durable Object", {
      path: url.pathname,
    });
    return new Response("WebSocket upgrade required", { status: 426 });
  }

  /**
   * Handle WebSocket upgrade request
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    // Extract query parameters
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const peerId = url.searchParams.get("id");
    const token = url.searchParams.get("token");

    logger.info("WebSocket upgrade requested", { peerId, token });

    // Validate required parameters
    if (!key || !peerId || !token) {
      logger.warn("Missing required query parameters", {
        key: String(!!key),
        peerId: String(!!peerId),
        token: String(!!token),
      });
      return new Response("Missing required query parameters: key, id, token", {
        status: 400,
      });
    }

    // Validate peer ID format
    if (!validatePeerId(peerId)) {
      logger.warn("Invalid peer ID format", { peerId });
      return new Response("Invalid peer ID format", { status: 400 });
    }

    // Check if room is full
    if (this.peerRegistry.isFull()) {
      logger.warn("Room is full", {
        peerId,
        currentPeers: this.peerRegistry.getPeerCount(),
      });
      return new Response("Room is full", { status: 429 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0];
    const server = webSocketPair[1];

    // Accept the WebSocket connection
    this.state.acceptWebSocket(server);

    // Add peer to registry
    const added = this.peerRegistry.addPeer(peerId, server);
    if (!added) {
      logger.warn("Failed to add peer to registry", { peerId });
      server.close(1000, "Failed to register peer");
      return new Response("Failed to register peer", { status: 500 });
    }

    // Update activity timestamp
    this.lastActivityAt = Date.now();

    // Process any queued messages for this peer now that they're registered
    this.processQueuedMessages(peerId);

    // Return WebSocket upgrade response immediately
    // This must be returned synchronously for the upgrade to complete
    const response = new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
      },
    });

    // Send OPEN message asynchronously after Response is returned
    // Use void to explicitly mark that we're not awaiting this
    // The Response must be returned immediately for the upgrade to work
    void Promise.resolve()
      .then(() => {
        try {
          const openMessage: OpenMessage = {
            type: "OPEN",
            peerId: peerId,
          };
          server.send(JSON.stringify(openMessage));
          logger.info("Peer registered and OPEN message sent", { peerId });
        } catch (error) {
          logger.error("Failed to send OPEN message", error, { peerId });
          // Don't close the connection here - it's already established
          // The peer will timeout if it doesn't receive OPEN message
        }
      })
      .catch((error) => {
        // Prevent unhandled promise rejection
        logger.error("Unhandled error sending OPEN message", error, { peerId });
      });

    return response;
  }

  /**
   * Handle incoming WebSocket message
   * Called automatically by Cloudflare Workers when a message arrives
   */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    this.lastActivityAt = Date.now();

    // Find peer by WebSocket connection
    const peer = this.findPeerByWebSocket(ws);
    if (!peer) {
      logger.warn("Received message from unknown peer", {});
      return;
    }

    // Validate message size
    const messageStr =
      typeof message === "string" ? message : new TextDecoder().decode(message);
    if (!validateMessageSize(messageStr)) {
      logger.warn("Message size exceeds limit", { peerId: peer.id });
      this.sendError(peer, "invalid-message", "Message size exceeds 1MB limit");
      return;
    }

    // Parse message
    let parsedMessage: unknown;
    try {
      parsedMessage = JSON.parse(messageStr);
    } catch (error) {
      logger.warn("Failed to parse message JSON", { peerId: peer.id, error });
      this.sendError(peer, "invalid-message", "Invalid JSON format");
      return;
    }

    // Validate message format
    const validation = validateClientMessage(parsedMessage);
    if (!validation.success) {
      logger.warn("Invalid message format", {
        peerId: peer.id,
        error: validation.error,
      });
      this.sendError(
        peer,
        "invalid-message",
        validation.error || "Invalid message format"
      );
      return;
    }

    // Check rate limit
    if (!this.rateLimiter.checkLimit(peer.id)) {
      logger.warn("Rate limit exceeded", { peerId: peer.id });
      this.sendError(
        peer,
        "rate-limit-exceeded",
        "Rate limit exceeded (100 messages/second)"
      );
      return;
    }

    // Route message based on type
    const clientMessage = validation.data!;

    // Process heartbeat messages immediately to update timestamp before timeout check
    if (clientMessage.type === "HEARTBEAT") {
      handleHeartbeat(clientMessage, peer, (peerId) =>
        this.peerRegistry.updateHeartbeat(peerId)
      );
      // Check for timed-out peers after processing heartbeat
      this.checkHeartbeatTimeouts();
      return;
    }

    // Check for timed-out peers before processing other message types
    this.checkHeartbeatTimeouts();

    // Periodically clean up expired queued messages (every ~100 messages)
    if (Math.random() < 0.01) {
      this.cleanupExpiredQueuedMessages();
    }

    await this.routeMessage(clientMessage, peer);
  }

  /**
   * Route message to appropriate handler
   */
  private async routeMessage(
    message: ClientMessage,
    peer: Peer
  ): Promise<void> {
    // Validate that src matches the peer sending the message (prevent spoofing)
    if ("src" in message && message.src !== peer.id) {
      logger.warn("Message src does not match peer ID", {
        peerId: peer.id,
        messageSrc: message.src,
      });
      this.sendError(
        peer,
        "invalid-message",
        "Message src does not match peer ID"
      );
      return;
    }

    switch (message.type) {
      // HEARTBEAT is handled earlier in webSocketMessage to update timestamp before timeout check
      case "OFFER":
        // Check if destination peer exists
        if (!this.peerRegistry.hasPeer(message.dst)) {
          // Queue the OFFER message instead of rejecting it
          // This handles the race condition where an OFFER is sent
          // before the destination peer has fully registered with the server
          const queued = this.queueMessage(message, peer.id);
          if (queued) {
            logger.debug("Queued OFFER for peer not yet registered", {
              src: message.src,
              dst: message.dst,
              queueSize: this.messageQueue.get(message.dst)?.length || 0,
            });
          } else {
            logger.warn("Failed to queue OFFER - queue full or too old", {
              src: message.src,
              dst: message.dst,
            });
            this.sendError(
              peer,
              "unknown-peer",
              `Destination peer not found: ${message.dst}`
            );
          }
          return;
        }
        routeOffer(message, peer, (peerId) =>
          this.peerRegistry.getPeer(peerId)
        );
        break;

      case "ANSWER":
        // Check if destination peer exists
        if (!this.peerRegistry.hasPeer(message.dst)) {
          // Queue the ANSWER message instead of rejecting it
          // This handles the race condition where an ANSWER is sent
          // before the destination peer has fully registered with the server
          const queued = this.queueMessage(message, peer.id);
          if (queued) {
            logger.debug("Queued ANSWER for peer not yet registered", {
              src: message.src,
              dst: message.dst,
              queueSize: this.messageQueue.get(message.dst)?.length || 0,
            });
          } else {
            logger.warn("Failed to queue ANSWER - queue full or too old", {
              src: message.src,
              dst: message.dst,
            });
            this.sendError(
              peer,
              "unknown-peer",
              `Destination peer not found: ${message.dst}`
            );
          }
          return;
        }
        routeAnswer(message, peer, (peerId) =>
          this.peerRegistry.getPeer(peerId)
        );
        break;

      case "CANDIDATE":
        // Check if destination peer exists
        if (!this.peerRegistry.hasPeer(message.dst)) {
          // Queue the CANDIDATE message instead of rejecting it
          // This handles the common race condition where ICE candidates are generated
          // before the destination peer has fully registered with the server
          const queued = this.queueMessage(message, peer.id);
          if (queued) {
            logger.debug("Queued CANDIDATE for peer not yet registered", {
              src: message.src,
              dst: message.dst,
              queueSize: this.messageQueue.get(message.dst)?.length || 0,
            });
          } else {
            logger.warn("Failed to queue CANDIDATE - queue full or too old", {
              src: message.src,
              dst: message.dst,
            });
            this.sendError(
              peer,
              "unknown-peer",
              `Destination peer not found: ${message.dst}`
            );
          }
          return;
        }
        routeCandidate(message, peer, (peerId) =>
          this.peerRegistry.getPeer(peerId)
        );
        break;

      case "LEAVE":
        routeLeave(
          message,
          peer,
          () => this.peerRegistry.getAllPeers(),
          (excludePeerId) => this.peerRegistry.getOtherPeers(excludePeerId)
        );
        // Remove peer from registry after broadcasting LEAVE
        this.peerRegistry.removePeer(message.src);
        break;

      default:
        logger.warn("Unknown message type", {
          peerId: peer.id,
          messageType: (message as { type: string }).type,
        });
        this.sendError(peer, "invalid-message", "Unknown message type");
    }
  }

  /**
   * Handle WebSocket close event
   */
  async webSocketClose(ws: WebSocket): Promise<void> {
    const peer = this.findPeerByWebSocket(ws);
    if (peer) {
      logger.info("Peer disconnected", { peerId: peer.id });
      this.cleanupPeer(peer.id, false);
    }
  }

  /**
   * Handle WebSocket error event
   */
  async webSocketError(ws: WebSocket): Promise<void> {
    const peer = this.findPeerByWebSocket(ws);
    if (peer) {
      logger.error("WebSocket error", new Error("WebSocket error"), {
        peerId: peer.id,
      });
      this.cleanupPeer(peer.id, false);
    }
  }

  /**
   * Cleanup peer and notify other peers
   * @param peerId - ID of peer to cleanup
   * @param expired - Whether peer expired due to timeout (sends EXPIRE) or disconnected (sends LEAVE)
   */
  private cleanupPeer(peerId: string, expired: boolean): void {
    const peer = this.peerRegistry.getPeer(peerId);
    if (!peer) {
      return;
    }

    // Remove peer from registry
    this.peerRegistry.removePeer(peerId);

    // Reset rate limiter for this peer
    this.rateLimiter.reset(peerId);

    // Get other peers to notify
    const otherPeers = this.peerRegistry.getOtherPeers(peerId);

    // Send appropriate message based on expiration status
    const message = expired
      ? { type: "EXPIRE" as const, peerId: peerId }
      : { type: "LEAVE" as const, peerId: peerId };

    // Broadcast message to all other peers
    for (const otherPeer of otherPeers) {
      try {
        otherPeer.connection.send(JSON.stringify(message));
      } catch (error) {
        logger.error(
          `Failed to send ${expired ? "EXPIRE" : "LEAVE"} message`,
          error,
          {
            peerId: peerId,
            targetPeer: otherPeer.id,
          }
        );
      }
    }

    logger.info(`Peer ${expired ? "expired" : "disconnected"} and cleaned up`, {
      peerId,
      notifiedPeers: otherPeers.length,
    });
  }

  /**
   * Check for timed-out peers and expire them
   * Should be called periodically (e.g., on each message or via alarm)
   */
  private checkHeartbeatTimeouts(): void {
    const timedOutPeers = this.peerRegistry.getTimedOutPeers();

    for (const peer of timedOutPeers) {
      logger.warn("Peer heartbeat timeout detected", {
        peerId: peer.id,
        lastHeartbeat: peer.lastHeartbeat,
        timeout: this.peerRegistry.getStats().timedOutCount,
      });

      // Cleanup expired peer (sends EXPIRE message)
      this.cleanupPeer(peer.id, true);
    }
  }

  /**
   * Find peer by WebSocket connection
   */
  private findPeerByWebSocket(ws: WebSocket): Peer | undefined {
    for (const peer of this.peerRegistry.getAllPeers()) {
      if (peer.connection === ws) {
        return peer;
      }
    }
    return undefined;
  }

  /**
   * Queue a message for a peer that hasn't registered yet
   * Returns true if message was queued, false if queue is full or message is too old
   */
  private queueMessage(message: ClientMessage, senderId: string): boolean {
    if (!("dst" in message)) {
      return false;
    }

    const dstPeerId = message.dst;
    const now = Date.now();

    // Get or create queue for this peer
    let queue = this.messageQueue.get(dstPeerId);
    if (!queue) {
      queue = [];
      this.messageQueue.set(dstPeerId, queue);
    }

    // Clean up old messages from queue
    queue = queue.filter(
      (qm) => now - qm.timestamp < this.MESSAGE_QUEUE_TIMEOUT_MS
    );

    // Check if queue is full
    if (queue.length >= this.MAX_QUEUED_MESSAGES_PER_PEER) {
      logger.warn("Message queue full for peer", {
        peerId: dstPeerId,
        queueSize: queue.length,
      });
      return false;
    }

    // Add message to queue
    queue.push({
      message,
      timestamp: now,
      senderId,
    });

    // Update the map with the cleaned queue
    this.messageQueue.set(dstPeerId, queue);

    return true;
  }

  /**
   * Process queued messages for a peer that just registered
   * Delivers all queued messages that haven't timed out
   */
  private processQueuedMessages(peerId: string): void {
    const queue = this.messageQueue.get(peerId);
    if (!queue || queue.length === 0) {
      return;
    }

    const now = Date.now();
    const peer = this.peerRegistry.getPeer(peerId);
    if (!peer) {
      return;
    }

    let deliveredCount = 0;
    let expiredCount = 0;

    for (const queuedMsg of queue) {
      // Skip expired messages
      if (now - queuedMsg.timestamp > this.MESSAGE_QUEUE_TIMEOUT_MS) {
        expiredCount++;
        continue;
      }

      // Deliver the message based on its type
      try {
        switch (queuedMsg.message.type) {
          case "CANDIDATE":
            routeCandidate(queuedMsg.message, { id: queuedMsg.senderId } as Peer, (pid) =>
              this.peerRegistry.getPeer(pid)
            );
            deliveredCount++;
            break;
          case "OFFER":
            routeOffer(queuedMsg.message, { id: queuedMsg.senderId } as Peer, (pid) =>
              this.peerRegistry.getPeer(pid)
            );
            deliveredCount++;
            break;
          case "ANSWER":
            routeAnswer(queuedMsg.message, { id: queuedMsg.senderId } as Peer, (pid) =>
              this.peerRegistry.getPeer(pid)
            );
            deliveredCount++;
            break;
          default:
            // Other message types shouldn't be queued, but handle gracefully
            logger.warn("Unexpected message type in queue", {
              type: queuedMsg.message.type,
              peerId,
            });
        }
      } catch (error) {
        logger.error("Failed to deliver queued message", error, {
          peerId,
          messageType: queuedMsg.message.type,
        });
      }
    }

    // Remove the queue for this peer
    this.messageQueue.delete(peerId);

    if (deliveredCount > 0 || expiredCount > 0) {
      logger.info("Processed queued messages for newly registered peer", {
        peerId,
        delivered: deliveredCount,
        expired: expiredCount,
        total: queue.length,
      });
    }
  }

  /**
   * Clean up expired messages from all queues
   * Should be called periodically to prevent memory leaks
   */
  private cleanupExpiredQueuedMessages(): void {
    const now = Date.now();
    let totalCleaned = 0;

    for (const [peerId, queue] of this.messageQueue.entries()) {
      const originalSize = queue.length;
      const filtered = queue.filter(
        (qm) => now - qm.timestamp < this.MESSAGE_QUEUE_TIMEOUT_MS
      );

      if (filtered.length === 0) {
        // Queue is empty, remove it
        this.messageQueue.delete(peerId);
        totalCleaned += originalSize;
      } else if (filtered.length < originalSize) {
        // Some messages expired, update queue
        this.messageQueue.set(peerId, filtered);
        totalCleaned += originalSize - filtered.length;
      }
    }

    if (totalCleaned > 0) {
      logger.debug("Cleaned up expired queued messages", {
        count: totalCleaned,
        remainingQueues: this.messageQueue.size,
      });
    }
  }

  /**
   * Send error message to peer
   */
  private sendError(
    peer: Peer,
    errorType: ServerErrorMessage["payload"]["type"],
    message: string
  ): void {
    const errorMessage: ServerErrorMessage = {
      type: "ERROR",
      payload: {
        type: errorType,
        message,
      },
    };

    try {
      peer.connection.send(JSON.stringify(errorMessage));
    } catch (error) {
      logger.error("Failed to send error message", error, { peerId: peer.id });
    }
  }
}

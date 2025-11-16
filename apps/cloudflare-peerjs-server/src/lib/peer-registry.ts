/**
 * Peer Registry
 * 
 * Manages peer connections and their state within a game room
 * Tracks active WebSocket connections and heartbeat timestamps
 */

export interface Peer {
  id: string;                    // Unique peer identifier
  connection: WebSocket;         // Active WebSocket connection
  connectedAt: number;           // Unix timestamp (milliseconds)
  lastHeartbeat: number;         // Unix timestamp of last heartbeat
  messageCount: number;          // Total messages sent (for rate limiting)
  messageWindowStart: number;    // Rate limiting window start time
}

export interface PeerRegistryConfig {
  maxPeers: number;              // Maximum peers per room (4)
  heartbeatTimeout: number;      // Heartbeat timeout in milliseconds (5000)
}

/**
 * Registry for managing peer connections in a game room
 */
export class PeerRegistry {
  private peers: Map<string, Peer>;
  private config: PeerRegistryConfig;

  constructor(config: PeerRegistryConfig = { maxPeers: 4, heartbeatTimeout: 5000 }) {
    this.peers = new Map();
    this.config = config;
  }

  /**
   * Add a new peer to the registry
   * Returns true if added successfully, false if room is full
   */
  addPeer(peerId: string, connection: WebSocket): boolean {
    // Check if room is full
    if (this.peers.size >= this.config.maxPeers) {
      return false;
    }

    // Check if peer already exists
    if (this.peers.has(peerId)) {
      return false;
    }

    const now = Date.now();
    const peer: Peer = {
      id: peerId,
      connection,
      connectedAt: now,
      lastHeartbeat: now,
      messageCount: 0,
      messageWindowStart: now,
    };

    this.peers.set(peerId, peer);
    return true;
  }

  /**
   * Remove a peer from the registry
   */
  removePeer(peerId: string): boolean {
    return this.peers.delete(peerId);
  }

  /**
   * Get a peer by ID
   */
  getPeer(peerId: string): Peer | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Check if a peer exists in the registry
   */
  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  /**
   * Get all peer IDs
   */
  getAllPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  /**
   * Get all peers
   */
  getAllPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get number of connected peers
   */
  getPeerCount(): number {
    return this.peers.size;
  }

  /**
   * Check if room is full
   */
  isFull(): boolean {
    return this.peers.size >= this.config.maxPeers;
  }

  /**
   * Update heartbeat timestamp for a peer
   */
  updateHeartbeat(peerId: string): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return false;
    }

    peer.lastHeartbeat = Date.now();
    return true;
  }

  /**
   * Get peers that have timed out (no heartbeat within timeout period)
   */
  getTimedOutPeers(): Peer[] {
    const now = Date.now();
    const timedOut: Peer[] = [];

    for (const peer of this.peers.values()) {
      const timeSinceHeartbeat = now - peer.lastHeartbeat;
      if (timeSinceHeartbeat > this.config.heartbeatTimeout) {
        timedOut.push(peer);
      }
    }

    return timedOut;
  }

  /**
   * Get all peers except the specified one (for broadcasting)
   */
  getOtherPeers(excludePeerId: string): Peer[] {
    return Array.from(this.peers.values()).filter(peer => peer.id !== excludePeerId);
  }

  /**
   * Clear all peers (for cleanup)
   */
  clear(): void {
    this.peers.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    peerCount: number;
    maxPeers: number;
    isFull: boolean;
    timedOutCount: number;
  } {
    return {
      peerCount: this.peers.size,
      maxPeers: this.config.maxPeers,
      isFull: this.isFull(),
      timedOutCount: this.getTimedOutPeers().length,
    };
  }
}

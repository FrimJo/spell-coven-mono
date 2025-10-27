import type { WebSocket } from 'ws';

/**
 * WebSocket connection with metadata
 */
export interface WSConnection {
  ws: WebSocket;
  userId: string;
  guildId: string;
  authenticatedAt: number;
}

/**
 * WebSocket registry for managing active connections
 */
class WebSocketManager {
  private connections = new Set<WSConnection>();
  
  /**
   * Register a new authenticated WebSocket connection
   */
  register(ws: WebSocket, userId: string, guildId: string): WSConnection {
    const connection: WSConnection = {
      ws,
      userId,
      guildId,
      authenticatedAt: Date.now(),
    };
    
    this.connections.add(connection);
    
    // Auto-cleanup on close
    ws.on('close', () => {
      this.unregister(connection);
    });
    
    return connection;
  }
  
  /**
   * Unregister a WebSocket connection
   */
  unregister(connection: WSConnection): void {
    this.connections.delete(connection);
  }
  
  /**
   * Broadcast event to all connected clients
   * 
   * Implements backpressure handling: closes clients with excessive buffered data
   */
  broadcast(event: string, payload: unknown): void {
    const message = JSON.stringify({
      v: 1,
      type: 'event',
      event,
      payload,
      ts: Date.now(),
    });
    
    for (const connection of this.connections) {
      try {
        // Check backpressure (close if >1MB buffered)
        if (connection.ws.bufferedAmount > 1024 * 1024) {
          console.warn(
            `[WS] Closing connection for user ${connection.userId} due to backpressure`
          );
          connection.ws.close(1008, 'Backpressure limit exceeded');
          this.unregister(connection);
          continue;
        }
        
        // Send message
        if (connection.ws.readyState === 1) { // OPEN
          connection.ws.send(message);
        }
      } catch (error) {
        console.error(
          `[WS] Failed to send message to user ${connection.userId}:`,
          error
        );
        // Don't throw - continue broadcasting to other clients
      }
    }
  }
  
  /**
   * Broadcast event to specific guild only
   */
  broadcastToGuild(guildId: string, event: string, payload: unknown): void {
    const message = JSON.stringify({
      v: 1,
      type: 'event',
      event,
      payload,
      ts: Date.now(),
    });
    
    for (const connection of this.connections) {
      if (connection.guildId !== guildId) {
        continue;
      }
      
      try {
        // Check backpressure
        if (connection.ws.bufferedAmount > 1024 * 1024) {
          console.warn(
            `[WS] Closing connection for user ${connection.userId} due to backpressure`
          );
          connection.ws.close(1008, 'Backpressure limit exceeded');
          this.unregister(connection);
          continue;
        }
        
        // Send message
        if (connection.ws.readyState === 1) { // OPEN
          connection.ws.send(message);
        }
      } catch (error) {
        console.error(
          `[WS] Failed to send message to user ${connection.userId}:`,
          error
        );
      }
    }
  }
  
  /**
   * Get count of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
  
  /**
   * Get count of connections for specific guild
   */
  getGuildConnectionCount(guildId: string): number {
    let count = 0;
    for (const connection of this.connections) {
      if (connection.guildId === guildId) {
        count++;
      }
    }
    return count;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

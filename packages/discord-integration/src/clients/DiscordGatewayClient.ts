/**
 * Discord Gateway Client (WebSocket)
 * Manages real-time connection to Discord Gateway for receiving events
 * 
 * Responsibilities:
 * - Establish WebSocket connection to Discord Gateway
 * - Handle heartbeat mechanism to keep connection alive
 * - Parse and emit Gateway events (MESSAGE_CREATE, VOICE_STATE_UPDATE, etc.)
 * - Reconnect with exponential backoff on connection loss
 * - Manage connection state (connecting, connected, reconnecting, error)
 * 
 * SoC: Pure logic, no React, no localStorage, returns data to caller
 */

import type { GatewayConnection, GatewayEvent, GatewayEventType } from '../types/gateway';

/**
 * Gateway Opcodes (from Discord API)
 */
const GatewayOpcodes = {
  DISPATCH: 0,           // Receive events
  HEARTBEAT: 1,          // Send heartbeat
  IDENTIFY: 2,           // Identify session
  HELLO: 10,             // Receive heartbeat interval
  HEARTBEAT_ACK: 11,     // Heartbeat acknowledged
} as const;

/**
 * Gateway Close Codes (from Discord API)
 */
const GatewayCloseCodes = {
  UNKNOWN_ERROR: 4000,
  UNKNOWN_OPCODE: 4001,
  DECODE_ERROR: 4002,
  NOT_AUTHENTICATED: 4003,
  AUTHENTICATION_FAILED: 4004,
  ALREADY_AUTHENTICATED: 4005,
  INVALID_SEQ: 4007,
  RATE_LIMITED: 4008,
  SESSION_TIMED_OUT: 4009,
  INVALID_SHARD: 4010,
  SHARDING_REQUIRED: 4011,
  INVALID_API_VERSION: 4012,
  INVALID_INTENTS: 4013,
  DISALLOWED_INTENTS: 4014,
} as const;

/**
 * Event listener type
 */
export type EventListener<T = unknown> = (data: T) => void;

/**
 * Connection state change event
 */
export interface ConnectionStateEvent {
  state: GatewayConnection['state'];
  error?: string;
}

/**
 * Gateway event data
 */
export interface GatewayEventData {
  type: GatewayEventType;
  data: unknown;
  sequence: number;
}

export class DiscordGatewayClient {
  private ws: WebSocket | null = null;
  private accessToken: string;
  private heartbeatInterval: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeatAck: number | null = null;
  private sequence: number | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000; // 1 second
  private maxReconnectDelay = 30000; // 30 seconds
  
  // Event listeners
  private stateListeners: Set<EventListener<ConnectionStateEvent>> = new Set();
  private eventListeners: Map<GatewayEventType, Set<EventListener<unknown>>> = new Map();
  private anyEventListeners: Set<EventListener<GatewayEventData>> = new Set();

  // Current connection state
  private connectionState: GatewayConnection = {
    version: '1.0',
    state: 'disconnected',
    reconnectAttempts: 0,
  };

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get current connection state
   */
  getState(): GatewayConnection {
    return { ...this.connectionState };
  }

  /**
   * Connect to Discord Gateway
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.warn('[Gateway] Already connected or connecting');
      return;
    }

    this.updateState('connecting');

    try {
      // Discord Gateway URL (v10)
      const gatewayUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
      
      this.ws = new WebSocket(gatewayUrl);
      
      this.ws.onopen = () => {
        console.log('[Gateway] WebSocket opened');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[Gateway] WebSocket error:', error);
        this.updateState('error', 'WebSocket error');
      };

      this.ws.onclose = (event) => {
        console.log('[Gateway] WebSocket closed:', event.code, event.reason);
        this.handleClose(event.code, event.reason);
      };

    } catch (error) {
      console.error('[Gateway] Failed to connect:', error);
      this.updateState('error', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Disconnect from Gateway
   */
  disconnect(): void {
    console.log('[Gateway] Disconnecting...');
    
    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    // Reset state
    this.sequence = null;
    this.sessionId = null;
    this.heartbeatInterval = null;
    this.lastHeartbeatAck = null;
    this.reconnectAttempts = 0;

    this.updateState('disconnected');
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(listener: EventListener<ConnectionStateEvent>): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Subscribe to specific Gateway event type
   */
  on<T = unknown>(eventType: GatewayEventType, listener: EventListener<T>): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener as EventListener<unknown>);
    
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        listeners.delete(listener as EventListener<unknown>);
      }
    };
  }

  /**
   * Subscribe to all Gateway events
   */
  onAnyEvent(listener: EventListener<GatewayEventData>): () => void {
    this.anyEventListeners.add(listener);
    return () => this.anyEventListeners.delete(listener);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const payload = JSON.parse(data) as GatewayEvent;

      // Update sequence number
      if (payload.s !== null) {
        this.sequence = payload.s;
      }

      switch (payload.op) {
        case GatewayOpcodes.HELLO:
          this.handleHello(payload.d as { heartbeat_interval: number });
          break;

        case GatewayOpcodes.HEARTBEAT_ACK:
          this.handleHeartbeatAck();
          break;

        case GatewayOpcodes.DISPATCH:
          this.handleDispatch(payload);
          break;

        default:
          console.warn('[Gateway] Unknown opcode:', payload.op);
      }
    } catch (error) {
      console.error('[Gateway] Failed to parse message:', error);
    }
  }

  /**
   * Handle HELLO event (start heartbeat and identify)
   */
  private handleHello(data: { heartbeat_interval: number }): void {
    console.log('[Gateway] Received HELLO, heartbeat interval:', data.heartbeat_interval);
    
    this.heartbeatInterval = data.heartbeat_interval;
    this.startHeartbeat();
    this.identify();
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    if (!this.heartbeatInterval) {
      console.error('[Gateway] Cannot start heartbeat: no interval');
      return;
    }

    // Clear existing timer
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Send heartbeat at interval
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  /**
   * Send heartbeat to Gateway
   */
  private sendHeartbeat(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Gateway] Cannot send heartbeat: WebSocket not open');
      return;
    }

    const payload = {
      op: GatewayOpcodes.HEARTBEAT,
      d: this.sequence,
    };

    this.ws.send(JSON.stringify(payload));
    console.log('[Gateway] Sent heartbeat, sequence:', this.sequence);
  }

  /**
   * Handle heartbeat acknowledgment
   */
  private handleHeartbeatAck(): void {
    this.lastHeartbeatAck = Date.now();
    console.log('[Gateway] Received heartbeat ACK');
  }

  /**
   * Send IDENTIFY payload to authenticate
   */
  private identify(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[Gateway] Cannot identify: WebSocket not open');
      return;
    }

    const payload = {
      op: GatewayOpcodes.IDENTIFY,
      d: {
        token: this.accessToken,
        properties: {
          os: 'browser',
          browser: 'spell-coven',
          device: 'spell-coven',
        },
        intents: 0, // No privileged intents needed for user account
      },
    };

    this.ws.send(JSON.stringify(payload));
    console.log('[Gateway] Sent IDENTIFY');
  }

  /**
   * Handle DISPATCH event (actual Gateway events)
   */
  private handleDispatch(payload: GatewayEvent): void {
    if (!payload.t) {
      console.warn('[Gateway] DISPATCH event without type');
      return;
    }

    const eventType = payload.t as GatewayEventType;
    
    // Handle READY event specially
    if (eventType === 'READY') {
      this.handleReady(payload.d as { session_id: string });
    }

    // Emit to specific event listeners
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(payload.d);
        } catch (error) {
          console.error(`[Gateway] Error in ${eventType} listener:`, error);
        }
      });
    }

    // Emit to any-event listeners
    this.anyEventListeners.forEach((listener) => {
      try {
        listener({
          type: eventType,
          data: payload.d,
          sequence: payload.s ?? 0,
        });
      } catch (error) {
        console.error('[Gateway] Error in any-event listener:', error);
      }
    });
  }

  /**
   * Handle READY event (connection established)
   */
  private handleReady(data: { session_id: string }): void {
    console.log('[Gateway] READY, session ID:', data.session_id);
    this.sessionId = data.session_id;
    this.reconnectAttempts = 0; // Reset reconnect counter on success
    this.updateState('connected');
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(code: number, reason: string): void {
    // Clear heartbeat timer
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Check if we should reconnect
    const shouldReconnect = this.shouldReconnect(code);
    
    if (shouldReconnect) {
      this.scheduleReconnect();
    } else {
      this.updateState('error', `Connection closed: ${code} ${reason}`);
    }
  }

  /**
   * Determine if we should reconnect based on close code
   */
  private shouldReconnect(code: number): boolean {
    // Don't reconnect on authentication failures
    const noReconnectCodes: number[] = [
      GatewayCloseCodes.AUTHENTICATION_FAILED,
      GatewayCloseCodes.INVALID_INTENTS,
      GatewayCloseCodes.DISALLOWED_INTENTS,
      GatewayCloseCodes.INVALID_API_VERSION,
    ];

    if (noReconnectCodes.includes(code)) {
      console.error('[Gateway] Fatal error, will not reconnect:', code);
      return false;
    }

    // Don't reconnect if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Gateway] Max reconnect attempts reached');
      return false;
    }

    return true;
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[Gateway] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.updateState('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      console.log('[Gateway] Attempting reconnect...');
      this.connect().catch((error) => {
        console.error('[Gateway] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Update connection state and notify listeners
   */
  private updateState(state: GatewayConnection['state'], error?: string): void {
    this.connectionState = {
      version: '1.0',
      state,
      sessionId: this.sessionId ?? undefined,
      sequence: this.sequence ?? undefined,
      heartbeatInterval: this.heartbeatInterval ?? undefined,
      lastHeartbeatAck: this.lastHeartbeatAck ?? undefined,
      reconnectAttempts: this.reconnectAttempts,
      url: this.ws?.url,
    };

    // Notify listeners
    const event: ConnectionStateEvent = { state, error };
    this.stateListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Gateway] Error in state listener:', error);
      }
    });
  }
}

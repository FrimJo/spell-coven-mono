/**
 * Gateway Registry Abstraction
 *
 * Interface for tracking active Gateway connections (for horizontal scaling).
 * Enables future integration with Redis for multi-instance coordination.
 */

export interface GatewayMetadata {
  instanceId: string
  connectedAt: number
  lastHeartbeat: number
  guildIds: string[]
}

export interface IGatewayRegistry {
  /**
   * Register Gateway instance
   */
  register(instanceId: string, metadata: GatewayMetadata): Promise<void>

  /**
   * Unregister Gateway instance
   */
  unregister(instanceId: string): Promise<void>

  /**
   * Get all active Gateway instances
   */
  getActiveInstances(): Promise<GatewayMetadata[]>

  /**
   * Update heartbeat timestamp
   */
  heartbeat(instanceId: string): Promise<void>
}

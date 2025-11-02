import type {
  GatewayMetadata,
  IGatewayRegistry,
} from '../interfaces/gateway-registry'

/**
 * Single Instance Registry
 *
 * Null implementation for single-instance deployments.
 * For multi-instance coordination, use RedisGatewayRegistry.
 */
export class SingleInstanceRegistry implements IGatewayRegistry {
  async register(
    _instanceId: string,
    _metadata: GatewayMetadata,
  ): Promise<void> {
    // No-op: single instance doesn't need registry
  }

  async unregister(_instanceId: string): Promise<void> {
    // No-op
  }

  async getActiveInstances(): Promise<GatewayMetadata[]> {
    return []
  }

  async heartbeat(_instanceId: string): Promise<void> {
    // No-op
  }
}

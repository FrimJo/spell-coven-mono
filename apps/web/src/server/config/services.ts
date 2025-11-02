import type { IEventBus } from '../interfaces/event-bus'
import type { DiscordEvent, IEventStore } from '../interfaces/event-store'
import type { IGatewayRegistry } from '../interfaces/gateway-registry'
import { InMemoryEventBus } from '../adapters/in-memory-event-bus'
import { NoOpEventStore } from '../adapters/noop-event-store'
import { SingleInstanceRegistry } from '../adapters/single-instance-registry'

/**
 * Service Configuration
 *
 * Dependency injection container for service implementations.
 * Allows swapping implementations without changing business logic.
 */
export interface ServiceConfig {
  eventBus: IEventBus<DiscordEvent>
  eventStore: IEventStore
  gatewayRegistry: IGatewayRegistry
}

/**
 * Create service instances for development
 *
 * Uses in-memory implementations (no external dependencies)
 */
export function createDevelopmentServices(): ServiceConfig {
  return {
    eventBus: new InMemoryEventBus<DiscordEvent>(),
    eventStore: new NoOpEventStore(),
    gatewayRegistry: new SingleInstanceRegistry(),
  }
}

/**
 * Create service instances for production
 *
 * TODO: Replace with Redis/Supabase implementations for horizontal scaling
 */
export function createProductionServices(): ServiceConfig {
  // For now, use same as development
  // In future, replace with:
  // - RedisEventBus for event distribution
  // - SupabaseEventStore for event persistence
  // - RedisGatewayRegistry for multi-instance coordination
  return createDevelopmentServices()
}

/**
 * Create service instances based on environment
 */
export function createServices(config?: Partial<ServiceConfig>): ServiceConfig {
  const defaults =
    process.env.NODE_ENV === 'production'
      ? createProductionServices()
      : createDevelopmentServices()

  return {
    ...defaults,
    ...config,
  }
}

// Singleton instance
let servicesInstance: ServiceConfig | null = null

/**
 * Get or create services singleton
 */
export function getServices(): ServiceConfig {
  if (!servicesInstance) {
    servicesInstance = createServices()
  }
  return servicesInstance
}

import type { GatewayEvent } from '@repo/discord-gateway'

export type EventBusSubscriber<TEvent> = (event: TEvent) => void

export class EventBus<TEvent extends GatewayEvent = GatewayEvent> {
  private readonly subscribers = new Set<EventBusSubscriber<TEvent>>()

  subscribe(handler: EventBusSubscriber<TEvent>): () => void {
    this.subscribers.add(handler)

    let active = true

    return () => {
      if (!active) {
        return
      }

      active = false
      this.subscribers.delete(handler)
    }
  }

  publish(event: TEvent): void {
    for (const handler of this.subscribers) {
      try {
        handler(event)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[gateway:event-bus] subscriber error', error)
      }
    }
  }

  get subscriberCount(): number {
    return this.subscribers.size
  }

  clear(): void {
    this.subscribers.clear()
  }
}

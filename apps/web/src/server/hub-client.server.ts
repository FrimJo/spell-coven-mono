import type { InternalEvent } from '@repo/discord-gateway'
import {
  generateHmacSignature,
  getCurrentTimestamp,
} from '@repo/discord-gateway'

/**
 * Hub client for posting events to TanStack Start backend
 * Server-only utility for the Discord Gateway to communicate with the web app
 */
export class HubClient {
  private hubEndpoint: string
  private hubSecret: string

  constructor(hubEndpoint: string, hubSecret: string) {
    this.hubEndpoint = hubEndpoint
    this.hubSecret = hubSecret
  }

  /**
   * Post event to TanStack Start backend
   *
   * @param event - Event type
   * @param payload - Event payload
   */
  async postEvent(
    event: InternalEvent['event'],
    payload: unknown,
  ): Promise<void> {
    try {
      const body = JSON.stringify({ event, payload })
      const timestamp = getCurrentTimestamp()
      const signature = generateHmacSignature(this.hubSecret, timestamp, body)

      const response = await fetch(this.hubEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Timestamp': timestamp.toString(),
          'X-Hub-Signature': signature,
        },
        body,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Hub request failed (${response.status}): ${error}`)
      }

      console.log(`[Hub] Posted event: ${event}`)
    } catch (error) {
      console.error(`[Hub] Failed to post event ${event}:`, error)
      // Don't throw - we don't want to crash the worker if hub is temporarily unavailable
    }
  }
}

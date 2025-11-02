import type { GatewayClientState } from '../gateway/gateway-ws.client'
import {
  ensureGatewayStarted,
  getGatewayClient,
  resetGatewayClient,
} from '../gateway/gateway-ws.client'

let hasStarted = false

export async function initializeDiscordGateway(): Promise<void> {
  if (hasStarted) {
    return
  }

  await ensureGatewayStarted()
  hasStarted = true
}

export function disconnectDiscordGateway(): void {
  resetGatewayClient()
  hasStarted = false
}

export function getGatewayState(): GatewayClientState {
  return getGatewayClient().currentState
}

export interface GatewayEnvironmentConfig {
  wsUrl: string
  linkToken: string
  enableLegacyBridge: boolean
}

export class GatewayConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GatewayConfigError'
  }
}

function assertPresent(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new GatewayConfigError(`Missing required environment variable ${name}`)
  }

  return value.trim()
}

function coerceBoolean(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false
  }

  throw new GatewayConfigError(
    `ENABLE_WS_BRIDGE must be a boolean string (true/false, 1/0, yes/no). Received: ${value}`,
  )
}

function validateWebSocketUrl(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new GatewayConfigError(
        `GATEWAY_WS_URL must use ws:// or wss:// scheme. Received: ${raw}`,
      )
    }

    return url.toString()
  } catch (error) {
    if (error instanceof GatewayConfigError) {
      throw error
    }

    throw new GatewayConfigError(
      `GATEWAY_WS_URL must be a valid WebSocket URL. Received: ${raw}`,
      { cause: error },
    )
  }
}

export function loadGatewayEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): GatewayEnvironmentConfig {
  const wsUrl = validateWebSocketUrl(assertPresent(env.GATEWAY_WS_URL, 'GATEWAY_WS_URL'))
  const linkToken = assertPresent(env.LINK_TOKEN, 'LINK_TOKEN')

  const enableLegacyBridge = env.ENABLE_WS_BRIDGE
    ? coerceBoolean(env.ENABLE_WS_BRIDGE)
    : false

  return {
    wsUrl,
    linkToken,
    enableLegacyBridge,
  }
}

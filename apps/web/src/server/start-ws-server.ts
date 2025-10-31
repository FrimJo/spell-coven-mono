import { initializeWebSocketServer } from './ws-server'

/**
 * Start the WebSocket server
 * Call this from your main server entry point
 */
export function startWebSocketServer(): void {
  const port = parseInt(process.env.WS_PORT || '1234', 10)
  initializeWebSocketServer(port)
}

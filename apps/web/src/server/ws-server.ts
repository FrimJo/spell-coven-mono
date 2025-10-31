import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

import { handleWebSocketConnection } from './ws-handler.js'

let wss: WebSocketServer | null = null

/**
 * Initialize the WebSocket server
 * This should be called once when the server starts
 */
export function initializeWebSocketServer(port: number): WebSocketServer {
  if (wss) {
    console.log('[WS Server] WebSocket server already initialized')
    return wss
  }

  console.log(`[WS Server] Initializing WebSocket server on port ${port}`)

  // Create HTTP server for WebSocket upgrade
  const httpServer = createServer()

  // Create WebSocket server
  wss = new WebSocketServer({ server: httpServer, path: '/api/ws' })

  wss.on('connection', (ws) => {
    console.log('[WS Server] New WebSocket connection')
    handleWebSocketConnection(ws)
  })

  wss.on('error', (error) => {
    console.error('[WS Server] WebSocket server error:', error)
  })

  // Start HTTP server
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(
      `[WS Server] WebSocket server listening on wss://localhost:${port}/api/ws`,
    )
  })

  httpServer.on('error', (error) => {
    console.error('[WS Server] HTTP server error:', error)
  })

  return wss
}

/**
 * Get the WebSocket server instance
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss
}

/**
 * Close the WebSocket server
 */
export function closeWebSocketServer(): void {
  if (wss) {
    console.log('[WS Server] Closing WebSocket server')
    wss.close()
    wss = null
  }
}

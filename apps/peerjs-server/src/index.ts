import { PeerServer } from 'peer'

const port = parseInt(process.env.PEERJS_PORT || '9000', 10)
const path = process.env.PEERJS_PATH || '/peerjs'
const nodeEnv = process.env.NODE_ENV || 'development'

console.log(`[PeerServer] Starting on port ${port} with path ${path}`)
console.log(`[PeerServer] Environment: ${nodeEnv}`)

const peerServer = PeerServer({
  port,
  path,
})

peerServer.on('connection', (client) => {
  console.log(`[PeerServer] Client connected: ${client.getId()}`)
})

peerServer.on('disconnect', (client) => {
  console.log(`[PeerServer] Client disconnected: ${client.getId()}`)
})

console.log(`[PeerServer] PeerServer initialized successfully`)
console.log(`[PeerServer] WebSocket URL: ws://localhost:${port}${path}`)

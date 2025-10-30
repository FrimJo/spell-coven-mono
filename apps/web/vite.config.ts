import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { WebSocketServer } from 'ws'

import { handleWebSocketConnection } from './src/routes/api/ws'

export default defineConfig(() => {
  return {
    // 🔴 important: include the trailing slash
    base: '/',
    define: {
      'process.env': process.env,
    },
    plugins: [
      viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
      mkcert({ savePath: './certificates' }),
      tailwindcss(),
      {
        name: 'spell-coven-ws-upgrade',
        configureServer(server) {
          const httpServer = server.httpServer
          if (!httpServer) return

          const wss = new WebSocketServer({ noServer: true })

          const upgradeListener = (
            request: IncomingMessage,
            socket: Duplex,
            head: Buffer,
          ) => {
            const url = request.url

            if (!url?.length || !url.startsWith('/api/ws')) {
              return
            }

            wss.handleUpgrade(request, socket, head, (ws) => {
              handleWebSocketConnection(ws)
            })
          }

          httpServer.on('upgrade', upgradeListener)

          httpServer.once('close', () => {
            httpServer.off('upgrade', upgradeListener)
            wss.close()
          })
        },
      },
      tanstackStart({ spa: { enabled: true } }),
      viteReact(), // Must come after tanstackStart()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@repo/ui': path.resolve(__dirname, '../../packages/ui/src'),
      },
    },
    // (optional) if you import files from ../../packages during dev:
    preview: {
      port: 1234,
      strictPort: true,
    },
    server: {
      port: 1234,
      strictPort: true,
      fs: {
        allow: ['..'], // allow monorepo workspace imports
      },
    },
  }
})

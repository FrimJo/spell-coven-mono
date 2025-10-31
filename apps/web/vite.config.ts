import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import { initializeWebSocketServer } from './src/server/ws-server'

export default defineConfig(() => {
  return {
    // 🔴 important: include the trailing slash
    base: '/',
    define: {
      'process.env.VITE_BASE_URL': JSON.stringify(process.env.VITE_BASE_URL || 'http://localhost:1234'),
      'process.env.VITE_DISCORD_GUILD_ID': JSON.stringify(process.env.VITE_DISCORD_GUILD_ID),
      'process.env.VITE_DISCORD_BOT_TOKEN': JSON.stringify(process.env.VITE_DISCORD_BOT_TOKEN),
    },
    plugins: [
      viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
      mkcert({ savePath: './certificates' }),
      tailwindcss(),
      tanstackStart({ spa: { enabled: true } }),
      viteReact(), // Must come after tanstackStart()
      {
        name: 'spell-coven-ws-init',
        apply: 'serve',
        configureServer() {
          // Defer WebSocket server initialization to avoid conflicts with Vite startup
          setImmediate(() => {
            const port = parseInt(process.env.WS_PORT || '1235', 10)
            console.log(`[Vite] Initializing WebSocket server on port ${port}`)
            initializeWebSocketServer(port)
          })
        },
      },
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

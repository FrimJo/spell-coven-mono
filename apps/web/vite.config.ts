import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import viteTsConfigPaths from 'vite-tsconfig-paths'

// SPA mode - static CDN deployment

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'

  return {
    // 🔴 important: include the trailing slash
    base: '/',
    plugins: [
      viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
      // mkcert is only needed for local HTTPS development
      isDev && mkcert({ savePath: './certificates' }),
      tailwindcss(),
      tanstackStart({ spa: { enabled: true } }),
      viteReact(), // Must come after tanstackStart()
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@repo/ui': path.resolve(__dirname, '../../packages/ui/src'),
        '@convex': path.resolve(__dirname, '../../convex'),
      },
    },
    optimizeDeps: {
      exclude: ['@techstark/opencv-js'], // Exclude from pre-bundling (it's loaded dynamically)
    },
    ssr: {
      external: [],
      noExternal: [],
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
      middlewareMode: false,
    },
  }
})

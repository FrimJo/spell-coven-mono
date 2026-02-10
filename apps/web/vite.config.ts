import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import viteTsConfigPaths from 'vite-tsconfig-paths'

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
}

/** Serves TanStack Start SPA from dist/client with _shell.html fallback (preview only). */
function tanStackStartPreviewPlugin() {
  const clientDir = path.resolve(__dirname, 'dist/client')
  return {
    name: 'tanstack-start-preview',
    enforce: 'pre' as const,
    configurePreviewServer(server: {
      middlewares: {
        use: (
          fn: (
            req: IncomingMessage,
            res: ServerResponse,
            next: () => void,
          ) => void,
        ) => void
      }
    }) {
      return () => {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next()
          const url = req.url?.split('?')[0] ?? '/'
          const safePath = path.normalize(url).replace(/^(\.\.(\/|$))+/, '')
          const filePath = path.resolve(
            clientDir,
            safePath === '/' ? '.' : safePath,
          )
          if (
            !filePath.startsWith(clientDir + path.sep) &&
            filePath !== clientDir
          ) {
            return next()
          }
          let stat: fs.Stats | null = null
          try {
            stat = fs.statSync(filePath)
          } catch {
            // fall through to SPA shell
          }
          if (stat?.isFile()) {
            const ext = path.extname(filePath)
            res.setHeader(
              'Content-Type',
              MIME[ext] ?? 'application/octet-stream',
            )
            res.statusCode = 200
            fs.createReadStream(filePath).pipe(res)
            return
          }
          const shellPath = path.join(clientDir, '_shell.html')
          if (!fs.existsSync(shellPath)) return next()
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          fs.createReadStream(shellPath).pipe(res)
        })
      }
    },
  }
}

// SPA mode - static CDN deployment
export default defineConfig(({ mode: _mode }) => {
  const release =
    process.env.VITE_VERCEL_GIT_COMMIT_SHA ??
    process.env.VITE_GITHUB_SHA ??
    process.env.VITE_BUILD_NUMBER

  const enableSentryUpload = Boolean(
    process.env.SENTRY_AUTH_TOKEN &&
      process.env.VITE_SENTRY_ORG &&
      process.env.VITE_SENTRY_PROJECT,
  )

  const sentryPlugin = enableSentryUpload
    ? sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.VITE_SENTRY_ORG,
        project: process.env.VITE_SENTRY_PROJECT,
        release: {
          name: release,
        },
        telemetry: false,
        sourcemaps: {
          assets: './dist/**',
        },
      })
    : false

  return {
    // 🔴 important: include the trailing slash
    base: '/',
    plugins: [
      viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
      // mkcert is only needed for local HTTPS development
      mkcert({ savePath: './certificates' }),
      tailwindcss(),
      tanstackStart({ spa: { enabled: true } }),
      viteReact(), // Must come after tanstackStart()
      tanStackStartPreviewPlugin(),
      ...(sentryPlugin ? [sentryPlugin] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@repo/ui': path.resolve(__dirname, '../../packages/ui/src'),
        '@convex': path.resolve(__dirname, '../../convex'),
      },
    },
    optimizeDeps: {
      // Note: @techstark/opencv-js is used only for TypeScript types
      // The actual OpenCV.js is loaded via CDN script tag to avoid Vite bundling issues
    },
    ssr: {
      external: [],
      noExternal: [],
    },
    build: {
      sourcemap: true,
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

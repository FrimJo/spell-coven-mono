import path from 'node:path'
import { env } from '@/env'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import viteTsConfigPaths from 'vite-tsconfig-paths'

// SPA mode - static CDN deployment
export default defineConfig(({ mode }) => {
  const isNotProd = mode !== 'production'
  const release =
    env.VITE_SENTRY_RELEASE ??
    env.VITE_VERCEL_GIT_COMMIT_SHA ??
    env.VITE_GITHUB_SHA ??
    env.VITE_BUILD_NUMBER

  const enableSentryUpload = Boolean(
    env.SENTRY_AUTH_TOKEN && env.VITE_SENTRY_ORG && env.VITE_SENTRY_PROJECT,
  )

  return {
    // 🔴 important: include the trailing slash
    base: '/',
    plugins: [
      viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
      // mkcert is only needed for local HTTPS development
      isNotProd && mkcert({ savePath: './certificates' }),
      tailwindcss(),
      tanstackStart({ spa: { enabled: true } }),
      viteReact(), // Must come after tanstackStart()
      enableSentryUpload &&
        sentryVitePlugin({
          authToken: env.SENTRY_AUTH_TOKEN,
          org: env.VITE_SENTRY_ORG,
          project: env.VITE_SENTRY_PROJECT,
          release: {
            name: release,
          },
          telemetry: false,
          sourcemaps: {
            assets: './dist/**',
          },
        }),
    ].filter(Boolean),
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

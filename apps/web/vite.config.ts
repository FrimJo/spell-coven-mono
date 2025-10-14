import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    // 🔴 important: include the trailing slash
    base: isProd ? '/spell-coven-mono/' : '/',
    plugins: [
      tanstackRouter({
        routesDirectory: './src/routes',
        generatedRouteTree: './src/routeTree.gen.ts',
      }),
      viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
      tailwindcss(),
      viteReact(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@repo/ui': path.resolve(__dirname, '../../packages/ui/src'),
      },
    },
    // (optional) if you import files from ../../packages during dev:
    server: {
      fs: {
        allow: ['..'], // allow monorepo workspace imports
      },
    },
  }
})

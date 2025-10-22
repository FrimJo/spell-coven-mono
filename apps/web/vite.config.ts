import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig(() => {
  return {
    // 🔴 important: include the trailing slash
    base: '/',

    plugins: [
      tanstackRouter({
        routesDirectory: './src/routes',
        generatedRouteTree: './src/routeTree.gen.ts',
      }),
      viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
      mkcert({ savePath: './certificates' }),
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

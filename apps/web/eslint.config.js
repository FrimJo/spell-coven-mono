import { config as baseConfig, restrictEnvAccess } from '@repo/eslint-config/base'
import { config as reactConfig } from '@repo/eslint-config/react-internal'
import { config as viteConfig } from '@repo/eslint-config/base'
import pluginQuery from '@tanstack/eslint-plugin-query'
import reactCompiler from 'eslint-plugin-react-compiler'

/** @type {import('typescript-eslint').Config} */
export default [
  ...baseConfig,
  ...reactConfig,
  ...viteConfig,
  ...restrictEnvAccess,
  ...pluginQuery.configs['flat/recommended'],
  { ignores: ['public/mockServiceWorker.js'] },
  {
    ignores: ['dist/**', 'src/routeTree.gen.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
      '@tanstack/query/exhaustive-deps': 'off',
    },
  },
]

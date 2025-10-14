import { config as baseConfig } from '@repo/eslint-config/base'
import { config as reactConfig } from '@repo/eslint-config/react-internal'
import pluginQuery from '@tanstack/eslint-plugin-query'
import reactCompiler from 'eslint-plugin-react-compiler'

/** @type {import('typescript-eslint').Config} */
export default [
  ...baseConfig,
  ...reactConfig,
  ...pluginQuery.configs['flat/recommended'],
  { ignores: ['public/mockServiceWorker.js'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      'dist/**',
      'src/routeTree.gen.ts',
      'eslint.config.js',
      'playwright.config.ts',
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
      '@tanstack/query/exhaustive-deps': 'off',
      'react/prop-types': 'off', // TypeScript provides type checking
    },
  },
]

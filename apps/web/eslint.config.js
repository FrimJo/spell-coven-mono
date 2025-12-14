import reactCompiler from 'eslint-plugin-react-compiler'

import { config as reactConfig } from '@repo/eslint-config/react-internal'

/** @type {import('typescript-eslint').Config} */
export default [
  ...reactConfig,
  { ignores: ['public/**', 'public/mockServiceWorker.js', '**/*.demo.ts'] },
  // Main source files
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      'dist/**',
      'src/routeTree.gen.ts',
      'eslint.config.js',
      'playwright.config.ts',
      '**/*.demo.ts',
      'tests/**/*',
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
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
  // Test files - use main tsconfig (which includes tests)
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Relax some rules for tests
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
]

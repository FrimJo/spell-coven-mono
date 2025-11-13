import { config as baseConfig } from '@repo/eslint-config/base'

/** @type {import('typescript-eslint').Config} */
export default [
  ...baseConfig,
  { ignores: ['dist/**', 'certificates/**'] },
  {
    files: ['**/*.ts'],
    ignores: ['dist/**', 'certificates/**', 'eslint.config.js', 'vite.config.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]

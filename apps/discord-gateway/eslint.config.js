import { config as baseConfig } from '@repo/eslint-config/base'

/** @type {import('typescript-eslint').Config} */
export default [
  ...baseConfig,
  { ignores: ['dist/**'] },
  {
    files: ['**/*.ts'],
    ignores: ['dist/**', 'eslint.config.js'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]

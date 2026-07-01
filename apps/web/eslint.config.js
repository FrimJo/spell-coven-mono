import { config as reactConfig } from '@repo/eslint-config/react-internal'

/** @type {import('typescript-eslint').Config} */
export default [
  ...reactConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    settings: {
      'better-tailwindcss': {
        cwd: import.meta.dirname,
        entryPoint: '../../packages/ui/src/styles/globals.css',
      },
    },
    rules: {
      'better-tailwindcss/no-unknown-classes': [
        'warn',
        {
          // Custom classes defined outside the Tailwind entry point:
          // component-scoped keyframe animations (LandingPage.css and inline
          // <style> blocks), landing page button decorations, and marker
          // classes used only as arbitrary-variant selector targets.
          ignore: [
            '^animate-float$',
            '^animate-sparkle$',
            '^animate-glow-pulse$',
            '^animate-fade-in-up$',
            '^create-game-btn-wrap$',
            '^glimmer-sweep$',
            '^is-loading$',
            '^icon-check$',
            '^icon-remove$',
          ],
        },
      ],
    },
  },
  {
    ignores: [
      '.output/**',
      'dist/**',
      'public/**',
      'public/mockServiceWorker.js',
    ],
  },
  // Main source files
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      'dist/**',
      'src/routeTree.gen.ts',
      'eslint.config.js',
      'playwright.config.ts',
      'tests/**/*',
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@tanstack/query/exhaustive-deps': 'off',
      'react/prop-types': 'off', // TypeScript provides type checking
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
  {
    files: [
      'src/components/VideoStreamGrid.tsx',
      'src/hooks/useAudioOutput.ts',
      'src/hooks/useCardQuery.ts',
      'src/hooks/useConvexPresence.ts',
      'src/hooks/useMediaPermissions.ts',
      'src/routes/__root.tsx',
      'src/routes/phone-camera.tsx',
    ],
    // These effects initialize or synchronize browser, storage, media, and
    // live Convex state. Their state updates are part of that external sync.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
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

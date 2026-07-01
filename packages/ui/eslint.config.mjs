import { config } from '@repo/eslint-config/react-internal'

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    settings: {
      'better-tailwindcss': {
        cwd: import.meta.dirname,
        entryPoint: 'src/styles/globals.css',
      },
    },
  },
  {
    rules: {
      'react/prop-types': 'off', // Using TypeScript for prop validation
      // `toaster` is a shadcn/Sonner marker class (see sonner.tsx), not a Tailwind
      // utility. It enables `group-[.toaster]:*` variants on toast children.
      'better-tailwindcss/no-unknown-classes': [
        'warn',
        { ignore: ['^toaster$'] },
      ],
    },
  },
  {
    files: ['src/components/carousel.tsx'],
    // The effect subscribes to Embla's external carousel state and performs an
    // initial synchronization when the browser-owned carousel API is created.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

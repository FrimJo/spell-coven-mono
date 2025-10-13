import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617',
        },
      },
    },
  },
  plugins: [],
} satisfies Config

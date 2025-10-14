import { config } from '@repo/eslint-config/react-internal'

export default [
  ...config,
  {
    rules: {
      'react/prop-types': 'off', // Using TypeScript for prop validation
    },
  },
]

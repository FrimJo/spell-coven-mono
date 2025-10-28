import { config } from "../eslint-config/react-internal.js";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    rules: {
      'react/prop-types': 'off', // Using TypeScript for prop validation
    },
  },
];

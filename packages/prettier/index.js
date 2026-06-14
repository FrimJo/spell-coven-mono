/** @typedef {import("prettier").Config} PrettierConfig */
/** @typedef {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

/** @type { PrettierConfig | SortImportsConfig } */
const config = {
  singleQuote: true,
  semi: false,
  // tailwindcss must be last — it sorts class strings after import sorting runs.
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
  tailwindStylesheet: 'packages/ui/src/styles/globals.css',
  importOrder: [
    '<TYPES>',
    '^(react/(.*)$)|^(react$)|^(react-native(.*)$)',
    '^(next/(.*)$)|^(next$)',
    '^(expo(.*)$)|^(expo$)',
    '<THIRD_PARTY_MODULES>',
    '',
    '<TYPES>^@repo',
    '^@repo/(.*)$',
    '',
    '<TYPES>^[.|..|~]',
    '^~/',
    '^[../]',
    '^[./]',
  ],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrderTypeScriptVersion: '5.7.3',
}

export default config

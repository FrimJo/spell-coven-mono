# Configuration Contracts

**Feature**: 006-integrate-figma-exported  
**Version**: 1.0.0  
**Date**: October 14, 2025

## Overview

This document defines the configuration contracts for integrating `apps/figma_export` into the monorepo. All configuration files must conform to these standards to ensure consistency with other monorepo applications.

## Package Configuration Contract

### package.json

**Location**: `apps/figma_export/package.json`

**Required Fields**:

```json
{
  "name": "@repo/figma-export",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev --port 3001",
    "build": "vite build",
    "serve": "vite preview",
    "format": "prettier --check . --ignore-path ./.prettierignore --ignore-path ./.gitignore --ignore-path ../../.gitignore",
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/ui": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.6",
    "@tailwindcss/vite": "^4.0.6"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.34.0",
    "typescript": "catalog:",
    "vite": "^7.1.7",
    "vite-tsconfig-paths": "^5.1.4"
  },
  "prettier": "@repo/prettier-config"
}
```

**Validation Rules**:
- ✅ `name` must start with `@repo/`
- ✅ `private` must be `true`
- ✅ `type` must be `"module"`
- ✅ All `@repo/*` dependencies must use `workspace:*`
- ✅ React version must be `^19.0.0`
- ✅ Vite version must be `^7.1.7`
- ✅ Tailwind version must be `^4.0.6`
- ✅ Must include `dev`, `build`, `lint`, `format`, `check-types` scripts
- ✅ `prettier` field must reference `@repo/prettier-config`

## TypeScript Configuration Contract

### tsconfig.json

**Location**: `apps/figma_export/tsconfig.json`

**Required Structure**:

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "include": ["**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "react-jsx",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": false,
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@repo/ui/*": ["../../packages/ui/src/*"]
    }
  }
}
```

**Validation Rules**:
- ✅ Must extend from `@repo/typescript-config`
- ✅ `strict` must be `true`
- ✅ `noEmit` must be `true` (Vite handles compilation)
- ✅ Must include path mappings for `@/*` and `@repo/ui/*`
- ✅ `jsx` must be `"react-jsx"` (React 19 automatic runtime)
- ✅ `moduleResolution` must be `"bundler"`

## Vite Configuration Contract

### vite.config.ts

**Location**: `apps/figma_export/vite.config.ts`

**Required Structure**:

```typescript
import { defineConfig } from 'vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@repo/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 3001,
  },
});
```

**Validation Rules**:
- ✅ Must include `viteTsConfigPaths` plugin (enables path aliases)
- ✅ Must include `tailwindcss()` plugin (Tailwind v4)
- ✅ Must include `viteReact()` plugin
- ✅ Plugin order matters: tsconfig paths → tailwind → react
- ✅ Must define `resolve.alias` for `@` and `@repo/ui`
- ✅ Server port should be `3001` (avoid conflict with apps/web on 3000)

## ESLint Configuration Contract

### eslint.config.mjs

**Location**: `apps/figma_export/eslint.config.mjs`

**Required Structure**:

```javascript
import baseConfig from '@repo/eslint-config/react-internal.js';

export default baseConfig;
```

**Validation Rules**:
- ✅ Must use flat config format (`.mjs` extension)
- ✅ Must import from `@repo/eslint-config/react-internal.js`
- ✅ Can add app-specific overrides if needed
- ✅ No inline config duplication (use shared config)

**Optional Overrides Example**:

```javascript
import baseConfig from '@repo/eslint-config/react-internal.js';

export default [
  ...baseConfig,
  {
    // App-specific overrides
    rules: {
      'no-console': 'warn', // Allow console in dev preview app
    },
  },
];
```

## Prettier Configuration Contract

### .prettierrc

**Location**: `apps/figma_export/.prettierrc`

**Required Structure**:

```json
"@repo/prettier-config"
```

**Validation Rules**:
- ✅ Must be a single string reference to `@repo/prettier-config`
- ✅ No inline configuration (use shared config)
- ✅ File must exist (even if just a reference)

**Alternative**: Can be omitted if `package.json` has `"prettier": "@repo/prettier-config"` field.

## Tailwind Configuration Contract

### index.css (CSS-first configuration)

**Location**: `apps/figma_export/src/index.css`

**Required Structure**:

```css
@import "tailwindcss";

/* Custom theme variables */
@theme {
  --color-primary: #030213;
  --color-secondary: #e9ebef;
  --radius-button: 14px;
}

/* Inline theme variables for Tailwind */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... other color mappings */
}

/* Base styles */
@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

**Validation Rules**:
- ✅ Must start with `@import "tailwindcss"`
- ✅ Use `@theme` blocks for custom variables
- ✅ Use `@theme inline` for Tailwind color mappings
- ✅ Use `@layer base` for base styles
- ✅ NO `.dark` class variants (light mode only)
- ✅ NO dark mode CSS variables
- ✅ NO theme switching logic

**Prohibited Patterns**:

```css
/* ❌ DO NOT INCLUDE */
@custom-variant dark (&:is(.dark *));

.dark {
  --background: #000000;
  /* ... dark mode variables */
}
```

## Git Configuration Contract

### .gitignore

**Location**: `apps/figma_export/.gitignore`

**Required Entries**:

```
# Dependencies
node_modules

# Build output
dist
build
.turbo

# Environment
.env
.env.local

# IDE
.vscode/*
!.vscode/settings.json
.idea

# OS
.DS_Store
```

**Validation Rules**:
- ✅ Must ignore `node_modules`
- ✅ Must ignore build outputs (`dist`, `build`, `.turbo`)
- ✅ Must ignore environment files
- ✅ Can inherit from root `.gitignore`

## Entry Point Contract

### main.tsx

**Location**: `apps/figma_export/src/main.tsx`

**Required Structure**:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Validation Rules**:
- ✅ Must import CSS file (`./index.css`)
- ✅ Must use `ReactDOM.createRoot` (React 19)
- ✅ Must wrap in `<React.StrictMode>`
- ✅ Must target element with id `root`

### index.html

**Location**: `apps/figma_export/index.html`

**Required Structure**:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Figma Export Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Validation Rules**:
- ✅ Must have `<div id="root"></div>`
- ✅ Must load script as `type="module"`
- ✅ Script src must point to `/src/main.tsx`

## Validation Commands

### Pre-Integration Checks

```bash
# Verify all configs are in place
ls apps/figma_export/package.json
ls apps/figma_export/tsconfig.json
ls apps/figma_export/vite.config.ts
ls apps/figma_export/eslint.config.mjs
ls apps/figma_export/.prettierrc

# Verify dependencies install
cd apps/figma_export
pnpm install

# Verify type checking passes
pnpm check-types

# Verify linting passes
pnpm lint

# Verify formatting passes
pnpm format

# Verify app builds
pnpm build

# Verify app runs
pnpm dev
```

### Post-Integration Checks

```bash
# From repository root
pnpm install

# Type check all packages
pnpm check-types

# Lint all packages
pnpm lint

# Format check all packages
pnpm format

# Build all apps
pnpm build

# Run figma_export
cd apps/figma_export && pnpm dev
```

## Contract Compliance Matrix

| Configuration | Required | Location | Validation Command |
|--------------|----------|----------|-------------------|
| package.json | ✅ | apps/figma_export/ | `pnpm install` |
| tsconfig.json | ✅ | apps/figma_export/ | `pnpm check-types` |
| vite.config.ts | ✅ | apps/figma_export/ | `pnpm build` |
| eslint.config.mjs | ✅ | apps/figma_export/ | `pnpm lint` |
| .prettierrc | ✅ | apps/figma_export/ | `pnpm format` |
| index.css | ✅ | apps/figma_export/src/ | `pnpm dev` |
| main.tsx | ✅ | apps/figma_export/src/ | `pnpm dev` |
| index.html | ✅ | apps/figma_export/ | `pnpm dev` |

## Version History

- **1.0.0** (2025-10-14): Initial configuration contracts for figma_export integration

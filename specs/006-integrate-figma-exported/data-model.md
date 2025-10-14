# Data Model: Integrate Figma-Exported Vite App into Monorepo

**Feature**: 006-integrate-figma-exported  
**Date**: October 14, 2025  
**Status**: N/A

## Overview

This feature does not involve a data model. It is a tooling integration and component migration feature that:

- Configures build tools (Vite, TypeScript, ESLint, Prettier, Tailwind)
- Migrates UI components between packages
- Updates configuration files
- Removes unused features (dark mode)

## Configuration Entities

While there is no runtime data model, the feature involves several configuration entities:

### Package Configuration

**Location**: `apps/figma_export/package.json`

**Purpose**: Defines dependencies, scripts, and workspace relationships

**Key Fields**:
- `name`: Package name (`@repo/figma-export`)
- `dependencies`: Runtime dependencies (React, Radix UI, etc.)
- `devDependencies`: Build tools and shared configs
- `scripts`: Development and build commands
- `prettier`: Reference to shared Prettier config

### TypeScript Configuration

**Location**: `apps/figma_export/tsconfig.json`

**Purpose**: TypeScript compiler options and path mappings

**Key Fields**:
- `extends`: Reference to shared TypeScript config
- `compilerOptions.paths`: Path aliases for imports (@/, @repo/ui/*)
- `include`: Files to type check

### Vite Configuration

**Location**: `apps/figma_export/vite.config.ts`

**Purpose**: Build tool configuration

**Key Fields**:
- `plugins`: Vite plugins (React, Tailwind, tsconfig paths)
- `resolve.alias`: Module resolution aliases
- `server`: Dev server configuration

### ESLint Configuration

**Location**: `apps/figma_export/eslint.config.mjs`

**Purpose**: Code linting rules

**Key Fields**:
- Import from `@repo/eslint-config/react-internal.js`
- Optional app-specific overrides

### Tailwind Configuration

**Location**: `apps/figma_export/src/index.css`

**Purpose**: Tailwind v4 CSS-first configuration

**Key Directives**:
- `@import "tailwindcss"`: Import Tailwind base
- `@theme`: Define custom design tokens
- `@layer base`: Base styles

## Component Structure

Components are React functional components with TypeScript types:

```typescript
// Example component structure
export interface ComponentProps {
  // Props definition
}

export function Component({ ...props }: ComponentProps) {
  // Component implementation
  return <div>...</div>;
}
```

**No state management**: Components are presentational only  
**No API calls**: Client-side only, no backend integration  
**No data persistence**: No local storage or databases

## Relationships

```
apps/figma_export
  ├─ depends on → packages/ui (component library)
  ├─ depends on → packages/typescript-config (build config)
  ├─ depends on → packages/tailwind (styling config)
  ├─ depends on → packages/eslint-config (linting config)
  └─ depends on → packages/prettier (formatting config)

packages/ui
  ├─ exports → React components
  └─ exports → Utility functions (cn, etc.)
```

## Validation Rules

**Package Dependencies**:
- All @repo/* packages must use `workspace:*` protocol
- React version must match monorepo standard (19.0.0)
- Vite version must match monorepo standard (7.x)
- Tailwind version must be 4.0.6+

**TypeScript**:
- All components must have TypeScript types
- No `any` types allowed
- Strict mode enabled

**Code Quality**:
- All files must pass ESLint checks
- All files must pass Prettier formatting
- All files must pass TypeScript type checking

## Migration Tracking

**Component Migration Status**: (To be tracked during implementation)

- Total components in figma_export/src/components/: ~58
- Components migrated to packages/ui: 0
- Components remaining: ~58

This will be updated during task execution.

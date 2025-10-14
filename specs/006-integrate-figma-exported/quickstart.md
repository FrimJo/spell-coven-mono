# Quickstart: Figma Export Integration

**Feature**: 006-integrate-figma-exported  
**Purpose**: Guide for developers to run and work with the integrated figma_export app

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Repository cloned and on branch `006-integrate-figma-exported`

## Quick Start

### 1. Install Dependencies

```bash
# From repository root
pnpm install
```

### 2. Run Figma Export App

```bash
# From repository root
cd apps/figma_export
pnpm dev
```

The app will start on `http://localhost:3001` (or next available port if 3001 is taken).

### 3. Run Main Web App (for comparison)

```bash
# From repository root
cd apps/web
pnpm dev
```

The main app runs on `http://localhost:3000`.

## Development Commands

### figma_export App

```bash
# Development server
pnpm dev

# Type checking
pnpm check-types

# Linting
pnpm lint

# Format checking
pnpm format

# Production build
pnpm build

# Preview production build
pnpm serve
```

### Shared Component Library

```bash
# From packages/ui
cd packages/ui

# Type checking
pnpm check-types

# Linting
pnpm lint

# Generate new component (turbo generator)
pnpm generate:component
```

## Project Structure

```
apps/figma_export/
├── src/
│   ├── components/          # UI components (imported from @repo/ui)
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind v4 styles
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── eslint.config.mjs        # ESLint configuration
└── .prettierrc              # Prettier configuration

packages/ui/
├── src/
│   ├── components/          # Shared React components
│   ├── lib/                 # Utility functions
│   └── index.ts             # Component exports
└── package.json             # Package configuration
```

## Importing Components

### From figma_export App

```typescript
// Import shared components from packages/ui
import { Button } from '@repo/ui/components/button';
import { Card } from '@repo/ui/components/card';
import { cn } from '@repo/ui/lib/utils';

// Use in your component
export function MyComponent() {
  return (
    <Card>
      <Button className={cn("custom-class")}>Click me</Button>
    </Card>
  );
}
```

### From packages/ui

```typescript
// Export new components in packages/ui/src/index.ts
export { MyNewComponent } from './components/my-new-component';

// Then import in apps
import { MyNewComponent } from '@repo/ui/components/my-new-component';
```

## Styling with Tailwind v4

### CSS Configuration

```css
/* apps/figma_export/src/index.css */
@import "tailwindcss";

/* Define custom theme variables */
@theme {
  --color-primary: #030213;
  --color-secondary: #e9ebef;
  --radius-button: 14px;
}

/* Use Tailwind utilities */
@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

### Using Tailwind Classes

```typescript
// Tailwind v4 supports all standard utilities
<div className="flex items-center gap-4 p-6 rounded-lg bg-primary text-primary-foreground">
  <span className="text-lg font-medium">Hello World</span>
</div>
```

## Code Quality

### Running Checks

```bash
# Type check all packages
pnpm check-types

# Lint all packages
pnpm lint

# Format check all packages
pnpm format
```

### Pre-commit Checklist

Before committing changes:
- [ ] `pnpm check-types` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm format` passes
- [ ] figma_export app runs without errors
- [ ] Components render correctly in both figma_export and web apps

## Troubleshooting

### Port Already in Use

If port 3001 is already in use:

```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in vite.config.ts
server: {
  port: 3002,  // Use different port
}
```

### Type Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Reinstall dependencies
pnpm install

# Run type check
pnpm check-types
```

### Import Errors

If component imports fail:

1. Check package.json exports in packages/ui
2. Verify tsconfig.json paths configuration
3. Ensure vite.config.ts has correct alias resolution
4. Restart dev server after config changes

### Styling Issues

If Tailwind styles don't apply:

1. Verify `@import "tailwindcss"` is in index.css
2. Check vite.config.ts includes `tailwindcss()` plugin
3. Ensure CSS file is imported in main.tsx
4. Clear browser cache and restart dev server

## Next Steps

- Review [spec.md](./spec.md) for feature requirements
- Review [plan.md](./plan.md) for implementation approach
- Review [research.md](./research.md) for technical decisions
- Run `/speckit.tasks` to generate implementation tasks
- Run `/speckit.implement` to execute tasks

## Support

For questions or issues:
1. Check existing documentation in specs/006-integrate-figma-exported/
2. Review reference implementation in apps/web/
3. Consult constitution.md for project principles
4. Use Context7 MCP server for package documentation

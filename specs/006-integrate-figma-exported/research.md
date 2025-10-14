# Research: Integrate Figma-Exported Vite App into Monorepo

**Feature**: 006-integrate-figma-exported  
**Date**: October 14, 2025  
**Status**: Complete

## Research Questions

Based on Technical Context analysis, the following areas required research to ensure successful implementation:

1. **Tailwind CSS v4 Migration**: Best practices for upgrading from Tailwind v3 to v4
2. **Monorepo Tooling Integration**: Patterns for sharing ESLint, Prettier, TypeScript configs
3. **Component Migration Strategy**: Approach for moving components to shared library
4. **Dark Mode Removal**: Techniques for removing theme switching from Tailwind v4 apps
5. **Dependency Version Alignment**: Strategy for upgrading monorepo packages

## Research Findings

### 1. Tailwind CSS v4 Migration

**Decision**: Use `@tailwindcss/vite` plugin with CSS-first configuration

**Rationale**:
- Tailwind v4 introduces a new CSS-first architecture using `@import` and `@theme` directives
- The `@tailwindcss/vite` plugin (v4.0.6) replaces the traditional `tailwind.config.js` approach
- Configuration is done directly in CSS files using `@theme` blocks
- apps/web already uses this pattern successfully

**Key Changes**:
- Replace `tailwind.config.js` with CSS-based configuration
- Use `@import "tailwindcss"` in main CSS file
- Define custom properties using `@theme` directive
- Remove PostCSS configuration (handled by Vite plugin)

**Alternatives Considered**:
- Stay on Tailwind v3: Rejected because spec requires v4 and apps/web already uses v4
- Use compatibility mode: Rejected because it adds unnecessary complexity

**References**:
- apps/web/src/globals.css shows v4 `@theme` usage
- apps/web/vite.config.ts shows `@tailwindcss/vite` plugin configuration
- apps/web/package.json shows tailwindcss@^4.0.6 dependency

### 2. Monorepo Tooling Integration

**Decision**: Use workspace protocol for shared config packages with direct file references

**Rationale**:
- Existing pattern in apps/web: `"@repo/eslint-config": "workspace:*"`
- TypeScript uses `extends` to reference shared tsconfig bases
- ESLint uses flat config format (eslint.config.mjs) with imports
- Prettier uses package reference in package.json `"prettier"` field

**Implementation Pattern**:
```json
// package.json
{
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@repo/tailwind-config": "workspace:*"
  },
  "prettier": "@repo/prettier-config"
}
```

```javascript
// eslint.config.mjs
import baseConfig from "@repo/eslint-config/react-internal.js";
export default baseConfig;
```

```json
// tsconfig.json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": { /* overrides */ }
}
```

**Alternatives Considered**:
- Copy configs to each app: Rejected because it violates DRY and makes updates difficult
- Use extends with relative paths: Rejected because workspace protocol is cleaner

### 3. Component Migration Strategy

**Decision**: Move all figma_export components to packages/ui incrementally, updating imports

**Rationale**:
- Clarification answer: "All components used in figma_export" should be migrated
- packages/ui already has established export pattern: `"./components/*": "./src/components/*.tsx"`
- Existing components in packages/ui show the pattern (button.tsx, card.tsx, etc.)
- figma_export can import from packages/ui using `@repo/ui/components/[name]`

**Migration Steps**:
1. Identify all components in apps/figma_export/src/components/
2. Move each component file to packages/ui/src/components/
3. Update imports in figma_export to use `@repo/ui/components/[name]`
4. Ensure components have proper TypeScript types
5. Test that components render identically

**Component Precedence** (from clarification):
- During migration: figma_export version takes precedence
- After validation: packages/ui becomes source of truth
- For conflicts: Move figma_export version to packages/ui, update both apps to use it

**Alternatives Considered**:
- Keep components in figma_export: Rejected per spec requirement FR-007
- Only move "common" components: Rejected per clarification (all components)
- Create new component structure: Rejected because existing pattern works well

### 4. Dark Mode Removal

**Decision**: Remove all `.dark` class variants and theme switching logic, keep only light mode CSS variables

**Rationale**:
- Clarification answer: "Light mode only (match Figma design default)"
- Tailwind v4 uses `@custom-variant dark` for dark mode support
- Remove dark mode by: deleting `.dark` CSS rules, removing `next-themes` dependency, removing theme toggle UI

**Implementation**:
1. Remove `next-themes` package from dependencies
2. Delete all `.dark { }` CSS blocks from index.css
3. Remove any theme provider components
4. Remove theme toggle buttons/switches from UI
5. Keep only `:root` CSS variables (light mode)

**Alternatives Considered**:
- Keep dark mode but disable toggle: Rejected because spec says "MUST be removed"
- Use system preference: Rejected per clarification (light mode only)

### 5. Dependency Version Alignment

**Decision**: Upgrade monorepo packages to match figma_export versions where conflicts exist

**Rationale**:
- Clarification answer: "Upgrade monorepo to match figma_export versions (accept breaking changes)"
- figma_export has React 18.3.1, apps/web has React 19.0.0 → Use React 19 (newer)
- figma_export has many Radix UI components → Align versions with packages/ui
- Vite versions: figma_export has 6.3.5, apps/web has 7.1.7 → Use Vite 7 (newer)

**Key Version Decisions**:
- React: 19.0.0 (upgrade figma_export from 18.3.1)
- Vite: 7.1.7 (upgrade figma_export from 6.3.5)
- Tailwind: 4.0.6 (upgrade figma_export, already in apps/web)
- TypeScript: 5.9.2 (align with monorepo catalog)
- Radix UI: Match versions in packages/ui

**Migration Strategy**:
1. Update figma_export/package.json to use catalog versions where available
2. Use workspace protocol for all @repo packages
3. Run `pnpm install` to resolve dependencies
4. Fix any breaking changes from React 18→19 upgrade
5. Test that all components still work

**Alternatives Considered**:
- Downgrade apps/web to match figma_export: Rejected (would break working app)
- Maintain different versions: Rejected per clarification (upgrade monorepo)

## Best Practices Summary

### Tailwind v4
- Use `@import "tailwindcss"` in CSS entry point
- Configure via `@theme` blocks in CSS
- Use `@tailwindcss/vite` plugin in vite.config.ts
- Define custom properties in `:root` for design tokens

### Monorepo Configuration
- Use `workspace:*` protocol for internal packages
- Reference shared configs via package imports
- Keep app-specific overrides minimal
- Follow patterns from apps/web as reference

### Component Library
- Export components via package.json `exports` field
- Use TypeScript for all components
- Import using `@repo/ui/components/[name]` pattern
- Keep components pure and reusable

### Code Quality
- Fix all linting errors during integration (per clarification)
- Run type checking frequently (`pnpm check-types`)
- Use Context7 for up-to-date package documentation
- Follow existing code style in packages/ui

## Implementation Readiness

✅ All research questions resolved  
✅ No blocking unknowns remain  
✅ Clear migration path established  
✅ Reference implementations identified (apps/web)  
✅ Ready to proceed to Phase 1 (Design & Contracts)

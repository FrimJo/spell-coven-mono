# Component Interface Contract

**Feature**: 006-integrate-figma-exported  
**Version**: 1.0.0  
**Date**: October 14, 2025

## Overview

This document defines the interface contract for components in the shared UI library (`packages/ui`). All components migrated from `apps/figma_export` must conform to these standards.

## Component Structure

### File Organization

```
packages/ui/src/components/
├── button.tsx              # Single component per file
├── card.tsx
├── dialog.tsx
└── [component-name].tsx    # kebab-case naming
```

### Export Pattern

```typescript
// packages/ui/src/components/button.tsx

import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';

// 1. Define props interface
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// 2. Export component as named export
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  // Implementation
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

// 3. Optional: Export display name for debugging
Button.displayName = 'Button';
```

### Import Pattern

```typescript
// In consuming apps (figma_export, web)
import { Button } from '@repo/ui/components/button';
import { Card, CardHeader, CardContent } from '@repo/ui/components/card';
```

## TypeScript Requirements

### Type Safety

- ✅ All components MUST have TypeScript types
- ✅ Props MUST extend appropriate HTML element types
- ✅ No `any` types allowed
- ✅ Use `React.ComponentPropsWithoutRef<T>` for forwarding props
- ✅ Use `React.forwardRef` when refs are needed

### Example: Component with Ref

```typescript
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn('input-base-styles', className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
```

## Styling Contract

### Tailwind Usage

- ✅ Use Tailwind utility classes for styling
- ✅ Use `cn()` utility for conditional classes
- ✅ Support `className` prop for consumer overrides
- ✅ Use `class-variance-authority` for variants

### Example: Variants with CVA

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@repo/ui/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
```

## Composition Patterns

### Compound Components

For components with multiple parts (Card, Dialog, etc.):

```typescript
// card.tsx
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border bg-card', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

// Usage
import { Card, CardHeader, CardContent } from '@repo/ui/components/card';

<Card>
  <CardHeader>Title</CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Radix UI Integration

For components using Radix UI primitives:

```typescript
import * as DialogPrimitive from '@radix-ui/react-dialog';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn('fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2', className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
```

## Accessibility Requirements

- ✅ Use semantic HTML elements
- ✅ Include ARIA attributes where appropriate
- ✅ Support keyboard navigation
- ✅ Maintain focus management
- ✅ Provide accessible labels

### Example: Accessible Button

```typescript
export function Button({
  children,
  'aria-label': ariaLabel,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      aria-disabled={disabled}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
```

## Testing Contract

### Component Testing (Optional)

If tests are written, they should verify:

- Component renders without errors
- Props are correctly applied
- Variants render different styles
- Event handlers are called
- Accessibility attributes are present

### Example Test Structure

```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByText('Delete');
    expect(button).toHaveClass('bg-destructive');
  });
});
```

## Migration Checklist

When migrating a component from figma_export to packages/ui:

- [ ] Component file uses kebab-case naming
- [ ] Props interface is exported
- [ ] Component is exported as named export
- [ ] TypeScript types are complete (no `any`)
- [ ] Uses `cn()` utility for className merging
- [ ] Supports `className` prop override
- [ ] Uses Tailwind utilities (no inline styles)
- [ ] Includes displayName for debugging
- [ ] Follows existing patterns in packages/ui
- [ ] No dark mode variants (light mode only)
- [ ] No theme switching logic
- [ ] Passes TypeScript type checking
- [ ] Passes ESLint linting
- [ ] Passes Prettier formatting

## Version History

- **1.0.0** (2025-10-14): Initial contract definition for figma_export integration

declare module '@testing-library/jest-dom/vitest' {}

declare module 'vitest' {
  interface Assertion<_T = unknown> {
    toHaveValue(value: unknown): void
    toBeInTheDocument(): void
    toBeDisabled(): void
  }

  interface AsymmetricMatchersContaining {
    toBeInTheDocument(): void
  }
}

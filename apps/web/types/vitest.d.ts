type TestCallback = () => void | Promise<void>

declare interface MockInstance<
  Args extends unknown[] = unknown[],
  Returns = unknown,
> {
  (...args: Args): Returns
  mockResolvedValue(value: Returns): MockInstance<Args, Returns>
  mockReturnValue(value: Returns): MockInstance<Args, Returns>
  mockImplementation(
    impl: (...args: Args) => Returns,
  ): MockInstance<Args, Returns>
  mockReturnValueOnce(value: Returns): MockInstance<Args, Returns>
  mockImplementationOnce(
    impl: (...args: Args) => Returns,
  ): MockInstance<Args, Returns>
  mockClear(): void
  mockReset(): void
}

declare interface ViMocker {
  fn<T extends (...args: unknown[]) => unknown>(
    impl?: T,
  ): MockInstance<Parameters<T>, ReturnType<T>>
  fn(): MockInstance
  mock(moduleName: string, factory: () => unknown): void
  clearAllMocks(): void
  useRealTimers(): void
  useFakeTimers(): void
  spyOn<T, K extends keyof T>(object: T, method: K): MockInstance
}

declare module 'vitest' {
  export interface Describe {
    (name: string, fn: TestCallback): void
    skip: (name: string, fn: TestCallback) => void
  }

  export interface It {
    (name: string, fn: TestCallback): void
    skip: (name: string, fn: TestCallback) => void
  }

  export const describe: Describe
  export const it: It
  export const beforeEach: (fn: TestCallback) => void
  export const afterEach: (fn: TestCallback) => void
  export const beforeAll: (fn: TestCallback) => void
  export const vi: ViMocker

  export interface Assertion<T = unknown> {
    [matcher: string]: unknown
    not: Assertion<T>
    resolves: Assertion<T>
    rejects: Assertion<T>
  }

  export interface ExpectStatic {
    <T>(value: T): Assertion<T>
  }

  export const expect: ExpectStatic
}

type TimeoutHandle = number

declare namespace NodeJS {
  type Timeout = TimeoutHandle
}

declare const process: {
  env: Record<string, string | undefined>
}

declare class Buffer extends Uint8Array {
  constructor(input: ArrayBuffer | ArrayBufferView | string, encoding?: string)
  toString(encoding?: string): string
  static from(
    input: string | ArrayBuffer | ArrayBufferView,
    encoding?: string,
  ): Buffer
}

declare function setTimeout(
  handler: (...args: unknown[]) => void,
  timeout?: number,
  ...args: unknown[]
): TimeoutHandle

declare function clearTimeout(timeoutId: TimeoutHandle): void

type TimeoutHandle = number;

declare namespace NodeJS {
  type Timeout = TimeoutHandle;
}

declare const console: {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

declare const process: {
  env: Record<string, string | undefined>;
  platform: string;
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): void;
  exit(code?: number): never;
};

declare class Buffer extends Uint8Array {
  constructor(input: ArrayBuffer | ArrayBufferView | string, encoding?: string);
  toString(encoding?: string): string;
  static from(
    input: string | ArrayBuffer | ArrayBufferView,
    encoding?: string,
  ): Buffer;
}

declare interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

declare function fetch(
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<FetchResponse>;

declare function setTimeout(
  handler: (...args: unknown[]) => void,
  timeout?: number,
  ...args: unknown[]
): TimeoutHandle;

declare function clearTimeout(timeoutId: TimeoutHandle): void;

declare function setInterval(
  handler: (...args: unknown[]) => void,
  timeout?: number,
  ...args: unknown[]
): TimeoutHandle;

declare function clearInterval(intervalId: TimeoutHandle): void;

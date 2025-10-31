declare module 'node:http' {
  type RequestListener = (
    req: { url?: string | null },
    res: {
      writeHead(statusCode: number, headers?: Record<string, string>): void;
      end(data?: string): void;
    },
  ) => void;

  interface Server {
    listen(port: number, callback?: () => void): void;
    close(): void;
  }

  export function createServer(listener?: RequestListener): Server;
}

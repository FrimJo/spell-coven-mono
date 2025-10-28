declare module 'ws' {
  type WebSocketData = string | ArrayBuffer | ArrayBufferView | Buffer | Buffer[];

  interface WebSocketInstance {
    readonly readyState: number;
    on(event: 'open', listener: () => void): this;
    on(event: 'message', listener: (data: WebSocketData) => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    removeAllListeners(): void;
    close(code?: number, reason?: string): void;
    send(data: string): void;
  }

  interface WebSocketConstructor {
    readonly CONNECTING: number;
    readonly OPEN: number;
    new (url: string): WebSocketInstance;
  }

  const WebSocket: WebSocketConstructor;

  export type Data = WebSocketData;
  export default WebSocket;
}

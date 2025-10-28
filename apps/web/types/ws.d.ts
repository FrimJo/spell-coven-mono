declare module 'ws' {
  type WebSocketData = string | ArrayBuffer | ArrayBufferView | Buffer | Buffer[];

  interface WebSocketInstance {
    readonly readyState: number;
    readonly bufferedAmount: number;
    close(code?: number, reason?: string): void;
    send(data: string): void;
    on(event: 'message', listener: (data: WebSocketData) => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }

  interface WebSocketConstructor {
    readonly CONNECTING: number;
    readonly OPEN: number;
    new (url: string, protocols?: string | string[]): WebSocketInstance;
  }

  export type Data = WebSocketData;
  export type WebSocket = WebSocketInstance;
  const WebSocket: WebSocketConstructor;
  export default WebSocket;
}

declare module 'node:crypto' {
  interface Hmac {
    update(data: string | ArrayBuffer | ArrayBufferView): Hmac;
    digest(encoding: 'hex' | 'base64' | 'latin1'): string;
  }

  export function createHmac(algorithm: string, key: string): Hmac;
}

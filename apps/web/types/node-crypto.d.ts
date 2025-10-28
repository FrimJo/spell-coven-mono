declare module 'node:crypto' {
  interface Hmac {
    update(data: string | ArrayBufferView): Hmac
    digest(): Buffer
    digest(encoding: 'hex' | 'base64' | 'base64url'): string
  }

  interface Verify {
    update(data: string | ArrayBufferView): Verify
    end(): void
    verify(key: unknown, signature: Uint8Array): boolean
  }

  export function createHmac(
    algorithm: string,
    key: string | ArrayBuffer | ArrayBufferView,
  ): Hmac

  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean

  export function randomUUID(): string

  export function createVerify(algorithm: string): Verify

  export function createPublicKey(options: { key: JsonWebKey; format: 'jwk' }): unknown
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createPairingToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createPhoneSessionId(): string {
  return `phone-${crypto.randomUUID()}`
}

export function getPhoneCameraUrl(pairingToken: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const url = new URL('/phone-camera', origin)
  url.searchParams.set('pairing', pairingToken)
  return url.toString()
}

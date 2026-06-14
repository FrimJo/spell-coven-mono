export type SentryPrimitive = string | number | boolean | null | undefined
export type SentryData =
  | SentryPrimitive
  | SentryData[]
  | { [key: string]: SentryData }

const SENSITIVE_KEY_PARTS = [
  'auth',
  'authorization',
  'avatar',
  'body',
  'cardimage',
  'card_image',
  'code',
  'cookie',
  'deviceid',
  'device_id',
  'email',
  'headers',
  'image',
  'jwt',
  'password',
  'refresh',
  'roomid',
  'room_id',
  'secret',
  'session',
  'token',
  'userid',
  'user_id',
]

export function isSensitiveSentryKey(key: string): boolean {
  const normalized = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
}

function sanitizeString(value: string): string {
  if (value.startsWith('data:image/')) return '[Filtered]'
  if (value.startsWith('blob:')) return '[Filtered]'

  try {
    const target = new URL(value)
    for (const [key] of target.searchParams) {
      if (isSensitiveSentryKey(key)) {
        target.searchParams.set(key, '[Filtered]')
      }
    }
    return target.toString()
  } catch {
    return value
  }
}

export function sanitizeSentryData<T extends SentryData>(data: T): T {
  if (typeof data === 'string') {
    return sanitizeString(data) as T
  }

  if (data === null || data === undefined || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeSentryData(item)) as T
  }

  const sanitized: Record<string, SentryData> = {}
  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = isSensitiveSentryKey(key)
      ? '[Filtered]'
      : sanitizeSentryData(value)
  }

  return sanitized as T
}

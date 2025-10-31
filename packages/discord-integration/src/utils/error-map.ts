import type { DiscordRestError } from '../clients/DiscordRestClient.js'

export type DiscordDomainErrorCode =
  | 'UNKNOWN_ERROR'
  | 'UNKNOWN_CHANNEL'
  | 'UNKNOWN_MEMBER'
  | 'UNKNOWN_ROLE'
  | 'ROLE_LIMIT_REACHED'
  | 'MISSING_ACCESS'
  | 'MISSING_PERMISSIONS'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'

export interface DiscordErrorMapping {
  code: DiscordDomainErrorCode
  message: string
  retry: boolean
  status?: number
  discordCode?: number
}

const ERROR_CODE_MAP: Record<number, DiscordDomainErrorCode> = {
  10003: 'UNKNOWN_CHANNEL',
  10007: 'UNKNOWN_MEMBER',
  10011: 'UNKNOWN_ROLE',
  30013: 'ROLE_LIMIT_REACHED',
  50001: 'MISSING_ACCESS',
  50013: 'MISSING_PERMISSIONS',
  50035: 'INVALID_REQUEST',
  130000: 'RATE_LIMITED',
}

function isDiscordRestError(
  error: unknown,
): error is
  | DiscordRestError
  | { code?: number; status?: number; message?: string } {
  if (!error || typeof error !== 'object') {
    return false
  }

  return 'message' in error
}

export function mapDiscordError(
  error: unknown,
  fallback: DiscordDomainErrorCode = 'UNKNOWN_ERROR',
): DiscordErrorMapping {
  if (!isDiscordRestError(error)) {
    return {
      code: fallback,
      message: 'Discord request failed',
      retry: false,
    }
  }

  const discordCode = error.code
  const status = error.status
  const mappedCode =
    discordCode !== undefined ? ERROR_CODE_MAP[discordCode] : undefined
  const domainCode = mappedCode ?? fallback

  const retry =
    status === 429 ||
    domainCode === 'RATE_LIMITED' ||
    (status !== undefined && status >= 500)

  return {
    code: domainCode,
    message:
      typeof error.message === 'string'
        ? error.message
        : 'Discord request failed',
    retry,
    status,
    discordCode,
  }
}

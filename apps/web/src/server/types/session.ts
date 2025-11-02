/**
 * Session Types
 * Types for session management and refresh
 */

export interface SessionRefreshRequest {
  refreshToken: string
  userId: string
}

export interface SessionRefreshResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface SessionState {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  isRefreshing: boolean
  lastRefreshTime: number
}

export interface SessionRefreshError {
  code: 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'NETWORK_ERROR' | 'UNKNOWN'
  message: string
}

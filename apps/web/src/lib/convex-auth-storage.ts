export interface ConvexAuthTokens {
  token: string
  refreshToken: string
  /** Display name from preview login (used when Convex user has no name, e.g. no Discord) */
  previewName?: string
}

export function getConvexAuthNamespace(convexUrl: string): string {
  return convexUrl.replace(/[^a-zA-Z0-9]/g, '')
}

export function getConvexAuthStorageKeys(convexUrl: string): {
  jwtKey: string
  refreshTokenKey: string
  previewNameKey: string
} {
  const namespace = getConvexAuthNamespace(convexUrl)
  return {
    jwtKey: `__convexAuthJWT_${namespace}`,
    refreshTokenKey: `__convexAuthRefreshToken_${namespace}`,
    previewNameKey: `__convexAuthPreviewName_${namespace}`,
  }
}

/**
 * Read the stored preview display name (from preview login).
 * Used as the user's display name when the Convex user document has no name (e.g. password/preview auth).
 */
export function getConvexAuthPreviewName(
  convexUrl: string,
  storage: Pick<Storage, 'getItem'> = typeof window !== 'undefined'
    ? window.localStorage
    : (null as unknown as Storage),
): string | null {
  if (!storage) return null
  const { previewNameKey } = getConvexAuthStorageKeys(convexUrl)
  const value = storage.getItem(previewNameKey)
  return value !== null && value !== '' ? value : null
}

/**
 * Clear the stored preview name (e.g. on sign out).
 */
export function clearConvexAuthPreviewName(
  convexUrl: string,
  storage: Pick<Storage, 'removeItem'> = window.localStorage,
): void {
  const { previewNameKey } = getConvexAuthStorageKeys(convexUrl)
  storage.removeItem(previewNameKey)
}

export function writeConvexAuthTokensToStorage(
  convexUrl: string,
  tokens: ConvexAuthTokens,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = window.localStorage,
): void {
  const { jwtKey, refreshTokenKey, previewNameKey } =
    getConvexAuthStorageKeys(convexUrl)
  storage.setItem(jwtKey, tokens.token)
  storage.setItem(refreshTokenKey, tokens.refreshToken)
  if (tokens.previewName !== undefined) {
    storage.setItem(previewNameKey, tokens.previewName)
  } else {
    storage.removeItem(previewNameKey)
  }
}

export function buildConvexAuthStorageState(params: {
  appOrigin: string
  convexUrl: string
  tokens: ConvexAuthTokens
  extraLocalStorage?: Array<{ name: string; value: string }>
}): {
  cookies: []
  origins: Array<{
    origin: string
    localStorage: Array<{ name: string; value: string }>
  }>
} {
  const { appOrigin, convexUrl, tokens, extraLocalStorage = [] } = params
  const { jwtKey, refreshTokenKey, previewNameKey } =
    getConvexAuthStorageKeys(convexUrl)
  const baseLocalStorage: Array<{ name: string; value: string }> = [
    { name: jwtKey, value: tokens.token },
    { name: refreshTokenKey, value: tokens.refreshToken },
  ]
  if (tokens.previewName !== undefined) {
    baseLocalStorage.push({ name: previewNameKey, value: tokens.previewName })
  }
  return {
    cookies: [],
    origins: [
      {
        origin: appOrigin,
        localStorage: [...baseLocalStorage, ...extraLocalStorage],
      },
    ],
  }
}

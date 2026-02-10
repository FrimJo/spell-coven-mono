export interface ConvexAuthTokens {
  token: string
  refreshToken: string
}

export function getConvexAuthNamespace(convexUrl: string): string {
  return convexUrl.replace(/[^a-zA-Z0-9]/g, '')
}

export function getConvexAuthStorageKeys(convexUrl: string): {
  jwtKey: string
  refreshTokenKey: string
} {
  const namespace = getConvexAuthNamespace(convexUrl)
  return {
    jwtKey: `__convexAuthJWT_${namespace}`,
    refreshTokenKey: `__convexAuthRefreshToken_${namespace}`,
  }
}

export function writeConvexAuthTokensToStorage(
  convexUrl: string,
  tokens: ConvexAuthTokens,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  const { jwtKey, refreshTokenKey } = getConvexAuthStorageKeys(convexUrl)
  storage.setItem(jwtKey, tokens.token)
  storage.setItem(refreshTokenKey, tokens.refreshToken)
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
  const { jwtKey, refreshTokenKey } = getConvexAuthStorageKeys(convexUrl)
  return {
    cookies: [],
    origins: [
      {
        origin: appOrigin,
        localStorage: [
          { name: jwtKey, value: tokens.token },
          { name: refreshTokenKey, value: tokens.refreshToken },
          ...extraLocalStorage,
        ],
      },
    ],
  }
}

import {
  createPublicKey,
  createVerify,
  type JsonWebKey as NodeJsonWebKey,
} from 'node:crypto'

export interface JWTPayload {
  [key: string]: unknown
}

/**
 * JWT claims expected in tokens
 */
export interface JWTClaims extends JWTPayload {
  iss: string // Issuer (IdP URL)
  aud: string | string[] // Audience (app identifier)
  sub: string // Subject (user ID)
  exp: number // Expiration (Unix timestamp)
  iat?: number // Issued at (optional)
}

/**
 * JWT verification configuration
 */
export interface JWTConfig {
  issuer: string
  audience: string
  jwksUrl: string
}

interface ParsedJwt {
  header: { alg: string; kid?: string; [key: string]: unknown }
  payload: Record<string, unknown>
  signature: Uint8Array
  signingInput: string
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000
const jwksCache = new Map<string, { keys: NodeJsonWebKey[]; expiresAt: number }>()

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  const padded =
    padding === 0 ? normalized : normalized + '='.repeat((4 - padding) % 4)
  return Buffer.from(padded, 'base64')
}

function parseJwt(token: string): ParsedJwt {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = JSON.parse(
    base64UrlDecode(encodedHeader).toString('utf-8'),
  ) as ParsedJwt['header']
  const payload = JSON.parse(
    base64UrlDecode(encodedPayload).toString('utf-8'),
  ) as ParsedJwt['payload']
  const signature = base64UrlDecode(encodedSignature)

  return {
    header,
    payload,
    signature,
    signingInput: `${encodedHeader}.${encodedPayload}`,
  }
}

async function fetchJwks(url: string): Promise<NodeJsonWebKey[]> {
  const now = Date.now()
  const cached = jwksCache.get(url)
  if (cached && cached.expiresAt > now) {
    return cached.keys
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`)
  }

  const body = (await response.json()) as { keys?: NodeJsonWebKey[] }
  if (!body.keys || !Array.isArray(body.keys)) {
    throw new Error('Invalid JWKS response')
  }

  jwksCache.set(url, { keys: body.keys, expiresAt: now + JWKS_CACHE_TTL_MS })
  return body.keys
}

function selectJwk(
  keys: NodeJsonWebKey[],
  header: ParsedJwt['header'],
): NodeJsonWebKey | undefined {
  if (header.kid) {
    const match = keys.find(
      (key) => (key as { kid?: string }).kid === header.kid,
    )
    if (match) {
      return match
    }
  }

  return keys[0]
}

const SUPPORTED_RSA_ALGORITHMS = new Set(['RS256', 'RS384', 'RS512'])

function getVerifyAlgorithm(alg: string): string {
  if (!SUPPORTED_RSA_ALGORITHMS.has(alg)) {
    throw new Error(
      `Unsupported JWT algorithm: ${alg}. Only RS256/RS384/RS512 are supported.`,
    )
  }

  switch (alg) {
    case 'RS256':
      return 'RSA-SHA256'
    case 'RS384':
      return 'RSA-SHA384'
    case 'RS512':
      return 'RSA-SHA512'
    default:
      throw new Error(`Unsupported JWT algorithm: ${alg}`)
  }
}

function verifySignature(
  alg: string,
  signingInput: string,
  signature: Uint8Array,
  jwk: NodeJsonWebKey,
): boolean {
  if (jwk.kty !== 'RSA') {
    throw new Error(`Unsupported JWKS key type: ${jwk.kty ?? 'unknown'}`)
  }
  const keyObject = createPublicKey({ key: jwk, format: 'jwk' })
  const verifier = createVerify(getVerifyAlgorithm(alg))
  verifier.update(signingInput)
  verifier.end()
  return verifier.verify(keyObject, signature)
}

function validateAudience(aud: unknown, expected: string): boolean {
  if (typeof aud === 'string') {
    return aud === expected
  }

  if (Array.isArray(aud)) {
    return aud.includes(expected)
  }

  return false
}

function assertClaims(
  payload: Record<string, unknown>,
): asserts payload is JWTClaims {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Missing required claim: sub')
  }

  if (typeof payload.iss !== 'string' || payload.iss.length === 0) {
    throw new Error('Missing required claim: iss')
  }

  if (
    typeof payload.aud !== 'string' &&
    !(
      Array.isArray(payload.aud) &&
      payload.aud.every((value) => typeof value === 'string')
    )
  ) {
    throw new Error('Invalid claim: aud')
  }

  if (typeof payload.exp !== 'number') {
    throw new Error('Missing required claim: exp')
  }
}

/**
 * Verify JWT token using JWKS from IdP
 *
 * @param token - JWT token string
 * @param config - JWT configuration (issuer, audience, JWKS URL)
 * @returns Verified JWT claims
 * @throws Error if token is invalid or expired
 */
export async function verifyJWT(
  token: string,
  config: JWTConfig,
): Promise<JWTClaims> {
  try {
    const parsed = parseJwt(token)
    const jwks = await fetchJwks(config.jwksUrl)
    if (!jwks.length) {
      throw new Error('JWKS response did not contain any keys')
    }

    const jwk = selectJwk(jwks, parsed.header)
    if (!jwk) {
      throw new Error('Unable to find matching JWKS key')
    }

    if (
      !verifySignature(
        parsed.header.alg,
        parsed.signingInput,
        parsed.signature,
        jwk,
      )
    ) {
      throw new Error('JWT signature verification failed')
    }

    assertClaims(parsed.payload)

    const claims = parsed.payload as JWTClaims

    if (claims.iss !== config.issuer) {
      throw new Error('Unexpected token issuer')
    }

    if (!validateAudience(claims.aud, config.audience)) {
      throw new Error('Token audience mismatch')
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (claims.exp <= nowSeconds) {
      throw new Error('Token has expired')
    }

    return claims
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JWT verification failed: ${error.message}`)
    }
    throw new Error('JWT verification failed: Unknown error')
  }
}

/**
 * Extract JWT token from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns JWT token string or null if not found
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}


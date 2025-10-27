import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * JWT claims expected in tokens
 */
export interface JWTClaims extends JWTPayload {
  iss: string; // Issuer (IdP URL)
  aud: string; // Audience (app identifier)
  sub: string; // Subject (user ID)
  exp: number; // Expiration (Unix timestamp)
  iat?: number; // Issued at (optional)
}

/**
 * JWT verification configuration
 */
export interface JWTConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
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
  config: JWTConfig
): Promise<JWTClaims> {
  try {
    // Create JWKS client (cached by jose library)
    const JWKS = createRemoteJWKSet(new URL(config.jwksUrl));
    
    // Verify token
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: config.issuer,
      audience: config.audience,
    });
    
    // Validate required claims
    if (!payload.sub) {
      throw new Error('Missing required claim: sub');
    }
    
    return payload as JWTClaims;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JWT verification failed: ${error.message}`);
    }
    throw new Error('JWT verification failed: Unknown error');
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
    return null;
  }
  
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Discord OAuth2 Authentication Server Functions
 *
 * Server-side functions for Discord OAuth operations that require
 * the client_secret (token revocation, etc.)
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const DISCORD_API_BASE = 'https://discord.com/api/v10'

// ============================================================================
// Schemas
// ============================================================================

const RevokeTokenRequestSchema = z.object({
  token: z.string().min(1),
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
})

const RevokeTokenResponseSchema = z.object({
  success: z.boolean(),
})

export type RevokeTokenRequest = z.infer<typeof RevokeTokenRequestSchema>
export type RevokeTokenResponse = z.infer<typeof RevokeTokenResponseSchema>

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Revoke a Discord OAuth2 access or refresh token
 *
 * This must be done server-side because it requires the DISCORD_CLIENT_SECRET
 * which cannot be exposed in browser code.
 *
 * @see docs/DISCORD_TOKEN_REVOCATION.md
 */
export const revokeDiscordToken = createServerFn({ method: 'POST' })
  .inputValidator((data: RevokeTokenRequest) =>
    RevokeTokenRequestSchema.parse(data),
  )
  .handler(async ({ data }): Promise<RevokeTokenResponse> => {
    // Get client credentials from environment
    const clientId = process.env.VITE_DISCORD_CLIENT_ID
    const clientSecret = process.env.DISCORD_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[Discord Auth] Missing OAuth credentials')
      throw new Error('Server configuration error: Missing Discord credentials')
    }

    // Prepare revocation request
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret, // Server-side only!
      token: data.token,
    })

    if (data.token_type_hint) {
      params.append('token_type_hint', data.token_type_hint)
    }

    // Call Discord's token revocation endpoint
    const response = await fetch(`${DISCORD_API_BASE}/oauth2/token/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Discord Auth] Token revocation failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })

      throw new Error(
        `Token revocation failed: ${response.status} ${response.statusText}`,
      )
    }

    console.log('[Discord Auth] Token revoked successfully')
    return RevokeTokenResponseSchema.parse({ success: true })
  })

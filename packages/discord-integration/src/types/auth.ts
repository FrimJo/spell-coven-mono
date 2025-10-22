import { z } from 'zod';

/**
 * Discord OAuth2 Token Schema (v1.0)
 * Stored in browser localStorage after successful OAuth flow
 */
export const DiscordTokenSchema = z.object({
  version: z.literal('1.0'),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(), // Unix timestamp (ms)
  scopes: z.array(z.string()),
  tokenType: z.literal('Bearer'),
});

export type DiscordToken = z.infer<typeof DiscordTokenSchema>;

/**
 * Discord User Profile Schema (v1.0)
 * Fetched from Discord API after authentication
 */
export const DiscordUserSchema = z.object({
  version: z.literal('1.0'),
  id: z.string().regex(/^\d+$/), // Snowflake ID
  username: z.string().min(1).max(32),
  discriminator: z.string(), // "0" for new usernames, "####" for legacy
  avatar: z.string().nullable(), // Avatar hash or null
  avatarUrl: z.string().url().optional(), // Computed from avatar hash
  bot: z.boolean().optional(),
  system: z.boolean().optional(),
  flags: z.number().int().optional(),
});

export type DiscordUser = z.infer<typeof DiscordUserSchema>;

/**
 * PKCE Challenge for OAuth2 (RFC 7636)
 * Generated client-side for secure authentication
 */
export const PKCEChallengeSchema = z.object({
  codeVerifier: z.string().min(43).max(128), // Random string
  codeChallenge: z.string(), // Base64URL(SHA256(codeVerifier))
  codeChallengeMethod: z.literal('S256'),
});

export type PKCEChallenge = z.infer<typeof PKCEChallengeSchema>;

/**
 * OAuth Error Response
 */
export const OAuthErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

export type OAuthError = z.infer<typeof OAuthErrorSchema>;

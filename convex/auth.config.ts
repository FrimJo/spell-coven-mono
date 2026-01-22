/**
 * Convex Auth Configuration
 *
 * Configures authentication providers for token validation.
 * This file is required for the Convex client to validate auth tokens.
 *
 * @see https://labs.convex.dev/auth/setup
 */

// process.env is available at runtime in Convex
declare const process: { env: Record<string, string | undefined> }

export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
}

/**
 * Playwright Auth Setup
 *
 * Signs in programmatically via Convex Auth Password provider
 * and injects auth tokens into browser localStorage.
 *
 * This avoids Discord OAuth UI (and hCaptcha) for reliable CI/headless e2e runs.
 *
 * Required env vars:
 * - E2E_AUTH_EMAIL: Test user email
 * - E2E_AUTH_PASSWORD: Test user password
 * - VITE_CONVEX_URL: Convex deployment URL
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { test as setup } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnvFile(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, 'utf-8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key) env[key] = valueParts.join('=')
      }
    }
    return env
  } catch {
    return {}
  }
}

// Load env from multiple sources (matching Vite's env loading)
const rootEnv = loadEnvFile(resolve(__dirname, '../../../.env.development'))
const rootEnvLocal = loadEnvFile(
  resolve(__dirname, '../../../.env.development.local'),
)
const appEnv = loadEnvFile(resolve(__dirname, '../.env.development'))
const appEnvLocal = loadEnvFile(resolve(__dirname, '../.env.development.local'))
const testEnv = loadEnvFile(resolve(__dirname, '../.env.test.local'))

// Merge env files (later files override earlier ones)
const env = {
  ...rootEnv,
  ...rootEnvLocal,
  ...appEnv,
  ...appEnvLocal,
  ...testEnv,
}

const STORAGE_DIR = resolve(__dirname, '../.playwright-storage')
const STORAGE_STATE_PATH = resolve(STORAGE_DIR, 'state.json')

/**
 * Compute the localStorage namespace for Convex Auth tokens.
 * Matches the logic in @convex-dev/auth/react: strips non-alphanumerics from URL.
 */
function getConvexAuthNamespace(convexUrl: string): string {
  return convexUrl.replace(/[^a-zA-Z0-9]/g, '')
}

/**
 * Sign in via Convex Auth Password provider.
 * Uses signUp-then-signIn fallback for first run against empty DB.
 */
async function signInWithPassword(
  client: ConvexHttpClient,
  email: string,
  password: string,
): Promise<{ token: string; refreshToken: string }> {
  // Try signIn first
  try {
    const signInResult = await client.action('auth:signIn' as any, {
      provider: 'password',
      params: { email, password, flow: 'signIn' },
    })

    if (signInResult.tokens) {
      return signInResult.tokens
    }
  } catch (error: any) {
    // Account might not exist, try signUp
    console.log('Sign-in failed, attempting sign-up...')
  }

  // Try signUp
  const signUpResult = await client.action('auth:signIn' as any, {
    provider: 'password',
    params: { email, password, flow: 'signUp' },
  })

  if (signUpResult.tokens) {
    return signUpResult.tokens
  }

  // If signUp didn't return tokens directly, try signIn again
  const retryResult = await client.action('auth:signIn' as any, {
    provider: 'password',
    params: { email, password, flow: 'signIn' },
  })

  if (!retryResult.tokens) {
    throw new Error('Failed to obtain auth tokens after signUp')
  }

  return retryResult.tokens
}

setup('authenticate with Convex Password provider', async ({ baseURL }) => {
  const email = env.E2E_AUTH_EMAIL
  const password = env.E2E_AUTH_PASSWORD
  const convexUrl = env.VITE_CONVEX_URL

  if (!email || !password) {
    console.log('⚠️ E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD not found, skipping auth')
    return setup.skip()
  }

  if (!convexUrl) {
    console.log('⚠️ VITE_CONVEX_URL not found, skipping auth')
    return setup.skip()
  }

  console.log('🚀 Authenticating via Convex Password provider...')
  console.log(`   Convex URL: ${convexUrl}`)
  console.log(`   Email: ${email}`)

  // Create Convex HTTP client
  const client = new ConvexHttpClient(convexUrl)

  // Sign in and get tokens
  const { token, refreshToken } = await signInWithPassword(
    client,
    email,
    password,
  )

  console.log('✅ Authentication successful, got tokens')

  // Compute localStorage key namespace
  const namespace = getConvexAuthNamespace(convexUrl)
  const jwtKey = `__convexAuthJWT_${namespace}`
  const refreshTokenKey = `__convexAuthRefreshToken_${namespace}`

  console.log(`   JWT key: ${jwtKey}`)
  console.log(`   Refresh token key: ${refreshTokenKey}`)

  // Build storage state with auth tokens and media preferences
  const appOrigin = new URL(baseURL!).origin
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: appOrigin,
        localStorage: [
          { name: jwtKey, value: token },
          { name: refreshTokenKey, value: refreshToken },
          {
            name: 'mtg-selected-media-devices',
            value: JSON.stringify({
              videoEnabled: false,
              audioEnabled: false,
              videoinput: 'mock-camera-1',
              audioinput: 'mock-mic-1',
            }),
          },
        ],
      },
    ],
  }

  // Write storage state
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true })
  }

  writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2))
  console.log(`💾 Storage state saved to ${STORAGE_STATE_PATH}`)
  console.log('✅ Auth setup complete')
})

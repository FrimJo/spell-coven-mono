import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { ConvexHttpClient } from 'convex/browser'
import z from 'zod'

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

function loadAuthEnv(): {
  email?: string
  password?: string
  convexUrl?: string
} {
  const repoRoot = resolve(__dirname, '../../../../')
  const appRoot = resolve(__dirname, '../../')

  const rootEnv = loadEnvFile(resolve(repoRoot, '.env.development'))
  const rootEnvLocal = loadEnvFile(resolve(repoRoot, '.env.development.local'))
  const rootTestEnv = loadEnvFile(resolve(repoRoot, '.env.test'))
  const rootTestEnvLocal = loadEnvFile(resolve(repoRoot, '.env.test.local'))
  const appEnv = loadEnvFile(resolve(appRoot, '.env.development'))
  const appEnvLocal = loadEnvFile(resolve(appRoot, '.env.development.local'))
  const appTestEnv = loadEnvFile(resolve(appRoot, '.env.test'))
  const testEnv = loadEnvFile(resolve(appRoot, '.env.test.local'))

  const env = {
    ...rootEnv,
    ...rootEnvLocal,
    ...appEnv,
    ...appEnvLocal,
    ...rootTestEnv,
    ...rootTestEnvLocal,
    ...appTestEnv,
    ...testEnv,
    ...process.env,
  }

  return {
    email: env.E2E_AUTH_EMAIL,
    password: env.E2E_AUTH_PASSWORD,
    convexUrl: env.VITE_CONVEX_URL,
  }
}

function getConvexAuthNamespace(convexUrl: string): string {
  return convexUrl.replace(/[^a-zA-Z0-9]/g, '')
}

async function signInWithPassword(
  client: ConvexHttpClient,
  email: string,
  password: string,
): Promise<{ token: string; refreshToken: string }> {
  try {
    const signInResult = await client.action('auth:signIn' as any, {
      provider: 'password',
      params: { email, password, flow: 'signIn' },
    })

    return z
      .object({ token: z.string(), refreshToken: z.string() })
      .parse(signInResult.tokens)
  } catch {
    const signUpResult = await client.action('auth:signIn' as any, {
      provider: 'password',
      params: { email, password, flow: 'signUp' },
    })

    return z
      .object({ token: z.string(), refreshToken: z.string() })
      .parse(signUpResult.tokens)
  }
}

function withWorkerSuffix(email: string, workerIndex: number): string {
  if (email.includes('{worker}')) {
    return email.replace('{worker}', String(workerIndex))
  }

  const atIndex = email.indexOf('@')
  if (atIndex === -1) {
    return `${email}+worker${workerIndex}`
  }

  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex)
  return `${local}+worker${workerIndex}${domain}`
}

export function hasAuthCredentials(): boolean {
  const { email, password, convexUrl } = loadAuthEnv()
  return Boolean(email && password && convexUrl)
}

export async function ensureWorkerStorageState(
  workerIndex: number,
  baseURL: string,
): Promise<string> {
  const storageDir = resolve(__dirname, '../../.playwright-storage')
  const storagePath = resolve(storageDir, `state.worker-${workerIndex}.json`)

  const { email, password, convexUrl } = loadAuthEnv()
  if (!email || !password || !convexUrl) {
    throw new Error(
      'E2E auth env vars missing. Set E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, and VITE_CONVEX_URL.',
    )
  }

  const workerEmail = withWorkerSuffix(email, workerIndex)
  const client = new ConvexHttpClient(convexUrl)

  const { token, refreshToken } = await signInWithPassword(
    client,
    workerEmail,
    password,
  )

  const namespace = getConvexAuthNamespace(convexUrl)
  const jwtKey = `__convexAuthJWT_${namespace}`
  const refreshTokenKey = `__convexAuthRefreshToken_${namespace}`
  const appOrigin = new URL(baseURL).origin

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

  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true })
  }

  writeFileSync(storagePath, JSON.stringify(storageState, null, 2))
  return storagePath
}

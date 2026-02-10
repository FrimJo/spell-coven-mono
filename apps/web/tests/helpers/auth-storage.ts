import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { ConvexHttpClient } from 'convex/browser'
import z from 'zod'

import { buildConvexAuthStorageState } from '../../src/lib/convex-auth-storage'

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
  previewLoginCode?: string
} {
  const repoRoot = resolve(__dirname, '../../../../')
  const appRoot = resolve(__dirname, '../../')

  const rootEnv = loadEnvFile(resolve(repoRoot, '.env.development'))
  const rootEnvLocal = loadEnvFile(resolve(repoRoot, '.env.development.local'))
  const rootTestEnv = loadEnvFile(resolve(repoRoot, '.env.test'))
  const rootGeneratedTestEnv = loadEnvFile(
    resolve(repoRoot, '.env.test.generated'),
  )
  const rootTestEnvLocal = loadEnvFile(resolve(repoRoot, '.env.test.local'))
  const appEnv = loadEnvFile(resolve(appRoot, '.env.development'))
  const appEnvLocal = loadEnvFile(resolve(appRoot, '.env.development.local'))
  const appTestEnv = loadEnvFile(resolve(appRoot, '.env.test'))
  const appGeneratedTestEnv = loadEnvFile(
    resolve(appRoot, '.env.test.generated'),
  )
  const testEnv = loadEnvFile(resolve(appRoot, '.env.test.local'))

  const env = {
    ...rootEnv,
    ...rootEnvLocal,
    ...appEnv,
    ...appEnvLocal,
    ...rootTestEnv,
    ...rootGeneratedTestEnv,
    ...rootTestEnvLocal,
    ...appTestEnv,
    ...appGeneratedTestEnv,
    ...testEnv,
    ...process.env,
  }

  return {
    email: env.E2E_AUTH_EMAIL,
    password: env.E2E_AUTH_PASSWORD,
    convexUrl: env.VITE_CONVEX_URL,
    previewLoginCode: env.PREVIEW_LOGIN_CODE,
  }
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

async function signInWithPreviewCode(params: {
  convexUrl: string
  code: string
  userId?: string
}): Promise<{ token: string; refreshToken: string }> {
  const client = new ConvexHttpClient(params.convexUrl)
  const result = await client.action('auth:previewLogin' as any, {
    code: params.code,
    userId: params.userId,
  })
  return z.object({ token: z.string(), refreshToken: z.string() }).parse(result)
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
  const { email, password, convexUrl, previewLoginCode } = loadAuthEnv()
  const hasPasswordAuth = Boolean(email && password && convexUrl)
  const hasPreviewAuth = Boolean(previewLoginCode && convexUrl)
  return hasPasswordAuth || hasPreviewAuth
}

export async function ensureWorkerStorageState(
  workerIndex: number,
  baseURL: string,
): Promise<string> {
  const storageDir = resolve(__dirname, '../../.playwright-storage')
  const storagePath = resolve(storageDir, `state.worker-${workerIndex}.json`)

  const { email, password, convexUrl, previewLoginCode } = loadAuthEnv()
  if (!convexUrl) {
    throw new Error(
      'E2E auth env vars missing. Set VITE_CONVEX_URL and either PREVIEW_LOGIN_CODE or E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.',
    )
  }

  let tokens: { token: string; refreshToken: string } | null = null
  let previewLoginError: Error | null = null

  if (previewLoginCode != null) {
    try {
      tokens = await signInWithPreviewCode({
        convexUrl,
        code: previewLoginCode,
        userId: `worker-${workerIndex}`,
      })
    } catch (error) {
      previewLoginError =
        error instanceof Error ? error : new Error('Preview login failed')
    }
  }

  if (!tokens) {
    if (email && password) {
      const workerEmail = withWorkerSuffix(email, workerIndex)
      const client = new ConvexHttpClient(convexUrl)
      tokens = await signInWithPassword(client, workerEmail, password)
    } else if (previewLoginError) {
      throw new Error(
        `${previewLoginError.message}\nHint: ensure VITE_CONVEX_URL points to the preview deployment created by \`bun run convex:test\` and that deployment has E2E_TEST=1.`,
      )
    } else {
      throw new Error(
        'Missing PREVIEW_LOGIN_CODE and E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.',
      )
    }
  }

  const appOrigin = new URL(baseURL).origin

  const storageState = buildConvexAuthStorageState({
    appOrigin,
    convexUrl,
    tokens,
    extraLocalStorage: [
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
  })

  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true })
  }

  writeFileSync(storagePath, JSON.stringify(storageState, null, 2))
  return storagePath
}

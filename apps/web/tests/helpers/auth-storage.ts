import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { ConvexHttpClient } from 'convex/browser'

import { buildConvexAuthStorageState } from '../../src/lib/convex-auth-storage'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const AUTH_PREVIEW_LOGIN_ACTION = 'previewLogin:previewLogin'

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
  convexUrl?: string
  previewLoginCode?: string
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
    convexUrl: env.VITE_CONVEX_URL,
    previewLoginCode: env.PREVIEW_LOGIN_CODE,
  }
}

async function signInWithPreviewCode(params: {
  convexUrl: string
  code: string
  workerSlot?: number
}): Promise<{
  token: string
  refreshToken: string
  userId: string
  previewName: string
}> {
  const client = new ConvexHttpClient(params.convexUrl)
  const payload =
    params.workerSlot == null
      ? { code: params.code }
      : { code: params.code, workerSlot: params.workerSlot }

  let result: {
    token: string
    refreshToken: string
    userId: string
    previewName: string
  }
  try {
    result = await client.action(AUTH_PREVIEW_LOGIN_ACTION as any, payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const fieldRejected =
      params.workerSlot != null &&
      message.includes('workerSlot') &&
      (message.includes('extra field') ||
        message.includes('Unexpected field') ||
        message.includes('Object contains extra field'))

    if (!fieldRejected) {
      throw error
    }

    result = await client.action(AUTH_PREVIEW_LOGIN_ACTION as any, {
      code: params.code,
    })
  }

  return {
    token: result.token,
    refreshToken: result.refreshToken,
    userId: result.userId,
    previewName: result.previewName,
  }
}

export function hasAuthCredentials(): boolean {
  const { convexUrl, previewLoginCode } = loadAuthEnv()
  return Boolean(previewLoginCode && convexUrl)
}

export async function ensureWorkerStorageState(
  workerIndex: number,
  baseURL: string,
  options?: {
    assignedUserIds?: Set<string>
    maxUniqueAttempts?: number
  },
): Promise<string> {
  const storageDir = resolve(__dirname, '../../.playwright-storage')
  const storagePath = resolve(storageDir, `state.worker-${workerIndex}.json`)

  const { convexUrl, previewLoginCode } = loadAuthEnv()
  if (!convexUrl) {
    throw new Error(
      'E2E auth env vars missing. Set VITE_CONVEX_URL and PREVIEW_LOGIN_CODE.',
    )
  }

  type AuthTokens = {
    token: string
    refreshToken: string
    previewName?: string
  }
  let tokens: AuthTokens | null = null
  let previewLoginError: Error | null = null

  if (previewLoginCode != null) {
    const assignedUserIds = options?.assignedUserIds
    const maxUniqueAttempts = Math.max(1, options?.maxUniqueAttempts ?? 8)

    for (let attempt = 0; attempt < maxUniqueAttempts; attempt += 1) {
      try {
        const previewResult = await signInWithPreviewCode({
          convexUrl,
          code: previewLoginCode,
          workerSlot: workerIndex + attempt,
        })
        if (assignedUserIds?.has(previewResult.userId)) {
          if (attempt === maxUniqueAttempts - 1) {
            throw new Error(
              `Failed to allocate unique preview user after ${maxUniqueAttempts} attempts (worker ${workerIndex}).`,
            )
          }
          continue
        }

        assignedUserIds?.add(previewResult.userId)
        tokens = {
          token: previewResult.token,
          refreshToken: previewResult.refreshToken,
          previewName: previewResult.previewName,
        }
        previewLoginError = null
        break
      } catch (error) {
        previewLoginError =
          error instanceof Error ? error : new Error('Preview login failed')
        if (attempt === maxUniqueAttempts - 1) {
          break
        }
      }
    }
  }

  if (!tokens && previewLoginCode != null) {
    const message = previewLoginError?.message ?? 'Preview login failed'
    throw new Error(
      `${message}\nHint: ensure PREVIEW_LOGIN_CODE matches the value generated by \`bun run convex:e2e:ui\` and that VITE_CONVEX_URL points to that preview deployment.`,
    )
  }
  if (!tokens) {
    throw new Error('Missing PREVIEW_LOGIN_CODE.')
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

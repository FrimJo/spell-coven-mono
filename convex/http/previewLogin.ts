import z from 'zod'

import { api, internal } from '../_generated/api'
import { httpAction } from '../_generated/server'

const failureStateByIp = new Map<
  string,
  { attempts: number; cooldownUntil: number; lastFailureAt: number }
>()
const MAX_FAILURES = 5
const COOLDOWN_MS = 15_000
const internalApi = internal as any

type SignInTokens = {
  token: string
  refreshToken: string
}

function unauthorizedResponse() {
  return new Response('Unauthorized', { status: 401 })
}

function notFoundResponse() {
  return new Response('Not found', { status: 404 })
}

function badRequestResponse() {
  return new Response('Bad request', { status: 400 })
}

function constantTimeEquals(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length)
  let mismatch = a.length === b.length ? 0 : 1
  for (let i = 0; i < max; i += 1) {
    const left = i < a.length ? a.charCodeAt(i) : 0
    const right = i < b.length ? b.charCodeAt(i) : 0
    mismatch |= left ^ right
  }
  return mismatch === 0
}

function sanitizeHandle(value: string | undefined): string {
  if (!value) return 'qa'
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return normalized.length > 0 ? normalized.slice(0, 32) : 'qa'
}

function buildPreviewEmail(handle: string): string {
  return `preview+${handle}@preview.spell-coven.local`
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) return 'unknown'
  return forwarded.split(',')[0]?.trim() || 'unknown'
}

function inCooldown(ip: string): boolean {
  const entry = failureStateByIp.get(ip)
  return Boolean(entry && entry.cooldownUntil > Date.now())
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const current = failureStateByIp.get(ip)
  const withinWindow =
    current != null && now - current.lastFailureAt <= COOLDOWN_MS
  const attempts = withinWindow ? current.attempts + 1 : 1
  const cooldownUntil = attempts >= MAX_FAILURES ? now + COOLDOWN_MS : 0
  failureStateByIp.set(ip, {
    attempts: cooldownUntil > 0 ? 0 : attempts,
    cooldownUntil,
    lastFailureAt: now,
  })
}

function clearFailureState(ip: string): void {
  failureStateByIp.delete(ip)
}

const tokensSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
})

async function signInOrSignUp(
  ctx: {
    runAction: (ref: any, args: any) => Promise<any>
  },
  email: string,
  password: string,
): Promise<SignInTokens> {
  const signInArgs = {
    provider: 'password',
    params: { email, password, flow: 'signIn' as const },
  }
  const signUpArgs = {
    provider: 'password',
    params: { email, password, flow: 'signUp' as const },
  }

  try {
    const signInResult = await ctx.runAction(api.auth.signIn as any, signInArgs)
    return tokensSchema.parse(signInResult.tokens)
  } catch {
    const signUpResult = await ctx.runAction(api.auth.signIn as any, signUpArgs)
    return tokensSchema.parse(signUpResult.tokens)
  }
}

export const previewLogin = httpAction(async (ctx, request) => {
  if (process.env.E2E_TEST !== '1') {
    return notFoundResponse()
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    })
  }

  const ip = getClientIp(request)
  if (inCooldown(ip)) {
    return unauthorizedResponse()
  }

  const configuredCode = process.env.PREVIEW_LOGIN_CODE
  if (!configuredCode) {
    console.error('[preview-login] Missing PREVIEW_LOGIN_CODE env var')
    return unauthorizedResponse()
  }

  let body: { userId?: string; code?: string } = {}
  const hasJsonContentType = request.headers
    .get('content-type')
    ?.includes('application/json')
  try {
    const parsed = await request.json()
    if (typeof parsed === 'object' && parsed !== null) {
      body = parsed as { userId?: string; code?: string }
    }
  } catch {
    if (hasJsonContentType) {
      return badRequestResponse()
    }
  }

  const requestCode = request.headers.get('x-preview-login') ?? body.code
  if (!requestCode || !constantTimeEquals(requestCode, configuredCode)) {
    recordFailure(ip)
    console.warn('[preview-login] login failure')
    return unauthorizedResponse()
  }

  const requestedUserId = typeof body.userId === 'string' ? body.userId : null
  const fallbackHandle = sanitizeHandle(requestedUserId ?? undefined)
  const fallbackEmail = buildPreviewEmail(fallbackHandle)
  const password = process.env.PREVIEW_LOGIN_PASSWORD ?? configuredCode

  const emailCandidates: string[] = []
  if (requestedUserId) {
    const existingUser = await ctx.runQuery(
      internalApi.previewAuth.getUserById,
      {
        userId: requestedUserId,
      },
    )
    if (existingUser?.email) {
      emailCandidates.push(existingUser.email)
    }
  }
  emailCandidates.push(fallbackEmail)

  let tokens: SignInTokens | null = null
  let chosenEmail: string | null = null

  for (const email of emailCandidates) {
    try {
      tokens = await signInOrSignUp(ctx, email, password)
      chosenEmail = email
      break
    } catch {
      // Try next candidate.
    }
  }

  if (!tokens || !chosenEmail) {
    recordFailure(ip)
    console.warn('[preview-login] login failure')
    return unauthorizedResponse()
  }

  const user = await ctx.runQuery(internalApi.previewAuth.getUserByEmail, {
    email: chosenEmail,
  })
  const userId =
    requestedUserId && user?._id === requestedUserId
      ? requestedUserId
      : user?._id
  if (!userId) {
    console.error(
      '[preview-login] Unable to resolve user after successful auth',
    )
    return badRequestResponse()
  }

  clearFailureState(ip)
  console.info('[preview-login] login success', { userId })

  return Response.json({
    userId,
    token: tokens.token,
    refreshToken: tokens.refreshToken,
  })
})

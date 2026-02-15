import type { GenericActionCtx } from 'convex/server'
import { v } from 'convex/values'
import z from 'zod'

import type { DataModel } from './_generated/dataModel'
import { api, internal } from './_generated/api'
import { action } from './_generated/server'
import { isE2ePreview } from './env'

const previewTokensSchema = z.object({
  tokens: z.object({
    token: z.string(),
    refreshToken: z.string(),
  }),
})

const PREVIEW_NAMES = [
  'Jace',
  'Chandra',
  'Liliana',
  'Gideon',
  'Nissa',
  'Teferi',
  'Ajani',
  'Sorin',
  'Karn',
  'Nahiri',
] as const

/** Constant-time string comparison to avoid timing attacks when comparing secrets (e.g. tokens). */
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

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickRandomPreviewName(): string {
  const index = Math.floor(Math.random() * PREVIEW_NAMES.length)
  return PREVIEW_NAMES[index] ?? PREVIEW_NAMES[0]
}

function pickPreviewNameForSlot(slot: number | undefined): string {
  if (slot == null || !Number.isFinite(slot) || slot < 0) {
    return pickRandomPreviewName()
  }
  const normalizedSlot = Math.floor(slot)
  const index = normalizedSlot % PREVIEW_NAMES.length
  return PREVIEW_NAMES[index] ?? PREVIEW_NAMES[0]
}

function buildPreviewHandle(code: string, baseName: string): string {
  const suffix = hashString(`${code}:${baseName}`)
    .toString(36)
    .padStart(6, '0')
    .slice(0, 6)
  return sanitizeHandle(`${baseName}-${suffix}`)
}

function buildPreviewEmail(handle: string): string {
  return `preview+${handle}@preview.spell-coven.local`
}

async function signInOrSignUp(
  ctx: GenericActionCtx<DataModel>,
  email: string,
  password: string,
) {
  try {
    const signInResult: unknown = await ctx.runAction(api.auth.signIn, {
      provider: 'password',
      params: { email, password, flow: 'signIn' },
    })
    return previewTokensSchema.parse(signInResult).tokens
  } catch {
    const signUpResult: unknown = await ctx.runAction(api.auth.signIn, {
      provider: 'password',
      params: { email, password, flow: 'signUp' },
    })
    return previewTokensSchema.parse(signUpResult).tokens
  }
}

export const previewLogin = action({
  args: {
    code: v.string(),
    workerSlot: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isE2ePreview) {
      throw new Error('Unauthorized')
    }

    // Require server-side secret so we never accept arbitrary client codes.
    const loginCode = z
      .string()
      .min(1, 'PREVIEW_LOGIN_CODE must be set')
      .parse(process.env.PREVIEW_LOGIN_CODE)

    // Reject if the client-provided code doesn't match the server's preview secret.
    if (!constantTimeEquals(args.code, loginCode)) {
      throw new Error('Unauthorized')
    }

    const previewName = pickPreviewNameForSlot(args.workerSlot)
    const fallbackHandle = buildPreviewHandle(loginCode, previewName)
    const fallbackEmail = buildPreviewEmail(fallbackHandle)
    const password = loginCode

    const tokens = await signInOrSignUp(ctx, fallbackEmail, password)

    const user: unknown = await ctx.runQuery(
      internal.previewAuth.getUserByEmail,
      {
        email: fallbackEmail,
      },
    )
    const userId = z.object({ _id: z.string().min(1) }).parse(user)._id

    if (!userId) {
      throw new Error('Unauthorized')
    }

    return {
      ok: true,
      userId,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      previewName,
    }
  },
})

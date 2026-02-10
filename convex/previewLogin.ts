import { v } from 'convex/values'
import z from 'zod'

import { api, internal } from './_generated/api'
import { action } from './_generated/server'

const internalApi = internal as any

const previewTokensSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
})

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

async function signInOrSignUp(
  ctx: {
    runAction: (ref: any, args: any) => Promise<any>
  },
  email: string,
  password: string,
) {
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
    return previewTokensSchema.parse(signInResult.tokens)
  } catch {
    const signUpResult = await ctx.runAction(api.auth.signIn as any, signUpArgs)
    return previewTokensSchema.parse(signUpResult.tokens)
  }
}

export const previewLogin = action({
  args: {
    code: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!z.coerce.boolean().safeParse(process.env.E2E_TEST).success) {
      throw new Error('Unauthorized')
    }

    const configuredCode = process.env.PREVIEW_LOGIN_CODE
    if (!configuredCode) {
      throw new Error('Unauthorized')
    }

    if (!constantTimeEquals(args.code, configuredCode)) {
      throw new Error('Unauthorized')
    }

    const requestedUserId = args.userId ?? null
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

    let tokens: z.infer<typeof previewTokensSchema> | null = null
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
      throw new Error('Unauthorized')
    }

    const user = await ctx.runQuery(internalApi.previewAuth.getUserByEmail, {
      email: chosenEmail,
    })
    const userId =
      requestedUserId && user?._id === requestedUserId
        ? requestedUserId
        : user?._id

    if (!userId) {
      throw new Error('Unauthorized')
    }

    return {
      userId,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
    }
  },
})

import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { captureConvexException, captureConvexMessage } from './sentry'

function assertSentryDebugAllowed() {
  const environment = process.env.SENTRY_ENVIRONMENT ?? 'development'
  if (environment === 'production') {
    throw new Error('Sentry debug trigger is disabled in production')
  }
}

export const triggerSentryError = mutation({
  args: {
    mode: v.optional(v.union(v.literal('message'), v.literal('exception'))),
  },
  handler: async (_ctx, { mode }) => {
    assertSentryDebugAllowed()

    if (mode === 'message') {
      await captureConvexMessage('Convex Sentry debug message', {
        feature: 'debug',
        operation: 'trigger_sentry_message',
      })
      return { ok: true, mode: 'message' as const }
    }

    const error = new Error('Convex Sentry debug exception')
    await captureConvexException(error, {
      feature: 'debug',
      operation: 'trigger_sentry_exception',
    })
    throw error
  },
})

/**
 * Sentry test hooks
 *
 * Use these in development to verify Sentry ingestion.
 */

import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { sentryMutation, isSentryDevelopmentEnvironment } from './sentry'

export const triggerSentryError = mutation(
  sentryMutation(
    'sentry.triggerSentryError',
    {
      args: {
        message: v.optional(v.string()),
      },
      handler: async (_ctx, { message }) => {
        if (!isSentryDevelopmentEnvironment()) {
          throw new Error('Sentry test hook is disabled outside development.')
        }

        throw new Error(message ?? 'Sentry test error from Convex backend.')
      },
    },
    {
      safeArgs: ['message'],
      tags: { domain: 'sentry' },
    },
  ),
)

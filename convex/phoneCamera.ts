import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { AuthRequiredError } from './errors'
import { sentryMutation, sentryQuery } from './sentry'

const pairingTtlMs = 5 * 60 * 1000
const stalePhoneMs = 20_000

const activePairingReturn = v.union(
  v.null(),
  v.object({
    pairingId: v.id('phoneCameraPairings'),
    roomId: v.string(),
    desktopSessionId: v.string(),
    phoneSessionId: v.optional(v.string()),
    status: v.union(
      v.literal('waiting'),
      v.literal('claimed'),
      v.literal('connected'),
      v.literal('disconnected'),
      v.literal('cancelled'),
      v.literal('expired'),
    ),
    expiresAt: v.number(),
    createdAt: v.number(),
    claimedAt: v.optional(v.number()),
    connectedAt: v.optional(v.number()),
    lastHeartbeatAt: v.optional(v.number()),
  }),
)

function publicPairing(pairing: {
  _id: Id<'phoneCameraPairings'>
  roomId: string
  desktopSessionId: string
  phoneSessionId?: string
  status:
    | 'waiting'
    | 'claimed'
    | 'connected'
    | 'disconnected'
    | 'cancelled'
    | 'expired'
  expiresAt: number
  createdAt: number
  claimedAt?: number
  connectedAt?: number
  lastHeartbeatAt?: number
}) {
  return {
    pairingId: pairing._id,
    roomId: pairing.roomId,
    desktopSessionId: pairing.desktopSessionId,
    phoneSessionId: pairing.phoneSessionId,
    status: pairing.status,
    expiresAt: pairing.expiresAt,
    createdAt: pairing.createdAt,
    claimedAt: pairing.claimedAt,
    connectedAt: pairing.connectedAt,
    lastHeartbeatAt: pairing.lastHeartbeatAt,
  }
}

export const getActivePairing = sentryQuery(
  { feature: 'phone_camera', operation: 'get_active_pairing' },
  {
    args: {
      roomId: v.string(),
      desktopSessionId: v.string(),
    },
    returns: activePairingReturn,
    handler: async (ctx, { roomId, desktopSessionId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) {
        return null
      }

      const now = Date.now()
      const pairings = await ctx.db
        .query('phoneCameraPairings')
        .withIndex('by_roomId_desktopSessionId', (q) =>
          q.eq('roomId', roomId).eq('desktopSessionId', desktopSessionId),
        )
        .collect()

      const active = pairings
        .filter(
          (pairing) =>
            pairing.userId === userId &&
            pairing.status !== 'cancelled' &&
            pairing.status !== 'expired' &&
            pairing.expiresAt > now,
        )
        .sort((a, b) => b.createdAt - a.createdAt)[0]

      if (!active) {
        return null
      }

      if (
        active.status === 'connected' &&
        active.lastHeartbeatAt !== undefined &&
        now - active.lastHeartbeatAt > stalePhoneMs
      ) {
        return { ...publicPairing(active), status: 'disconnected' as const }
      }

      return publicPairing(active)
    },
  },
)

export const createPairing = sentryMutation(
  { feature: 'phone_camera', operation: 'create_pairing' },
  {
    args: {
      roomId: v.string(),
      desktopSessionId: v.string(),
      tokenHash: v.string(),
    },
    returns: v.object({
      pairingId: v.id('phoneCameraPairings'),
      expiresAt: v.number(),
    }),
    handler: async (ctx, { roomId, desktopSessionId, tokenHash }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) {
        throw new AuthRequiredError()
      }

      await ctx.runQuery(internal.mediaAuth.getActiveMediaSession, {
        roomId,
        sessionId: desktopSessionId,
        userId,
        now: Date.now(),
      })

      const now = Date.now()
      const existing = await ctx.db
        .query('phoneCameraPairings')
        .withIndex('by_roomId_desktopSessionId', (q) =>
          q.eq('roomId', roomId).eq('desktopSessionId', desktopSessionId),
        )
        .collect()

      await Promise.all(
        existing
          .filter((pairing) =>
            ['waiting', 'claimed', 'connected', 'disconnected'].includes(
              pairing.status,
            ),
          )
          .map((pairing) =>
            ctx.db.patch(pairing._id, { status: 'cancelled' as const }),
          ),
      )

      const pairingId = await ctx.db.insert('phoneCameraPairings', {
        tokenHash,
        roomId,
        userId,
        desktopSessionId,
        status: 'waiting',
        expiresAt: now + pairingTtlMs,
        createdAt: now,
      })

      return {
        pairingId,
        expiresAt: now + pairingTtlMs,
      }
    },
  },
)

export const cancelPairing = sentryMutation(
  { feature: 'phone_camera', operation: 'cancel_pairing' },
  {
    args: {
      pairingId: v.id('phoneCameraPairings'),
      roomId: v.string(),
      desktopSessionId: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, { pairingId, roomId, desktopSessionId }) => {
      const userId = await getAuthUserId(ctx)
      if (!userId) {
        throw new AuthRequiredError()
      }

      const pairing = await ctx.db.get(pairingId)
      if (
        pairing &&
        pairing.userId === userId &&
        pairing.roomId === roomId &&
        pairing.desktopSessionId === desktopSessionId
      ) {
        await ctx.db.patch(pairing._id, { status: 'cancelled' })
      }

      return null
    },
  },
)

export const claimPairing = mutation({
  args: {
    tokenHash: v.string(),
    phoneSessionId: v.string(),
  },
  returns: v.object({
    pairingId: v.id('phoneCameraPairings'),
    roomId: v.string(),
    desktopSessionId: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, { tokenHash, phoneSessionId }) => {
    const pairing = await ctx.db
      .query('phoneCameraPairings')
      .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
      .first()

    const now = Date.now()
    if (!pairing || pairing.status !== 'waiting') {
      throw new Error('Phone camera pairing is invalid or already used.')
    }

    if (pairing.expiresAt <= now) {
      await ctx.db.patch(pairing._id, { status: 'expired' })
      throw new Error('Phone camera pairing has expired.')
    }

    await ctx.db.patch(pairing._id, {
      status: 'claimed',
      phoneSessionId,
      claimedAt: now,
      lastHeartbeatAt: now,
    })

    return {
      pairingId: pairing._id,
      roomId: pairing.roomId,
      desktopSessionId: pairing.desktopSessionId,
      expiresAt: pairing.expiresAt,
    }
  },
})

export const updatePhoneStatus = mutation({
  args: {
    pairingId: v.id('phoneCameraPairings'),
    phoneSessionId: v.string(),
    status: v.union(
      v.literal('connected'),
      v.literal('disconnected'),
      v.literal('cancelled'),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { pairingId, phoneSessionId, status }) => {
    const pairing = await ctx.db.get(pairingId)
    if (!pairing || pairing.phoneSessionId !== phoneSessionId) {
      throw new Error('Phone camera pairing is not active.')
    }

    const now = Date.now()
    await ctx.db.patch(pairing._id, {
      status,
      connectedAt:
        status === 'connected' && pairing.connectedAt === undefined
          ? now
          : pairing.connectedAt,
      lastHeartbeatAt: now,
    })

    return null
  },
})

export const getClaimedPhonePairing = internalQuery({
  args: {
    pairingId: v.id('phoneCameraPairings'),
    phoneSessionId: v.string(),
    now: v.number(),
  },
  returns: v.object({
    pairingId: v.id('phoneCameraPairings'),
    roomId: v.string(),
    userId: v.string(),
    desktopSessionId: v.string(),
  }),
  handler: async (ctx, { pairingId, phoneSessionId, now }) => {
    const pairing = await ctx.db.get(pairingId)
    if (
      !pairing ||
      pairing.phoneSessionId !== phoneSessionId ||
      pairing.expiresAt <= now ||
      pairing.status === 'cancelled' ||
      pairing.status === 'expired'
    ) {
      throw new Error('Phone camera pairing is not active.')
    }

    return {
      pairingId: pairing._id,
      roomId: pairing.roomId,
      userId: pairing.userId,
      desktopSessionId: pairing.desktopSessionId,
    }
  },
})

export const markExpiredPairings = internalMutation({
  args: { now: v.number() },
  returns: v.null(),
  handler: async (ctx, { now }) => {
    const pairings = await ctx.db.query('phoneCameraPairings').collect()
    await Promise.all(
      pairings
        .filter(
          (pairing) =>
            pairing.expiresAt <= now &&
            pairing.status !== 'expired' &&
            pairing.status !== 'cancelled',
        )
        .map((pairing) =>
          ctx.db.patch(pairing._id, { status: 'expired' as const }),
        ),
    )
    return null
  },
})

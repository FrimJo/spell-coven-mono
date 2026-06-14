import { addAppBreadcrumb, startAppSpan } from '@/integrations/sentry/reporting'
import { api } from '@convex/_generated/api'

import { convex } from '../integrations/convex/provider.js'

interface CreateRoomResult {
  roomId: string | null
  waitMs: number | null
}

type CreateRoomMutation = (args: {
  ownerId: string
}) => Promise<CreateRoomResult>

export async function createRoomWithObservability(
  createRoom: CreateRoomMutation,
  ownerId: string,
): Promise<CreateRoomResult> {
  let result = await startAppSpan(
    { name: 'Create room', op: 'convex.mutation' },
    () => createRoom({ ownerId }),
  )

  while (result.roomId == null && result.waitMs != null) {
    const awaitMs = result.waitMs
    addAppBreadcrumb('room', 'Create room throttled', { waitMs: awaitMs })
    console.log(`[LandingPage] Throttled, waiting ${awaitMs}ms before retry...`)
    await new Promise((resolve) => setTimeout(resolve, awaitMs))
    result = await startAppSpan(
      { name: 'Create room retry', op: 'convex.mutation' },
      () => createRoom({ ownerId }),
    )
  }

  return result
}

export async function checkRoomAccessWithObservability(roomId: string) {
  const result = await startAppSpan(
    { name: 'Check room access', op: 'convex.query' },
    () =>
      convex.query(api.rooms.checkRoomAccess, {
        roomId,
      }),
  )

  if (result.status === 'not_found') {
    addAppBreadcrumb('room', 'Join room failed: not found')
  } else if (result.status === 'full') {
    addAppBreadcrumb('room', 'Join room failed: full', {
      currentCount: result.currentCount,
      maxCount: result.maxCount,
    })
  } else if (result.status === 'banned') {
    addAppBreadcrumb('room', 'Join room failed: banned')
  }

  return result
}

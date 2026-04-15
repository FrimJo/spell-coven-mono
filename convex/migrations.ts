// convex/migrations.ts
import { mutation } from './_generated/server'

export const backfillRoomPlayersMediaFlags = mutation({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db.query('roomPlayers').collect()

    let updated = 0

    for (const player of players) {
      const patch: { audioEnabled?: boolean; videoEnabled?: boolean } = {}

      if (player.audioEnabled === undefined) {
        patch.audioEnabled = true
      }

      if (player.videoEnabled === undefined) {
        patch.videoEnabled = true
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(player._id, patch)
        updated += 1
      }
    }

    return { updated }
  },
})

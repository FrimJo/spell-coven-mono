/**
 * WebRTC 4-player toggle matrix test.
 *
 * For each of the 4 players (sender), toggle camera and mic on/off and
 * assert that ALL other 3 players (receivers) observe the correct state
 * transition. This is a full NxN observation matrix.
 *
 * Flow:
 *   1. Bootstrap a stable 4-player room (shared harness).
 *   2. Verify baseline: all players see all remotes with video + audio.
 *   3. For each sender:
 *      a. Toggle camera OFF  → assert all receivers see video-off.
 *      b. Toggle camera ON   → assert all receivers see video rendering.
 *      c. Toggle mic OFF     → assert all receivers hear silence.
 *      d. Toggle mic ON      → assert all receivers hear audio.
 */

import { test } from '@playwright/test'

import type { RoomHarness } from '../../helpers/room-harness'
import type { PlayerInfo } from '../../helpers/toggle-assertions'
import { hasAuthCredentials } from '../../helpers/auth-storage'
import {
  assertAllPlayersMediaHealthy,
  PLAYER_LABELS,
  setupStableRoom,
} from '../../helpers/room-harness'
import {
  assertAudioOffOnAllReceivers,
  assertAudioOnOnAllReceivers,
  assertVideoOffOnAllReceivers,
  assertVideoOnOnAllReceivers,
  clickAudioToggle,
  clickVideoToggle,
  resolvePlayerIds,
} from '../../helpers/toggle-assertions'

test.describe('WebRTC 4-player toggle matrix', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature
  test('camera and mic toggles propagate to all receivers', async ({}, testInfo) => {
    test.setTimeout(600_000)

    if (!hasAuthCredentials()) {
      test.skip(
        true,
        'E2E auth env vars missing. Set VITE_CONVEX_URL and PREVIEW_LOGIN_CODE.',
      )
    }

    const baseURL = testInfo.project.use.baseURL as string | undefined
    if (!baseURL) {
      throw new Error('Playwright baseURL is not configured.')
    }

    let harness: RoomHarness | undefined
    try {
      // --- Phase 1: Bootstrap stable room ---
      harness = await setupStableRoom({ baseURL, testInfo })

      // --- Phase 2: Verify baseline media health ---
      console.log('[ToggleMatrix] Verifying baseline media health...')
      await assertAllPlayersMediaHealthy(harness, testInfo)
      console.log('[ToggleMatrix] Baseline verified. All streams healthy.')

      // --- Phase 3: Resolve player IDs ---
      const pages = harness.players.map((p) => p.page)
      const playerIds = await resolvePlayerIds(pages, PLAYER_LABELS)
      const allPlayers: PlayerInfo[] = harness.players.map((p, i) => ({
        page: p.page,
        label: PLAYER_LABELS[i]!,
        playerId: playerIds[i]!,
      }))

      console.log(
        '[ToggleMatrix] Player IDs resolved:',
        allPlayers.map((p) => `${p.label}=${p.playerId}`).join(', '),
      )

      // --- Phase 4: NxN toggle matrix ---
      for (let senderIdx = 0; senderIdx < allPlayers.length; senderIdx++) {
        const sender = allPlayers[senderIdx]!

        // ---- Camera OFF ----
        console.log(`[ToggleMatrix] ${sender.label}: toggling camera OFF`)
        await clickVideoToggle(sender.page)
        await assertVideoOffOnAllReceivers(sender, allPlayers)
        console.log(
          `[ToggleMatrix] ${sender.label}: camera OFF confirmed by all receivers`,
        )

        // ---- Camera ON ----
        console.log(`[ToggleMatrix] ${sender.label}: toggling camera ON`)
        await clickVideoToggle(sender.page)
        await assertVideoOnOnAllReceivers(sender, allPlayers)
        console.log(
          `[ToggleMatrix] ${sender.label}: camera ON confirmed by all receivers`,
        )

        // ---- Mic OFF ----
        console.log(`[ToggleMatrix] ${sender.label}: toggling mic OFF`)
        await clickAudioToggle(sender.page)
        await assertAudioOffOnAllReceivers(sender, allPlayers)
        console.log(
          `[ToggleMatrix] ${sender.label}: mic OFF confirmed by all receivers`,
        )

        // ---- Mic ON ----
        console.log(`[ToggleMatrix] ${sender.label}: toggling mic ON`)
        await clickAudioToggle(sender.page)
        await assertAudioOnOnAllReceivers(sender, allPlayers)
        console.log(
          `[ToggleMatrix] ${sender.label}: mic ON confirmed by all receivers`,
        )
      }

      console.log('[ToggleMatrix] Full NxN toggle matrix passed.')
    } catch (error) {
      if (harness) {
        await harness.attachFailureDiagnostics(error, testInfo)
      }
      throw error
    } finally {
      await harness?.teardown()
    }
  })
})

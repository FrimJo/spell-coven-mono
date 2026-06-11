/**
 * Sender-targeted toggle assertion helpers for LiveKit media E2E tests.
 *
 * These functions wait for a specific sender's state transition to propagate
 * to a specific receiver's UI, with bounded retry windows and actionable
 * error messages.
 */

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import {
  expectAudioEnergy,
  expectAudioSilent,
  expectVideoRendering,
} from './media-assertions'

const TOGGLE_PROPAGATION_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 500

type PollUntilOptions<T> = {
  timeoutMs?: number
  intervalMs?: number
  getState: () => Promise<T>
  isReady: (state: T) => boolean | Promise<boolean>
}

async function pollUntil<T>({
  timeoutMs = TOGGLE_PROPAGATION_TIMEOUT_MS,
  intervalMs = POLL_INTERVAL_MS,
  getState,
  isReady,
}: PollUntilOptions<T>): Promise<
  { ready: true; state: T } | { ready: false; state: T }
> {
  const start = Date.now()
  let lastState = await getState()

  while (Date.now() - start < timeoutMs) {
    lastState = await getState()
    if (await isReady(lastState)) {
      return { ready: true, state: lastState }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  return { ready: false, state: lastState }
}

/**
 * Build the CSS selector for a specific sender's remote player card on
 * the receiver's page.
 */
export function senderCardSelector(senderPlayerId: string): string {
  return `[data-testid="remote-player-card"][data-player-id="${senderPlayerId}"]`
}

export function senderVideoSelector(senderPlayerId: string): string {
  return `${senderCardSelector(senderPlayerId)} [data-testid="remote-player-video"]`
}

export function senderAudioSelector(senderPlayerId: string): string {
  return `${senderCardSelector(senderPlayerId)} [data-testid="remote-player-audio"]`
}

async function expectSenderCardConnected(
  receiverPage: Page,
  senderPlayerId: string,
  context: string,
): Promise<void> {
  const card = receiverPage.locator(senderCardSelector(senderPlayerId))
  await expect(
    card.locator('[data-testid="remote-player-offline-warning"]'),
    `${context}: sender ${senderPlayerId} should not show offline warning`,
  ).toHaveCount(0)
  await expect(
    card,
    `${context}: sender ${senderPlayerId} should be LiveKit connected`,
  ).toHaveAttribute('data-livekit-connection-state', 'connected')
}

// ---------------------------------------------------------------------------
// Video toggle assertions
// ---------------------------------------------------------------------------

/**
 * After sender disables camera, assert that receiver sees the video-off
 * placeholder for that sender's card, and no active `<video>` element.
 */
export async function expectSenderVideoOff(
  receiverPage: Page,
  senderPlayerId: string,
  context: string,
  timeoutMs = TOGGLE_PROPAGATION_TIMEOUT_MS,
): Promise<void> {
  const cardSel = senderCardSelector(senderPlayerId)
  const card = receiverPage.locator(cardSel)

  await expect(card).toBeVisible({ timeout: timeoutMs })
  await expectSenderCardConnected(receiverPage, senderPlayerId, context)

  const result = await pollUntil({
    timeoutMs,
    getState: () =>
      receiverPage.evaluate((sel) => {
        const card = document.querySelector(sel)
        if (!card) return { found: false as const }
        return {
          found: true as const,
          hasVideoOff: !!card.querySelector(
            '[data-testid="remote-player-video-off"]',
          ),
          hasVideo: !!card.querySelector('[data-testid="remote-player-video"]'),
        }
      }, cardSel),
    isReady: (state) => state.found && state.hasVideoOff && !state.hasVideo,
  })

  if (result.ready) {
    return
  }

  throw new Error(
    `${context}: sender ${senderPlayerId} video-off not observed within ${timeoutMs}ms. Final state: ${JSON.stringify(result.state)}`,
  )
}

/**
 * After sender enables camera, assert that receiver sees an active
 * `<video>` element with changing frames for that sender's card.
 */
export async function expectSenderVideoOn(
  receiverPage: Page,
  senderPlayerId: string,
  context: string,
  timeoutMs = TOGGLE_PROPAGATION_TIMEOUT_MS,
): Promise<void> {
  const cardSel = senderCardSelector(senderPlayerId)
  const videoSel = senderVideoSelector(senderPlayerId)
  const card = receiverPage.locator(cardSel)

  await expect(card).toBeVisible({ timeout: timeoutMs })

  const result = await pollUntil({
    timeoutMs,
    getState: () =>
      receiverPage.evaluate((sel) => !!document.querySelector(sel), videoSel),
    isReady: async (hasVideo) => {
      if (!hasVideo) return false
      await expectVideoRendering(receiverPage, videoSel)
      return true
    },
  })

  if (result.ready) {
    return
  }

  throw new Error(
    `${context}: sender ${senderPlayerId} video element not found within ${timeoutMs}ms`,
  )
}

// ---------------------------------------------------------------------------
// Audio toggle assertions
// ---------------------------------------------------------------------------

/**
 * After sender mutes mic, assert that receiver hears silence from that
 * sender's media element.
 *
 * LiveKit renders audio and video tracks as separate media elements. When the
 * sender mutes, the remote audio element may either disappear or remain silent.
 */
export async function expectSenderAudioOff(
  receiverPage: Page,
  senderPlayerId: string,
  context: string,
  timeoutMs = TOGGLE_PROPAGATION_TIMEOUT_MS,
): Promise<void> {
  await expectSenderCardConnected(receiverPage, senderPlayerId, context)
  const audioSel = senderAudioSelector(senderPlayerId)

  const result = await pollUntil({
    timeoutMs,
    getState: () =>
      receiverPage.evaluate((sel) => !!document.querySelector(sel), audioSel),
    isReady: async (hasAudio) => {
      if (!hasAudio) return true
      try {
        await expectAudioSilent(receiverPage, audioSel, 0.005)
        return true
      } catch {
        return false
      }
    },
  })

  if (result.ready) {
    return
  }

  throw new Error(
    `${context}: sender ${senderPlayerId} audio did not become silent within ${timeoutMs}ms`,
  )
}

/**
 * After sender unmutes mic, assert that receiver hears audio energy from
 * that sender's media element.
 */
export async function expectSenderAudioOn(
  receiverPage: Page,
  senderPlayerId: string,
  context: string,
  timeoutMs = TOGGLE_PROPAGATION_TIMEOUT_MS,
): Promise<void> {
  const audioSel = senderAudioSelector(senderPlayerId)

  const result = await pollUntil({
    timeoutMs,
    getState: () =>
      receiverPage.evaluate((sel) => !!document.querySelector(sel), audioSel),
    isReady: async (hasAudio) => {
      if (!hasAudio) return false
      try {
        await expectAudioEnergy(receiverPage, audioSel)
        return true
      } catch {
        return false
      }
    },
  })

  if (result.ready) {
    return
  }

  throw new Error(
    `${context}: sender ${senderPlayerId} audio energy not detected within ${timeoutMs}ms`,
  )
}

// ---------------------------------------------------------------------------
// Convenience: click video / audio toggle on a player's page
// ---------------------------------------------------------------------------

export async function clickVideoToggle(page: Page): Promise<void> {
  const btn = page.getByTestId('video-toggle-button')
  await expect(btn).toBeVisible({ timeout: 10_000 })
  await expect(btn).toBeEnabled({ timeout: 10_000 })
  await btn.click()
  // Brief settle time for LiveKit publication updates to reach receivers.
  await new Promise((r) => setTimeout(r, 2_000))
}

export async function clickAudioToggle(page: Page): Promise<void> {
  const btn = page.getByTestId('audio-toggle-button')
  await expect(btn).toBeVisible({ timeout: 10_000 })
  await expect(btn).toBeEnabled({ timeout: 10_000 })
  await btn.click()
  await new Promise((r) => setTimeout(r, 2_000))
}

// ---------------------------------------------------------------------------
// Compound: assert sender toggle effect on ALL receivers
// ---------------------------------------------------------------------------

export type PlayerInfo = {
  page: Page
  label: string
  playerId: string
}

/**
 * Resolve app player IDs for all players.
 *
 * Prefer the stable remote-card DOM contract: receivers render the sender's
 * Convex user id in `data-player-id` and display name in `data-player-name`.
 * Fall back to Convex auth storage only for diagnostics; Convex stores raw JWT
 * values under `__convexAuthJWT_*`, not JSON objects.
 */
export async function resolvePlayerIds(
  pages: Page[],
  labels: readonly string[],
): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!
    const label = labels[i]!
    const idsSeenByReceivers = await Promise.all(
      pages
        .filter((_, pageIndex) => pageIndex !== i)
        .map((receiverPage) =>
          receiverPage.evaluate((senderLabel) => {
            const cards = Array.from(
              document.querySelectorAll('[data-testid="remote-player-card"]'),
            )
            const senderCard = cards.find(
              (card) => card.getAttribute('data-player-name') === senderLabel,
            )
            return senderCard?.getAttribute('data-player-id') ?? null
          }, label),
        ),
    )
    const uniqueReceiverIds = Array.from(
      new Set(idsSeenByReceivers.filter((id): id is string => Boolean(id))),
    )
    if (uniqueReceiverIds.length === 1) {
      ids.push(uniqueReceiverIds[0]!)
      continue
    }

    const playerId = await page.evaluate(() => {
      const parseJwtSubject = (token: string): string | null => {
        const [, payload] = token.split('.')
        if (!payload) return null
        try {
          const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
          const padded = normalized.padEnd(
            normalized.length + ((4 - (normalized.length % 4)) % 4),
            '=',
          )
          const decoded = JSON.parse(atob(padded)) as { sub?: unknown }
          return typeof decoded.sub === 'string' ? decoded.sub : null
        } catch {
          return null
        }
      }

      for (let j = 0; j < localStorage.length; j++) {
        const key = localStorage.key(j)
        if (key && key.startsWith('__convexAuth')) {
          const stored = localStorage.getItem(key)
          if (!stored) continue

          try {
            const value = JSON.parse(stored) as {
              token?: unknown
              jwt?: unknown
            }
            if (value.token || value.jwt) {
              const token = value.token || value.jwt
              if (typeof token === 'string') {
                const subject = parseJwtSubject(token)
                if (subject) return subject
              }
            }
          } catch {
            const subject = parseJwtSubject(stored)
            if (subject) return subject
          }
        }
      }
      return null
    })

    if (!playerId) {
      throw new Error(
        `Could not resolve player ID for ${label}. Receiver ids: ${JSON.stringify(idsSeenByReceivers)}`,
      )
    }
    ids.push(playerId)
  }
  return ids
}

/**
 * Assert that after sender toggles camera OFF, ALL other players see
 * the video-off state for that sender.
 */
export async function assertVideoOffOnAllReceivers(
  sender: PlayerInfo,
  allPlayers: PlayerInfo[],
): Promise<void> {
  const receivers = allPlayers.filter((p) => p.playerId !== sender.playerId)
  await Promise.all(
    receivers.map((receiver) =>
      expectSenderVideoOff(
        receiver.page,
        sender.playerId,
        `${receiver.label} observing ${sender.label}`,
      ),
    ),
  )
}

/**
 * Assert that after sender toggles camera ON, ALL other players see
 * active video for that sender.
 */
export async function assertVideoOnOnAllReceivers(
  sender: PlayerInfo,
  allPlayers: PlayerInfo[],
): Promise<void> {
  const receivers = allPlayers.filter((p) => p.playerId !== sender.playerId)
  await Promise.all(
    receivers.map((receiver) =>
      expectSenderVideoOn(
        receiver.page,
        sender.playerId,
        `${receiver.label} observing ${sender.label}`,
      ),
    ),
  )
}

/**
 * Assert that after sender mutes mic, ALL other players hear silence.
 */
export async function assertAudioOffOnAllReceivers(
  sender: PlayerInfo,
  allPlayers: PlayerInfo[],
): Promise<void> {
  const receivers = allPlayers.filter((p) => p.playerId !== sender.playerId)
  await Promise.all(
    receivers.map((receiver) =>
      expectSenderAudioOff(
        receiver.page,
        sender.playerId,
        `${receiver.label} observing ${sender.label}`,
      ),
    ),
  )
}

/**
 * Assert that after sender unmutes mic, ALL other players hear audio.
 */
export async function assertAudioOnOnAllReceivers(
  sender: PlayerInfo,
  allPlayers: PlayerInfo[],
): Promise<void> {
  const receivers = allPlayers.filter((p) => p.playerId !== sender.playerId)
  await Promise.all(
    receivers.map((receiver) =>
      expectSenderAudioOn(
        receiver.page,
        sender.playerId,
        `${receiver.label} observing ${sender.label}`,
      ),
    ),
  )
}

/**
 * Sender-targeted toggle assertion helpers for WebRTC E2E tests.
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

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const state = await receiverPage.evaluate((sel) => {
      const card = document.querySelector(sel)
      if (!card) return null
      return {
        hasVideoOff: !!card.querySelector(
          '[data-testid="remote-player-video-off"]',
        ),
        hasVideo: !!card.querySelector('[data-testid="remote-player-video"]'),
      }
    }, cardSel)
    if (state?.hasVideoOff && !state.hasVideo) return
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  const finalState = await receiverPage.evaluate((sel) => {
    const card = document.querySelector(sel)
    if (!card) return { found: false }
    return {
      found: true,
      hasVideoOff: !!card.querySelector(
        '[data-testid="remote-player-video-off"]',
      ),
      hasVideo: !!card.querySelector('[data-testid="remote-player-video"]'),
    }
  }, cardSel)

  throw new Error(
    `${context}: sender ${senderPlayerId} video-off not observed within ${timeoutMs}ms. Final state: ${JSON.stringify(finalState)}`,
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

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const hasVideo = await receiverPage.evaluate(
      (sel) => !!document.querySelector(sel),
      videoSel,
    )
    if (hasVideo) {
      await expectVideoRendering(receiverPage, videoSel)
      return
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
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
 * Audio silence detection uses the same `<video>` element as the stream
 * source because remote audio+video share the same `srcObject`.
 * When the sender's video is OFF there is no `<video>` element to probe,
 * so we treat that case as "silent by definition" (no media element = no
 * audio output).
 */
export async function expectSenderAudioOff(
  receiverPage: Page,
  senderPlayerId: string,
  context: string,
  timeoutMs = TOGGLE_PROPAGATION_TIMEOUT_MS,
): Promise<void> {
  const videoSel = senderVideoSelector(senderPlayerId)

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const hasVideo = await receiverPage.evaluate(
      (sel) => !!document.querySelector(sel),
      videoSel,
    )
    if (!hasVideo) {
      // No video element means the stream has no audio output either.
      return
    }

    try {
      await expectAudioSilent(receiverPage, videoSel, 0.005)
      return
    } catch {
      // Audio is still audible; keep polling.
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
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
  const videoSel = senderVideoSelector(senderPlayerId)

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const hasVideo = await receiverPage.evaluate(
      (sel) => !!document.querySelector(sel),
      videoSel,
    )
    if (!hasVideo) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      continue
    }

    try {
      await expectAudioEnergy(receiverPage, videoSel)
      return
    } catch {
      // Audio not yet audible; keep polling.
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
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
  await btn.click()
  // Brief settle time for track replacement to propagate through WebRTC
  await new Promise((r) => setTimeout(r, 2_000))
}

export async function clickAudioToggle(page: Page): Promise<void> {
  const btn = page.getByTestId('audio-toggle-button')
  await expect(btn).toBeVisible({ timeout: 10_000 })
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
 * Resolve player IDs for all players via the DOM.
 * Each player's own ID is stored in a `data-player-id` attribute on the
 * local video card or can be derived from the remote cards other players see.
 * We use the auth userId which is the Convex user ID that the app uses
 * as the player ID in remote cards.
 */
export async function resolvePlayerIds(
  pages: Page[],
  labels: readonly string[],
): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!
    // The remote cards that OTHER players see for this player contain the
    // data-player-id. We can get the local player's ID from
    // the page's Convex auth state.
    const playerId = await page.evaluate(() => {
      // Look for a meta tag or data attribute with the local user ID.
      // Fallback: parse the Convex auth storage for the user ID.
      for (let j = 0; j < localStorage.length; j++) {
        const key = localStorage.key(j)
        if (key && key.startsWith('__convexAuth')) {
          try {
            const value = JSON.parse(localStorage.getItem(key) ?? '{}')
            // The JWT token contains the user ID in the subject claim
            if (value.token || value.jwt) {
              const token = value.token || value.jwt
              const payload = JSON.parse(atob(token.split('.')[1]))
              if (payload.sub) return payload.sub as string
            }
          } catch {
            // continue
          }
        }
      }
      return null
    })

    if (!playerId) {
      throw new Error(`Could not resolve player ID for ${labels[i]} from page`)
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

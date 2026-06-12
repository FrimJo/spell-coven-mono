import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

type MediaTrackDiagnostic = {
  id: string
  kind: string
  label: string
  enabled: boolean
  muted: boolean
  readyState: string
}

type MediaElementDiagnostic = {
  tagName: string
  index: number
  id: string
  className: string
  connected: boolean
  visible: boolean
  readyState: number
  networkState: number
  currentTime: number
  paused: boolean
  ended: boolean
  muted: boolean
  defaultMuted: boolean
  volume: number
  playbackRate: number
  autoplay: boolean
  videoWidth: number
  videoHeight: number
  srcObjectPresent: boolean
  srcObjectActive: boolean | null
  audioTrackCount: number
  videoTrackCount: number
  audioTracks: MediaTrackDiagnostic[]
  videoTracks: MediaTrackDiagnostic[]
}

function formatDiagnostics(details: unknown): string {
  return JSON.stringify(details, null, 2)
}

export async function collectMediaDiagnostics(
  page: Page,
  selector = 'video',
): Promise<{
  selector: string
  selectedCount: number
  allMediaCount: number
  diagnostics: MediaElementDiagnostic[]
}> {
  return await page.evaluate((targetSelector) => {
    const mediaElements = Array.from(
      document.querySelectorAll('video, audio'),
    ) as HTMLMediaElement[]

    const toTrackDiagnostics = (tracks: MediaStreamTrack[]) =>
      tracks.map((track) => ({
        id: track.id,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      }))

    const diagnostics = mediaElements.map((media, index) => {
      const rect = media.getBoundingClientRect()
      const stream = media.srcObject as MediaStream | null
      const audioTracks = stream ? stream.getAudioTracks() : []
      const videoTracks = stream ? stream.getVideoTracks() : []
      const video = media instanceof HTMLVideoElement ? media : null

      return {
        tagName: media.tagName.toLowerCase(),
        index,
        id: media.id,
        className: media.className,
        connected: media.isConnected,
        visible: rect.width > 0 && rect.height > 0,
        readyState: media.readyState,
        networkState: media.networkState,
        currentTime: media.currentTime,
        paused: media.paused,
        ended: media.ended,
        muted: media.muted,
        defaultMuted: media.defaultMuted,
        volume: media.volume,
        playbackRate: media.playbackRate,
        autoplay: media.autoplay,
        videoWidth: video ? video.videoWidth : 0,
        videoHeight: video ? video.videoHeight : 0,
        srcObjectPresent: Boolean(stream),
        srcObjectActive: stream ? stream.active : null,
        audioTrackCount: audioTracks.length,
        videoTrackCount: videoTracks.length,
        audioTracks: toTrackDiagnostics(audioTracks),
        videoTracks: toTrackDiagnostics(videoTracks),
      }
    })

    return {
      selector: targetSelector,
      selectedCount: diagnostics.filter((entry) => {
        const el = mediaElements[entry.index]
        return el ? el.matches(targetSelector) : false
      }).length,
      allMediaCount: diagnostics.length,
      diagnostics,
    }
  }, selector)
}

type VideoFrameStabilityMode = 'changing' | 'frozen'

type VideoFrameStabilityOptions = {
  waitForFrames?: boolean
  intervalMs?: number
}

async function evaluateVideoFrameStability(
  page: Page,
  videoSelector: string,
  mode: VideoFrameStabilityMode,
  options: VideoFrameStabilityOptions = {},
) {
  const {
    waitForFrames = false,
    intervalMs = mode === 'changing' ? 250 : 400,
  } = options

  return page.evaluate(
    async ({ selector, mode, waitForFrames, intervalMs }) => {
      const video = document.querySelector(selector) as HTMLVideoElement | null
      if (!video) return { ok: false, reason: 'no-video-element' }

      if (waitForFrames) {
        const start = performance.now()
        while (performance.now() - start < 8000) {
          if (video.readyState >= 3 && video.videoWidth > 0) break
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        if (!(video.readyState >= 3 && video.videoWidth > 0)) {
          return { ok: false, reason: 'no-frames' }
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.min(320, video.videoWidth || 320)
      canvas.height = Math.min(180, video.videoHeight || 180)
      const ctx = canvas.getContext('2d')
      if (!ctx) return { ok: false, reason: 'no-canvas-context' }

      const frameHash = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let sum = 0
        for (let i = 0; i < data.length; i += 97) {
          sum = (sum + (data[i] ?? 0)) | 0
        }
        return sum
      }

      const h1 = frameHash()
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const h2 = frameHash()
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const h3 = frameHash()

      const changing = h1 !== h2 || h2 !== h3
      const frozen = h1 === h2 && h2 === h3
      const ok = mode === 'changing' ? changing : frozen
      const reason =
        mode === 'changing'
          ? changing
            ? 'ok'
            : 'frozen'
          : frozen
            ? 'ok'
            : 'changing'

      return { ok, reason }
    },
    { selector: videoSelector, mode, waitForFrames, intervalMs },
  )
}

export async function expectVideoRendering(
  page: Page,
  videoSelector: string,
): Promise<void> {
  const result = await evaluateVideoFrameStability(
    page,
    videoSelector,
    'changing',
    { waitForFrames: true },
  )

  expect(result.ok, `video check failed: ${result.reason}`).toBeTruthy()
}

export async function expectVideoFrozen(
  page: Page,
  videoSelector: string,
): Promise<void> {
  const result = await evaluateVideoFrameStability(
    page,
    videoSelector,
    'frozen',
  )

  expect(result.ok, `video freeze check failed: ${result.reason}`).toBeTruthy()
}

type AudioRmsMode = 'energy' | 'silent'

type AudioRmsSampleOptions = {
  samples?: number
  waitForReady?: boolean
  includeDiagnostics?: boolean
}

type AudioRmsSampleResult = {
  ok: boolean
  reason: string
  maxRms: number
  details?: unknown
}

async function sampleAudioRms(
  page: Page,
  mediaSelector: string,
  mode: AudioRmsMode,
  threshold: number,
  options: AudioRmsSampleOptions = {},
): Promise<AudioRmsSampleResult> {
  const {
    samples = mode === 'energy' ? 30 : 10,
    waitForReady = mode === 'energy',
    includeDiagnostics = mode === 'energy',
  } = options

  return page.evaluate(
    async ({
      selector,
      mode,
      threshold,
      samples,
      waitForReady,
      includeDiagnostics,
    }) => {
      const element = document.querySelector(
        selector,
      ) as HTMLMediaElement | null
      if (!element) {
        return {
          ok: false,
          reason: 'no-media-element',
          maxRms: 0,
          ...(includeDiagnostics ? { details: { selector } } : {}),
        }
      }

      const describeStream = (stream: MediaStream | null) => {
        if (!stream) return null
        const describeTrack = (track: MediaStreamTrack) => ({
          id: track.id,
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })

        return {
          id: stream.id,
          active: stream.active,
          audioTracks: stream.getAudioTracks().map(describeTrack),
          videoTracks: stream.getVideoTracks().map(describeTrack),
        }
      }

      if (waitForReady) {
        try {
          await element.play()
        } catch {
          // Autoplay might be blocked; continue to probe audio anyway.
        }
      }

      const AudioContextConstructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!AudioContextConstructor) {
        return {
          ok: false,
          reason: 'no-audio-context',
          maxRms: 0,
          ...(includeDiagnostics
            ? {
                details: {
                  element: {
                    readyState: element.readyState,
                    muted: element.muted,
                    paused: element.paused,
                  },
                },
              }
            : {}),
        }
      }

      const ctx = new AudioContextConstructor()
      if (waitForReady && ctx.state === 'suspended') {
        try {
          await ctx.resume()
        } catch {
          // Continue and attempt to sample anyway.
        }
      }

      if (
        waitForReady &&
        element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        const start = performance.now()
        while (performance.now() - start < 8000) {
          if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) break
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      const stream = element.srcObject as MediaStream | null
      if (waitForReady && stream) {
        const start = performance.now()
        while (performance.now() - start < 8000) {
          const hasLiveAudioTrack = stream
            .getAudioTracks()
            .some((track) => track.readyState === 'live' && !track.muted)
          if (hasLiveAudioTrack) break
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      if (
        waitForReady &&
        element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return {
          ok: false,
          reason: 'media-not-ready',
          maxRms: 0,
          ...(includeDiagnostics
            ? {
                details: {
                  element: {
                    readyState: element.readyState,
                    networkState: element.networkState,
                    paused: element.paused,
                    currentTime: element.currentTime,
                    muted: element.muted,
                  },
                  stream: describeStream(stream),
                  audioContextState: ctx.state,
                },
              }
            : {}),
        }
      }

      const sourceStream = stream ?? null
      const source = sourceStream
        ? ctx.createMediaStreamSource(sourceStream)
        : ctx.createMediaElementSource(element)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      const sink = ctx.createGain()
      sink.gain.value = 0
      analyser.connect(sink)
      sink.connect(ctx.destination)

      const data = new Float32Array(analyser.fftSize)
      let maxRms = 0
      const rmsSeries: number[] = []

      for (let i = 0; i < samples; i += 1) {
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let j = 0; j < data.length; j += 1) {
          const sample = data[j] ?? 0
          sum += sample * sample
        }
        const rms = Math.sqrt(sum / data.length)
        if (rms > maxRms) maxRms = rms
        if (includeDiagnostics) {
          rmsSeries.push(rms)
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const ok = mode === 'energy' ? maxRms > threshold : maxRms <= threshold
      const reason =
        mode === 'energy' ? (ok ? 'ok' : 'silent') : ok ? 'ok' : 'audible'

      return {
        ok,
        maxRms,
        reason,
        ...(includeDiagnostics
          ? {
              details: {
                threshold,
                audioContextState: ctx.state,
                probeSource: sourceStream ? 'stream' : 'media-element',
                element: {
                  readyState: element.readyState,
                  networkState: element.networkState,
                  currentTime: element.currentTime,
                  paused: element.paused,
                  ended: element.ended,
                  muted: element.muted,
                  defaultMuted: element.defaultMuted,
                  volume: element.volume,
                  playbackRate: element.playbackRate,
                },
                stream: describeStream(stream),
                rmsSeries,
              },
            }
          : {}),
      }
    },
    {
      selector: mediaSelector,
      mode,
      threshold,
      samples,
      waitForReady,
      includeDiagnostics,
    },
  )
}

export async function expectAudioEnergy(
  page: Page,
  mediaSelector: string,
  threshold = 0.003,
): Promise<void> {
  const result = await sampleAudioRms(page, mediaSelector, 'energy', threshold)

  expect(
    result.ok,
    `audio check failed: ${result.reason}, maxRms=${result.maxRms}, details=${formatDiagnostics(
      result.details,
    )}`,
  ).toBeTruthy()
}

export async function expectAudioSilent(
  page: Page,
  mediaSelector: string,
  threshold = 0.005,
): Promise<void> {
  const result = await sampleAudioRms(page, mediaSelector, 'silent', threshold)

  expect(
    result.ok,
    `audio silence check failed: ${result.reason}, maxRms=${result.maxRms}`,
  ).toBeTruthy()
}

export type RemoteCardState = {
  playerId: string
  hasVideo: boolean
  hasAudio: boolean
  videoSubscribed: boolean | null
  audioSubscribed: boolean | null
  videoMuted: boolean | null
  audioMuted: boolean | null
  liveKitConnectionState: string | null
  hasVideoOffPlaceholder: boolean
  hasOfflineWarning: boolean
  /** Player name from the card when available (for easier correlation in reports). */
  playerName?: string
}

export async function collectRemoteCardStates(
  page: Page,
): Promise<RemoteCardState[]> {
  return await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-testid="remote-player-card"]'),
    )

    return cards
      .map((card) => {
        const playerId = card.getAttribute('data-player-id')
        if (!playerId) return null
        const playerNameEl = card.querySelector('.text-white')
        const playerName = playerNameEl?.textContent?.trim()
        const readBooleanAttr = (name: string) => {
          const value = card.getAttribute(name)
          if (value === 'true') return true
          if (value === 'false') return false
          return null
        }
        const liveKitConnectionState = card.getAttribute(
          'data-livekit-connection-state',
        )
        return {
          playerId,
          hasVideo: card.querySelector('[data-testid="remote-player-video"]')
            ? true
            : false,
          hasAudio: card.querySelector('[data-testid="remote-player-audio"]')
            ? true
            : false,
          videoSubscribed: readBooleanAttr('data-video-subscribed'),
          audioSubscribed: readBooleanAttr('data-audio-subscribed'),
          videoMuted: readBooleanAttr('data-video-muted'),
          audioMuted: readBooleanAttr('data-audio-muted'),
          hasVideoOffPlaceholder: card.querySelector(
            '[data-testid="remote-player-video-off"]',
          )
            ? true
            : false,
          hasOfflineWarning: card.querySelector(
            '[data-testid="remote-player-offline-warning"]',
          )
            ? true
            : false,
          liveKitConnectionState,
          ...(playerName != null && { playerName }),
        }
      })
      .filter(
        (s): s is NonNullable<typeof s> => s !== null,
      ) as RemoteCardState[]
  })
}

const REMOTE_CARDS_STABLE_TIMEOUT_MS = 120_000
const REMOTE_CARDS_POLL_INTERVALS_MS = [250, 500, 1_000, 2_000]
/** Require this many consecutive stable polls (1s apart) before returning. */
const REMOTE_CARDS_STABLE_CONSECUTIVE = 2

/** Exposed so tests can assert only on strict media-healthy cards. */
export function isRemoteCardStable(state: RemoteCardState): boolean {
  return (
    isRemoteCardConnected(state) &&
    state.hasVideo &&
    state.hasAudio &&
    !state.hasVideoOffPlaceholder
  )
}

/** Exposed for phases where tracks may be intentionally disabled. */
export function isRemoteCardConnected(state: {
  hasOfflineWarning: boolean
  liveKitConnectionState: string | null
}): boolean {
  return (
    !state.hasOfflineWarning && state.liveKitConnectionState === 'connected'
  )
}

function formatRemoteCardState(state: RemoteCardState): string {
  const parts = [
    `playerId=${state.playerId}`,
    `video=${state.hasVideo}`,
    `audio=${state.hasAudio}`,
    `videoOff=${state.hasVideoOffPlaceholder}`,
    `offline=${state.hasOfflineWarning}`,
    `livekit=${state.liveKitConnectionState ?? 'unknown'}`,
  ]

  if (state.videoSubscribed !== null) {
    parts.push(`videoSubscribed=${state.videoSubscribed}`)
  }
  if (state.audioSubscribed !== null) {
    parts.push(`audioSubscribed=${state.audioSubscribed}`)
  }
  if (state.videoMuted !== null) {
    parts.push(`videoMuted=${state.videoMuted}`)
  }
  if (state.audioMuted !== null) {
    parts.push(`audioMuted=${state.audioMuted}`)
  }
  if (state.playerName) {
    parts.push(`name=${state.playerName}`)
  }

  return parts.join(' ')
}

export type WaitForRemoteCardsOptions = {
  /** Require at least this many stable cards (default: all expected). */
  minStable?: number
  /** Optional label (e.g. player name) to include in the error message. */
  context?: string
}

type PollRemoteCardsResult = {
  states: RemoteCardState[]
  satisfied: boolean
}

type PollRemoteCardsOptions = {
  page: Page
  isSatisfied: (states: RemoteCardState[]) => boolean
  consecutiveRequired?: number
  consecutiveIntervalMs?: number
}

async function pollRemoteCards({
  page,
  isSatisfied,
  consecutiveRequired = 1,
  consecutiveIntervalMs = 1_000,
}: PollRemoteCardsOptions): Promise<PollRemoteCardsResult> {
  const start = Date.now()
  let lastStates: RemoteCardState[] = []
  let intervalIndex = 0
  let consecutiveSuccesses = 0

  while (Date.now() - start < REMOTE_CARDS_STABLE_TIMEOUT_MS) {
    lastStates = await collectRemoteCardStates(page)

    if (isSatisfied(lastStates)) {
      consecutiveSuccesses += 1
      if (consecutiveSuccesses >= consecutiveRequired) {
        return { states: lastStates, satisfied: true }
      }
      await new Promise((r) => setTimeout(r, consecutiveIntervalMs))
      continue
    }

    consecutiveSuccesses = 0
    const interval =
      REMOTE_CARDS_POLL_INTERVALS_MS[
        Math.min(intervalIndex, REMOTE_CARDS_POLL_INTERVALS_MS.length - 1)
      ]
    await new Promise((r) => setTimeout(r, interval))
    intervalIndex += 1
  }

  return { states: lastStates, satisfied: false }
}

export async function waitForRemoteCardsStable(
  page: Page,
  expectedRemoteCount: number,
  options: WaitForRemoteCardsOptions = {},
): Promise<RemoteCardState[]> {
  const { minStable = expectedRemoteCount, context } = options
  const { states: lastStates, satisfied } = await pollRemoteCards({
    page,
    consecutiveRequired: REMOTE_CARDS_STABLE_CONSECUTIVE,
    isSatisfied: (states) => {
      const stableCount = states.filter(isRemoteCardStable).length
      return states.length === expectedRemoteCount && stableCount >= minStable
    },
  })

  if (satisfied) {
    return lastStates
  }

  const stableCount = lastStates.filter(isRemoteCardStable).length
  const unstableCards = lastStates.filter((s) => !isRemoteCardStable(s))

  const summary = lastStates.map(formatRemoteCardState).join('; ')
  const unstableDetail =
    unstableCards.length > 0
      ? ` Unstable (${unstableCards.length}): ${unstableCards.map(formatRemoteCardState).join(' | ')}`
      : ''
  const hint =
    ' Check attachments: livekit-remote-cards-*, livekit-media-elements-*, livekit-diagnostics-*, livekit-console-*, livekit-screenshot-*, livekit-failure-context.'
  const prefix = context ? `${context}: ` : ''

  throw new Error(
    `${prefix}Remote cards did not become stable within ${REMOTE_CARDS_STABLE_TIMEOUT_MS}ms: expected at least ${minStable} stable of ${expectedRemoteCount} cards, got ${lastStates.length} cards (${stableCount} stable).${unstableDetail} Cards: ${summary}.${hint}`,
  )
}

/** Result of collecting remote card stability for a single page (one player's view). */
export type RemoteCardsStabilityReport = {
  /** All remote card states at collection time. */
  cards: RemoteCardState[]
  stableCount: number
  unstableCount: number
  expectedCount: number
  /** Human-readable one-line summary. */
  summary: string
  /** Unstable cards with details (playerId, LiveKit state when applicable). */
  unstableCards: Array<{
    playerId: string
    playerName?: string
    hasVideo: boolean
    hasAudio: boolean
    hasVideoOffPlaceholder: boolean
    hasOfflineWarning: boolean
    liveKitConnectionState: string | null
    reason: string
  }>
  /** ISO timestamp when the report was collected. */
  collectedAt: string
}

/**
 * Collect a stability report for the current remote cards on the page.
 * Use in tests to attach detailed diagnostics on failure.
 */
export async function collectRemoteCardsStabilityReport(
  page: Page,
  expectedRemoteCount: number,
): Promise<RemoteCardsStabilityReport> {
  const cards = await collectRemoteCardStates(page)
  const stableCount = cards.filter(isRemoteCardStable).length
  const unstableCount = cards.length - stableCount

  const unstableCards = cards
    .filter((s) => !isRemoteCardStable(s))
    .map((s) => {
      const reasons: string[] = []
      if (!s.hasVideo) reasons.push('no-video')
      if (!s.hasAudio) reasons.push('no-audio')
      if (s.videoMuted === false && s.videoSubscribed === false) {
        reasons.push('video-not-subscribed')
      }
      if (s.audioMuted === false && s.audioSubscribed === false) {
        reasons.push('audio-not-subscribed')
      }
      if (s.hasVideoOffPlaceholder) reasons.push('video-off-placeholder')
      if (s.hasOfflineWarning) reasons.push('offline-warning')
      if (!isRemoteCardConnected(s)) {
        reasons.push(
          s.liveKitConnectionState
            ? `livekit-not-connected(${s.liveKitConnectionState})`
            : 'livekit-not-connected',
        )
      }
      return {
        playerId: s.playerId,
        playerName: s.playerName,
        hasVideo: s.hasVideo,
        hasAudio: s.hasAudio,
        hasVideoOffPlaceholder: s.hasVideoOffPlaceholder,
        hasOfflineWarning: s.hasOfflineWarning,
        liveKitConnectionState: s.liveKitConnectionState,
        reason: reasons.join(', '),
      }
    })

  const summary = `${stableCount}/${cards.length} stable (expected ${expectedRemoteCount})${unstableCount > 0 ? `; unstable: ${unstableCards.map((u) => `${u.playerId}(${u.reason})`).join(', ')}` : ''}`

  return {
    cards,
    stableCount,
    unstableCount,
    expectedCount: expectedRemoteCount,
    summary,
    unstableCards,
    collectedAt: new Date().toISOString(),
  }
}

export async function waitForRemoteCardsConnected(
  page: Page,
  expectedRemoteCount: number,
  options: { context?: string } = {},
): Promise<RemoteCardState[]> {
  const { context } = options
  const { states: lastStates, satisfied } = await pollRemoteCards({
    page,
    isSatisfied: (states) =>
      states.length === expectedRemoteCount &&
      states.every(isRemoteCardConnected),
  })

  if (satisfied) {
    return lastStates
  }

  const disconnectedCards = lastStates.filter((s) => !isRemoteCardConnected(s))
  const prefix = context ? `${context}: ` : ''
  throw new Error(
    `${prefix}Remote cards did not become connected within ${REMOTE_CARDS_STABLE_TIMEOUT_MS}ms: expected ${expectedRemoteCount} cards, got ${lastStates.length}. Disconnected: ${disconnectedCards.map(formatRemoteCardState).join(' | ')}.`,
  )
}

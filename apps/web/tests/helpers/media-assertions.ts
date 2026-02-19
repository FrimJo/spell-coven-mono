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

export async function expectVideoRendering(
  page: Page,
  videoSelector: string,
): Promise<void> {
  const result = await page.evaluate(async (selector) => {
    const video = document.querySelector(selector) as HTMLVideoElement | null
    if (!video) return { ok: false, reason: 'no-video-element' }

    const start = performance.now()
    while (performance.now() - start < 8000) {
      if (video.readyState >= 3 && video.videoWidth > 0) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    if (!(video.readyState >= 3 && video.videoWidth > 0)) {
      return { ok: false, reason: 'no-frames' }
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.min(320, video.videoWidth)
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
    await new Promise((resolve) => setTimeout(resolve, 250))
    const h2 = frameHash()
    await new Promise((resolve) => setTimeout(resolve, 250))
    const h3 = frameHash()

    const changing = h1 !== h2 || h2 !== h3
    return { ok: changing, reason: changing ? 'ok' : 'frozen' }
  }, videoSelector)

  expect(result.ok, `video check failed: ${result.reason}`).toBeTruthy()
}

export async function expectVideoFrozen(
  page: Page,
  videoSelector: string,
): Promise<void> {
  const result = await page.evaluate(async (selector) => {
    const video = document.querySelector(selector) as HTMLVideoElement | null
    if (!video) return { ok: false, reason: 'no-video-element' }

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
    await new Promise((resolve) => setTimeout(resolve, 400))
    const h2 = frameHash()
    await new Promise((resolve) => setTimeout(resolve, 400))
    const h3 = frameHash()

    const frozen = h1 === h2 && h2 === h3
    return { ok: frozen, reason: frozen ? 'ok' : 'changing' }
  }, videoSelector)

  expect(result.ok, `video freeze check failed: ${result.reason}`).toBeTruthy()
}

export async function expectAudioEnergy(
  page: Page,
  mediaSelector: string,
  threshold = 0.003,
): Promise<void> {
  const result = await page.evaluate(
    async ({ selector, threshold }) => {
      const element = document.querySelector(
        selector,
      ) as HTMLMediaElement | null
      if (!element) {
        return {
          ok: false,
          reason: 'no-media-element',
          maxRms: 0,
          details: { selector },
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

      try {
        await element.play()
      } catch {
        // Autoplay might be blocked; continue to probe audio anyway.
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
          details: {
            element: {
              readyState: element.readyState,
              muted: element.muted,
              paused: element.paused,
            },
          },
        }
      }

      const ctx = new AudioContextConstructor()
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume()
        } catch {
          // Continue and attempt to sample anyway.
        }
      }

      if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        const start = performance.now()
        while (performance.now() - start < 8000) {
          if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) break
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      const stream = element.srcObject as MediaStream | null
      if (stream) {
        const start = performance.now()
        while (performance.now() - start < 8000) {
          const hasLiveAudioTrack = stream
            .getAudioTracks()
            .some((track) => track.readyState === 'live' && !track.muted)
          if (hasLiveAudioTrack) break
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return {
          ok: false,
          reason: 'media-not-ready',
          maxRms: 0,
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
      }

      const sourceStream = stream ?? null
      const source = sourceStream
        ? ctx.createMediaStreamSource(sourceStream)
        : ctx.createMediaElementSource(element)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      // Avoid routing the signal to speakers during tests.
      const sink = ctx.createGain()
      sink.gain.value = 0
      analyser.connect(sink)
      sink.connect(ctx.destination)

      const data = new Float32Array(analyser.fftSize)
      const samples = 30
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
        rmsSeries.push(rms)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const ok = maxRms > threshold
      return {
        ok,
        maxRms,
        reason: ok ? 'ok' : 'silent',
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
    },
    { selector: mediaSelector, threshold },
  )

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
  const result = await page.evaluate(
    async ({ selector, threshold }) => {
      const element = document.querySelector(
        selector,
      ) as HTMLMediaElement | null
      if (!element) return { ok: false, reason: 'no-media-element' }

      const AudioContextConstructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!AudioContextConstructor) {
        return { ok: false, reason: 'no-audio-context' }
      }

      const ctx = new AudioContextConstructor()
      const source = ctx.createMediaElementSource(element)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyser.connect(ctx.destination)

      const data = new Float32Array(analyser.fftSize)
      const samples = 10
      let maxRms = 0

      for (let i = 0; i < samples; i += 1) {
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let j = 0; j < data.length; j += 1) {
          const sample = data[j] ?? 0
          sum += sample * sample
        }
        const rms = Math.sqrt(sum / data.length)
        if (rms > maxRms) maxRms = rms
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const ok = maxRms <= threshold
      return { ok, maxRms, reason: ok ? 'ok' : 'audible' }
    },
    { selector: mediaSelector, threshold },
  )

  expect(
    result.ok,
    `audio silence check failed: ${result.reason}, maxRms=${result.maxRms}`,
  ).toBeTruthy()
}

export type RemoteCardState = {
  playerId: string
  hasVideo: boolean
  hasVideoOffPlaceholder: boolean
  hasOfflineWarning: boolean
  hasWebRtcWarning: boolean
  /** When hasWebRtcWarning is true, the connection state from the UI (e.g. "connecting", "failed"). */
  webrtcConnectionState?: string
  /** Player name from the card when available (for easier correlation in reports). */
  playerName?: string
}

async function collectRemoteCardStates(page: Page): Promise<RemoteCardState[]> {
  return await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-testid="remote-player-card"]'),
    )

    return cards
      .map((card) => {
        const playerId = card.getAttribute('data-player-id')
        if (!playerId) return null
        const webrtcWarning = card.querySelector(
          '[data-testid="remote-player-webrtc-warning"]',
        )
        const playerNameEl = card.querySelector('.text-white')
        const webrtcConnectionState = webrtcWarning?.getAttribute(
          'data-connection-state',
        )
        const playerName = playerNameEl?.textContent?.trim()
        return {
          playerId,
          hasVideo: card.querySelector('[data-testid="remote-player-video"]')
            ? true
            : false,
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
          hasWebRtcWarning: !!webrtcWarning,
          ...(webrtcConnectionState != null && {
            webrtcConnectionState,
          }),
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

function isCardStable(state: RemoteCardState): boolean {
  return (
    state.hasVideo &&
    !state.hasVideoOffPlaceholder &&
    !state.hasOfflineWarning &&
    !state.hasWebRtcWarning
  )
}

/** Exposed so tests can assert only on stable cards when using minStable. */
export function isRemoteCardStable(state: {
  hasVideo: boolean
  hasVideoOffPlaceholder: boolean
  hasOfflineWarning: boolean
  hasWebRtcWarning: boolean
}): boolean {
  return (
    state.hasVideo &&
    !state.hasVideoOffPlaceholder &&
    !state.hasOfflineWarning &&
    !state.hasWebRtcWarning
  )
}

export type WaitForRemoteCardsOptions = {
  /** Require at least this many stable cards (default: all expected). */
  minStable?: number
  /** Optional label (e.g. player name) to include in the error message. */
  context?: string
}

export async function waitForRemoteCardsStable(
  page: Page,
  expectedRemoteCount: number,
  options: WaitForRemoteCardsOptions = {},
): Promise<RemoteCardState[]> {
  const { minStable = expectedRemoteCount, context } = options
  const start = Date.now()
  let lastStates: RemoteCardState[] = []
  let intervalIndex = 0
  let consecutiveStable = 0

  while (Date.now() - start < REMOTE_CARDS_STABLE_TIMEOUT_MS) {
    lastStates = await collectRemoteCardStates(page)
    const stableCount = lastStates.filter(isCardStable).length
    const enoughStable =
      lastStates.length === expectedRemoteCount && stableCount >= minStable

    if (enoughStable) {
      consecutiveStable += 1
      if (consecutiveStable >= REMOTE_CARDS_STABLE_CONSECUTIVE) {
        return lastStates
      }
      await new Promise((r) => setTimeout(r, 1_000))
      continue
    }

    consecutiveStable = 0
    const interval =
      REMOTE_CARDS_POLL_INTERVALS_MS[
        Math.min(intervalIndex, REMOTE_CARDS_POLL_INTERVALS_MS.length - 1)
      ]
    await new Promise((r) => setTimeout(r, interval))
    intervalIndex += 1
  }

  const stableCount = lastStates.filter(isCardStable).length
  const unstableCards = lastStates.filter((s) => !isCardStable(s))

  const formatCard = (s: RemoteCardState) => {
    const parts = [
      `playerId=${s.playerId}`,
      `video=${s.hasVideo}`,
      `videoOff=${s.hasVideoOffPlaceholder}`,
      `offline=${s.hasOfflineWarning}`,
      `webrtcWarn=${s.hasWebRtcWarning}`,
    ]
    if (s.hasWebRtcWarning && s.webrtcConnectionState) {
      parts.push(`connectionState=${s.webrtcConnectionState}`)
    }
    if (s.playerName) parts.unshift(`name=${s.playerName}`)
    return parts.join(' ')
  }

  const summary = lastStates.map(formatCard).join('; ')
  const unstableDetail =
    unstableCards.length > 0
      ? ` Unstable (${unstableCards.length}): ${unstableCards.map(formatCard).join(' | ')}`
      : ''
  const hint =
    ' Check attachments: webrtc-remote-cards-*, webrtc-media-*, webrtc-console-*, webrtc-screenshot-*, webrtc-failure-context.'
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
  /** Unstable cards with details (playerId, connectionState when applicable). */
  unstableCards: Array<{
    playerId: string
    playerName?: string
    hasVideo: boolean
    hasVideoOffPlaceholder: boolean
    hasOfflineWarning: boolean
    hasWebRtcWarning: boolean
    webrtcConnectionState?: string
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
  const stableCount = cards.filter(isCardStable).length
  const unstableCount = cards.length - stableCount

  const unstableCards = cards
    .filter((s) => !isCardStable(s))
    .map((s) => {
      const reasons: string[] = []
      if (!s.hasVideo) reasons.push('no-video')
      if (s.hasVideoOffPlaceholder) reasons.push('video-off-placeholder')
      if (s.hasOfflineWarning) reasons.push('offline-warning')
      if (s.hasWebRtcWarning) {
        reasons.push(
          s.webrtcConnectionState
            ? `webrtc-warning(${s.webrtcConnectionState})`
            : 'webrtc-warning',
        )
      }
      return {
        playerId: s.playerId,
        playerName: s.playerName,
        hasVideo: s.hasVideo,
        hasVideoOffPlaceholder: s.hasVideoOffPlaceholder,
        hasOfflineWarning: s.hasOfflineWarning,
        hasWebRtcWarning: s.hasWebRtcWarning,
        webrtcConnectionState: s.webrtcConnectionState,
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

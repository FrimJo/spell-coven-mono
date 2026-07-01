/**
 * MediaStreamManager - Centralized media stream acquisition
 *
 * Consolidates all getUserMedia calls with consistent:
 * - Resolution fallback (4K → 1080p → basic)
 * - Device constraints
 * - Error handling
 * - Track cleanup
 */

export interface GetMediaStreamOptions {
  /** Video device ID (exact match) */
  videoDeviceId?: string | null
  /** Audio device ID (exact match) */
  audioDeviceId?: string | null
  /** Enable video */
  video?: boolean
  /** Enable audio */
  audio?: boolean
  /** Custom video constraints (merged with resolution fallback) */
  videoConstraints?: MediaTrackConstraints
  /** Custom audio constraints */
  audioConstraints?: MediaTrackConstraints
  /** Preferred resolution: '4k' | '1080p' | 'basic' */
  resolution?: '4k' | '1080p' | 'basic'
  /** Enable automatic fallback to lower resolutions */
  enableFallback?: boolean
}

export type MediaStreamResult = {
  stream: MediaStream
  videoTrack: MediaStreamTrack | null
  audioTrack: MediaStreamTrack | null
  actualResolution: '4k' | '1080p' | 'basic' | 'none'
}

/**
 * Get a media stream with automatic resolution fallback
 *
 * @example Basic usage
 * ```ts
 * const { stream, videoTrack } = await getMediaStream({
 *   video: true,
 *   audio: true,
 * })
 * ```
 *
 * @example Specific device with 4K
 * ```ts
 * const { stream } = await getMediaStream({
 *   videoDeviceId: 'device-id-123',
 *   resolution: '4k',
 *   enableFallback: true,
 * })
 * ```
 *
 * @example Video only, no fallback
 * ```ts
 * const { stream } = await getMediaStream({
 *   video: true,
 *   audio: false,
 *   resolution: '1080p',
 *   enableFallback: false,
 * })
 * ```
 */
export async function getMediaStream(
  options: GetMediaStreamOptions = {},
): Promise<MediaStreamResult> {
  const {
    videoDeviceId,
    audioDeviceId,
    video = true,
    audio = false,
    videoConstraints = {},
    audioConstraints = {},
    resolution = '4k',
    enableFallback = true,
  } = options

  // Build resolution constraints
  const resolutionConstraints: Record<string, MediaTrackConstraints> = {
    '4k': {
      width: { ideal: 3840 },
      height: { ideal: 2160 },
    },
    '1080p': {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    basic: {},
  }

  // Try resolutions in order with fallback
  const resolutionsToTry = enableFallback
    ? resolution === '4k'
      ? ['4k', '1080p', 'basic']
      : resolution === '1080p'
        ? ['1080p', 'basic']
        : ['basic']
    : [resolution]

  let lastError: Error | null = null

  for (const currentResolution of resolutionsToTry) {
    try {
      // Build video constraints
      const videoConstraint = video
        ? {
            ...(resolutionConstraints[currentResolution] || {}),
            ...videoConstraints,
            ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
          }
        : false

      // Build audio constraints
      const audioConstraint = audio
        ? {
            ...audioConstraints,
            ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
          }
        : false

      const constraints: MediaStreamConstraints = {
        video: videoConstraint,
        audio: audioConstraint,
      }

      console.log(
        `[MediaStreamManager] Attempting ${currentResolution} resolution`,
        constraints,
      )

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      const videoTrack = stream.getVideoTracks()[0] || null
      const audioTrack = stream.getAudioTracks()[0] || null

      console.log(`[MediaStreamManager] Success with ${currentResolution}`, {
        hasVideo: !!videoTrack,
        hasAudio: !!audioTrack,
        videoSettings: videoTrack?.getSettings(),
      })

      return {
        stream,
        videoTrack,
        audioTrack,
        actualResolution: video
          ? (currentResolution as '4k' | '1080p' | 'basic')
          : 'none',
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(
        `[MediaStreamManager] ${currentResolution} failed:`,
        lastError.message,
      )

      // If this is the last resolution to try, throw the error
      if (currentResolution === resolutionsToTry[resolutionsToTry.length - 1]) {
        break
      }
    }
  }

  // All resolutions failed
  throw new Error(
    `Failed to get media stream: ${lastError?.message || 'Unknown error'}`,
  )
}

/**
 * Stop all tracks in a media stream
 */
export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return

  stream.getTracks().forEach((track) => {
    track.stop()
    console.log(`[MediaStreamManager] Stopped ${track.kind} track`)
  })
}

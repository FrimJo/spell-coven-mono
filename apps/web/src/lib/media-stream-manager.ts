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

/**
 * Replace a track in an RTCPeerConnection sender
 */
export async function replaceTrackInSender(
  sender: RTCRtpSender,
  newTrack: MediaStreamTrack | null,
): Promise<void> {
  try {
    await sender.replaceTrack(newTrack)
    console.log(
      `[MediaStreamManager] Replaced ${sender.track?.kind || 'unknown'} track`,
    )
  } catch (err) {
    console.error('[MediaStreamManager] Failed to replace track:', err)
    throw err
  }
}

/**
 * Get a temporary stream for device enumeration (with permissions)
 * This is useful when you need device labels but don't want to keep the stream
 *
 * Note: This may fail if no devices are available or permissions are denied.
 * Callers should handle errors gracefully.
 */
export async function getTemporaryStreamForPermissions(
  kind: 'video' | 'audio',
): Promise<{ deviceId: string | null; stream: MediaStream }> {
  console.log(
    `[MediaStreamManager] Requesting temporary ${kind} stream for permissions`,
  )

  const constraints: MediaStreamConstraints =
    kind === 'video'
      ? { video: true, audio: false }
      : { video: false, audio: true }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    const track = stream.getTracks()[0]
    const deviceId = track?.getSettings().deviceId || null

    console.log(
      `[MediaStreamManager] Got temporary ${kind} stream, deviceId:`,
      deviceId,
    )
    return { deviceId, stream }
  } catch (error) {
    console.error(
      `[MediaStreamManager] Failed to get temporary ${kind} stream:`,
      error,
    )
    throw error
  }
}

/**
 * Enumerate media devices (cameras, microphones, speakers)
 * Automatically filters out mock/virtual devices
 */
export async function enumerateMediaDevices(
  kind?: 'videoinput' | 'audioinput' | 'audiooutput',
): Promise<MediaDeviceInfo[]> {
  console.log(
    '[MediaStreamManager] enumerateMediaDevices called with kind:',
    kind,
  )
  const devices = await navigator.mediaDevices.enumerateDevices()
  console.log(
    `[MediaStreamManager] Raw enumerated ${devices.length} total devices:`,
    devices.map((d) => ({
      kind: d.kind,
      deviceId: d.deviceId,
      label: d.label,
    })),
  )

  // Filter by kind if specified
  const filtered = kind ? devices.filter((d) => d.kind === kind) : devices
  console.log(
    `[MediaStreamManager] After kind filter (${kind}): ${filtered.length} devices`,
    filtered.map((d) => ({
      kind: d.kind,
      deviceId: d.deviceId,
      label: d.label,
    })),
  )

  return filtered
}

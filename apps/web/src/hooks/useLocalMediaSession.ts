import { useEffect, useMemo, useRef, useState } from 'react'
import { getMediaStream } from '@/lib/media-stream-manager'

import type { MediaDevicesByKind } from './useEnumeratedMediaDevices'
import { useEnumeratedMediaDevices } from './useEnumeratedMediaDevices'

type VideoResolution = '1080p' | 'basic' | 'none'

interface TrackState {
  track: MediaStreamTrack | null
  selectedDeviceId: string
  isPending: boolean
  error: Error | null
}

interface VideoTrackState extends TrackState {
  actualResolution: VideoResolution
}

export interface UseLocalMediaSessionOptions {
  permissionsGranted: boolean
  videoEnabled: boolean
  selectedVideoDeviceId?: string | null
  selectedAudioInputDeviceId?: string | null
}

export interface UseLocalMediaSessionReturn {
  devices: MediaDevicesByKind
  previewStream: MediaStream
  videoTrack: MediaStreamTrack | null
  audioTrack: MediaStreamTrack | null
  video: VideoTrackState
  audio: TrackState
  selectedVideoDeviceId: string
  selectedAudioInputDeviceId: string
}

const EMPTY_MEDIA_DEVICES: MediaDevicesByKind = {
  audioinput: [],
  audiooutput: [],
  videoinput: [],
}

function resolveDeviceId(
  devices: MediaDeviceInfo[],
  requestedDeviceId?: string | null,
) {
  if (
    requestedDeviceId &&
    devices.some((device) => device.deviceId === requestedDeviceId)
  ) {
    return requestedDeviceId
  }

  return devices[0]?.deviceId ?? ''
}

function syncPreviewTrack(
  previewStream: MediaStream,
  kind: 'audio' | 'video',
  nextTrack: MediaStreamTrack | null,
) {
  for (const track of previewStream.getTracks()) {
    if (track.kind === kind && track !== nextTrack) {
      previewStream.removeTrack(track)
    }
  }

  if (nextTrack && !previewStream.getTracks().includes(nextTrack)) {
    previewStream.addTrack(nextTrack)
  }
}

function stopTrack(track: MediaStreamTrack | null) {
  if (!track) {
    return
  }

  try {
    track.stop()
  } catch {
    // Ignore teardown failures from already-ended tracks.
  }
}

export function useLocalMediaSession({
  permissionsGranted,
  videoEnabled,
  selectedVideoDeviceId: requestedVideoDeviceId,
  selectedAudioInputDeviceId: requestedAudioInputDeviceId,
}: UseLocalMediaSessionOptions): UseLocalMediaSessionReturn {
  const { data: mediaDevicesByKind = EMPTY_MEDIA_DEVICES } =
    useEnumeratedMediaDevices()

  const previewStream = useMemo(() => new MediaStream(), [])

  const selectedVideoDeviceId = useMemo(
    () =>
      resolveDeviceId(
        mediaDevicesByKind.videoinput,
        requestedVideoDeviceId ?? undefined,
      ),
    [mediaDevicesByKind.videoinput, requestedVideoDeviceId],
  )

  const selectedAudioInputDeviceId = useMemo(
    () =>
      resolveDeviceId(
        mediaDevicesByKind.audioinput,
        requestedAudioInputDeviceId ?? undefined,
      ),
    [mediaDevicesByKind.audioinput, requestedAudioInputDeviceId],
  )

  const [videoState, setVideoState] = useState<VideoTrackState>({
    track: null,
    selectedDeviceId: '',
    isPending: false,
    error: null,
    actualResolution: 'none',
  })
  const [audioState, setAudioState] = useState<TrackState>({
    track: null,
    selectedDeviceId: '',
    isPending: false,
    error: null,
  })
  const videoTrackRef = useRef<MediaStreamTrack | null>(null)
  const audioTrackRef = useRef<MediaStreamTrack | null>(null)

  useEffect(() => {
    videoTrackRef.current = videoState.track
  }, [videoState.track])

  useEffect(() => {
    audioTrackRef.current = audioState.track
  }, [audioState.track])

  useEffect(() => {
    if (!permissionsGranted || !videoEnabled || !selectedVideoDeviceId) {
      setVideoState((previous) => {
        if (!previous.track && previous.selectedDeviceId === '') {
          return previous
        }

        syncPreviewTrack(previewStream, 'video', null)
        stopTrack(previous.track)

        return {
          track: null,
          selectedDeviceId: '',
          isPending: false,
          error: null,
          actualResolution: 'none',
        }
      })
      return
    }

    if (
      videoState.track &&
      videoState.selectedDeviceId === selectedVideoDeviceId &&
      videoState.track.readyState === 'live'
    ) {
      return
    }

    let cancelled = false
    const previousTrack = videoState.track

    setVideoState((previous) => ({
      ...previous,
      isPending: true,
      error: null,
    }))

    void (async () => {
      try {
        const { videoTrack, actualResolution } = await getMediaStream({
          video: true,
          audio: false,
          videoDeviceId: selectedVideoDeviceId,
          resolution: '1080p',
          enableFallback: true,
          videoConstraints: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 15, max: 15 },
          },
        })

        if (!videoTrack) {
          throw new Error('Selected camera did not produce a video track')
        }

        videoTrack.contentHint = 'detail'

        if (cancelled) {
          stopTrack(videoTrack)
          return
        }

        syncPreviewTrack(previewStream, 'video', videoTrack)
        if (previousTrack && previousTrack !== videoTrack) {
          stopTrack(previousTrack)
        }

        setVideoState({
          track: videoTrack,
          selectedDeviceId: selectedVideoDeviceId,
          isPending: false,
          error: null,
          actualResolution:
            actualResolution === '4k' ? '1080p' : actualResolution,
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setVideoState((previous) => ({
          ...previous,
          isPending: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    permissionsGranted,
    previewStream,
    selectedVideoDeviceId,
    videoEnabled,
    videoState.selectedDeviceId,
    videoState.track,
  ])

  useEffect(() => {
    if (!permissionsGranted || !selectedAudioInputDeviceId) {
      setAudioState((previous) => {
        if (!previous.track && previous.selectedDeviceId === '') {
          return previous
        }

        syncPreviewTrack(previewStream, 'audio', null)
        stopTrack(previous.track)

        return {
          track: null,
          selectedDeviceId: '',
          isPending: false,
          error: null,
        }
      })
      return
    }

    if (
      audioState.track &&
      audioState.selectedDeviceId === selectedAudioInputDeviceId &&
      audioState.track.readyState === 'live'
    ) {
      return
    }

    let cancelled = false
    const previousTrack = audioState.track

    setAudioState((previous) => ({
      ...previous,
      isPending: true,
      error: null,
    }))

    void (async () => {
      try {
        const { audioTrack } = await getMediaStream({
          video: false,
          audio: true,
          audioDeviceId: selectedAudioInputDeviceId,
          audioConstraints: {
            channelCount: { ideal: 1 },
          },
        })

        if (!audioTrack) {
          throw new Error('Selected microphone did not produce an audio track')
        }

        if (cancelled) {
          stopTrack(audioTrack)
          return
        }

        syncPreviewTrack(previewStream, 'audio', audioTrack)
        if (previousTrack && previousTrack !== audioTrack) {
          stopTrack(previousTrack)
        }

        setAudioState({
          track: audioTrack,
          selectedDeviceId: selectedAudioInputDeviceId,
          isPending: false,
          error: null,
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setAudioState((previous) => ({
          ...previous,
          isPending: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    audioState.selectedDeviceId,
    audioState.track,
    permissionsGranted,
    previewStream,
    selectedAudioInputDeviceId,
  ])

  useEffect(() => {
    return () => {
      stopTrack(videoTrackRef.current)
      stopTrack(audioTrackRef.current)
    }
  }, [])

  return {
    devices: mediaDevicesByKind,
    previewStream,
    videoTrack: videoState.track,
    audioTrack: audioState.track,
    video: videoState,
    audio: audioState,
    selectedVideoDeviceId,
    selectedAudioInputDeviceId,
  }
}

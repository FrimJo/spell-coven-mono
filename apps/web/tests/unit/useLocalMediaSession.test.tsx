import { useLocalMediaSession } from '@/hooks/useLocalMediaSession'
import { getMediaStream } from '@/lib/media-stream-manager'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useEnumeratedMediaDevices', () => ({
  useEnumeratedMediaDevices: () => ({
    data: {
      videoinput: [
        {
          deviceId: 'cam-1',
          groupId: 'video-group',
          kind: 'videoinput',
          label: 'Overhead Camera',
          toJSON: () => ({}),
        },
      ],
      audioinput: [
        {
          deviceId: 'mic-1',
          groupId: 'audio-group-1',
          kind: 'audioinput',
          label: 'Desk Mic',
          toJSON: () => ({}),
        },
        {
          deviceId: 'mic-2',
          groupId: 'audio-group-2',
          kind: 'audioinput',
          label: 'USB Mic',
          toJSON: () => ({}),
        },
      ],
      audiooutput: [],
    },
  }),
}))

vi.mock('@/lib/media-stream-manager', () => ({
  getMediaStream: vi.fn(),
}))

class FakeMediaStream {
  private readonly tracks: MediaStreamTrack[]

  constructor(initialTracks: MediaStreamTrack[] = []) {
    this.tracks = [...initialTracks]
  }

  addTrack(track: MediaStreamTrack) {
    if (!this.tracks.includes(track)) {
      this.tracks.push(track)
    }
  }

  removeTrack(track: MediaStreamTrack) {
    const index = this.tracks.indexOf(track)
    if (index >= 0) {
      this.tracks.splice(index, 1)
    }
  }

  getTracks() {
    return [...this.tracks]
  }

  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video')
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === 'audio')
  }
}

function createTrack(kind: 'audio' | 'video', deviceId: string) {
  const track = {
    kind,
    readyState: 'live',
    contentHint: '',
    stop: vi.fn(() => {
      track.readyState = 'ended'
    }),
    getSettings: () => ({ deviceId }),
    getConstraints: () => ({}),
  }

  return track as unknown as MediaStreamTrack
}

describe('useLocalMediaSession', () => {
  const originalMediaStream = globalThis.MediaStream
  const mockedGetMediaStream = getMediaStream as any

  beforeEach(() => {
    ;(globalThis as { MediaStream: typeof MediaStream }).MediaStream =
      FakeMediaStream as unknown as typeof MediaStream

    mockedGetMediaStream.mockImplementation(async (options: any = {}) => {
      if (options.video) {
        const videoTrack = createTrack(
          'video',
          options.videoDeviceId ?? 'cam-1',
        )
        return {
          stream: new MediaStream([videoTrack]),
          videoTrack,
          audioTrack: null,
          actualResolution: '1080p' as const,
        }
      }

      const audioTrack = createTrack('audio', options.audioDeviceId ?? 'mic-1')
      return {
        stream: new MediaStream([audioTrack]),
        videoTrack: null,
        audioTrack,
        actualResolution: 'none' as const,
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()

    if (originalMediaStream) {
      ;(globalThis as { MediaStream: typeof MediaStream }).MediaStream =
        originalMediaStream
    } else {
      delete (globalThis as { MediaStream?: typeof MediaStream }).MediaStream
    }
  })

  it('keeps a stable preview stream and only reacquires video when re-enabled', async () => {
    const { result, rerender } = renderHook(
      (props: {
        permissionsGranted: boolean
        videoEnabled: boolean
        selectedVideoDeviceId?: string | null
        selectedAudioInputDeviceId?: string | null
      }) => useLocalMediaSession(props),
      {
        initialProps: {
          permissionsGranted: true,
          videoEnabled: true,
          selectedVideoDeviceId: 'cam-1',
          selectedAudioInputDeviceId: 'mic-1',
        },
      },
    )

    await waitFor(() => {
      expect(result.current.video.track).not.toBeNull()
      expect(result.current.audio.track).not.toBeNull()
    })

    const previewStream = result.current.previewStream
    const firstVideoTrack = result.current.video.track

    expect(getMediaStream).toHaveBeenCalledTimes(2)

    rerender({
      permissionsGranted: true,
      videoEnabled: true,
      selectedVideoDeviceId: 'cam-1',
      selectedAudioInputDeviceId: 'mic-1',
    })

    expect(result.current.previewStream).toBe(previewStream)
    expect(getMediaStream).toHaveBeenCalledTimes(2)

    rerender({
      permissionsGranted: true,
      videoEnabled: false,
      selectedVideoDeviceId: 'cam-1',
      selectedAudioInputDeviceId: 'mic-1',
    })

    await waitFor(() => {
      expect(result.current.video.track).toBeNull()
    })

    expect(result.current.previewStream).toBe(previewStream)
    expect(firstVideoTrack?.stop).toHaveBeenCalledTimes(1)

    rerender({
      permissionsGranted: true,
      videoEnabled: true,
      selectedVideoDeviceId: 'cam-1',
      selectedAudioInputDeviceId: 'mic-1',
    })

    await waitFor(() => {
      expect(result.current.video.track).not.toBeNull()
    })

    expect(result.current.previewStream).toBe(previewStream)
    expect(getMediaStream).toHaveBeenCalledTimes(3)
  })

  it('reacquires audio only when the selected microphone changes', async () => {
    const { result, rerender } = renderHook(
      (selectedAudioInputDeviceId: string) =>
        useLocalMediaSession({
          permissionsGranted: true,
          videoEnabled: false,
          selectedAudioInputDeviceId,
        }),
      {
        initialProps: 'mic-1',
      },
    )

    await waitFor(() => {
      expect(result.current.audio.track).not.toBeNull()
    })

    const previewStream = result.current.previewStream
    const firstAudioTrack = result.current.audio.track

    expect(getMediaStream).toHaveBeenCalledTimes(1)

    rerender()

    expect(result.current.previewStream).toBe(previewStream)
    expect(getMediaStream).toHaveBeenCalledTimes(1)

    rerender('mic-2')

    await waitFor(() => {
      expect(result.current.audio.track).not.toBe(firstAudioTrack)
    })

    expect(result.current.previewStream).toBe(previewStream)
    expect(getMediaStream).toHaveBeenCalledTimes(2)
  })
})

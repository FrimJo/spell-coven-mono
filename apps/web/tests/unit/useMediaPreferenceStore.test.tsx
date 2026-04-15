import {
  MEDIA_DEVICE_STORAGE_KEY,
  useMediaPreferenceStore,
} from '@/hooks/useMediaPreferenceStore'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

describe('useMediaPreferenceStore', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('loads committed device selections from localStorage', () => {
    localStorage.setItem(
      MEDIA_DEVICE_STORAGE_KEY,
      JSON.stringify({
        videoinput: 'camera-1',
        audioinput: 'mic-1',
        audiooutput: 'speaker-1',
        timestamp: Date.now(),
      }),
    )

    const { result } = renderHook(() => useMediaPreferenceStore())

    expect(result.current.selectedVideoDeviceId).toBe('camera-1')
    expect(result.current.selectedAudioInputDeviceId).toBe('mic-1')
    expect(result.current.selectedAudioOutputDeviceId).toBe('speaker-1')
    expect(result.current.hasCommitted).toBe(true)
    expect(result.current.videoEnabled).toBe(true)
    expect(result.current.audioEnabled).toBe(true)
  })

  it('commits the current device selections with a timestamp', () => {
    const { result } = renderHook(() => useMediaPreferenceStore())

    act(() => {
      result.current.setSelectedVideoDeviceId('camera-2')
      result.current.setSelectedAudioInputDeviceId('mic-2')
      result.current.setSelectedAudioOutputDeviceId('speaker-2')
      result.current.commitPreferences()
    })

    const persisted = JSON.parse(
      localStorage.getItem(MEDIA_DEVICE_STORAGE_KEY) ?? '{}',
    ) as {
      videoinput?: string
      audioinput?: string
      audiooutput?: string
      timestamp?: number
    }

    expect(persisted.videoinput).toBe('camera-2')
    expect(persisted.audioinput).toBe('mic-2')
    expect(persisted.audiooutput).toBe('speaker-2')
    expect(typeof persisted.timestamp).toBe('number')
    expect(result.current.hasCommitted).toBe(true)
  })

  it('restores a captured snapshot without changing committed state', () => {
    const { result } = renderHook(() => useMediaPreferenceStore())

    let snapshot: ReturnType<typeof result.current.captureSnapshot>

    act(() => {
      result.current.setSelectedVideoDeviceId('camera-1')
      result.current.setSelectedAudioInputDeviceId('mic-1')
      result.current.setSelectedAudioOutputDeviceId('speaker-1')
      result.current.setVideoEnabled(false)
      result.current.setAudioEnabled(false)
    })

    act(() => {
      snapshot = result.current.captureSnapshot()
    })

    act(() => {
      result.current.setSelectedVideoDeviceId('camera-2')
      result.current.setSelectedAudioInputDeviceId('mic-2')
      result.current.setSelectedAudioOutputDeviceId('speaker-2')
      result.current.setVideoEnabled(true)
      result.current.setAudioEnabled(true)
      result.current.restoreSnapshot(snapshot)
    })

    expect(result.current.selectedVideoDeviceId).toBe('camera-1')
    expect(result.current.selectedAudioInputDeviceId).toBe('mic-1')
    expect(result.current.selectedAudioOutputDeviceId).toBe('speaker-1')
    expect(result.current.videoEnabled).toBe(false)
    expect(result.current.audioEnabled).toBe(false)
    expect(result.current.hasCommitted).toBe(false)
  })
})

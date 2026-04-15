import { useMediaSetupController } from '@/hooks/useMediaSetupController'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invalidateQueries = vi.fn()
const recordDecline = vi.fn()
const recheckPermissions = vi.fn()
const restoreSnapshot = vi.fn()
const commitPreferences = vi.fn()

const snapshot = {
  selectedVideoDeviceId: 'camera-1',
  selectedAudioInputDeviceId: 'mic-1',
  selectedAudioOutputDeviceId: 'speaker-1',
  videoEnabled: true,
  audioEnabled: true,
}

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries,
  }),
}))

vi.mock('@/hooks/useMediaPermissions', () => ({
  useMediaPermissions: () => ({
    recordDecline,
  }),
}))

vi.mock('@/contexts/MediaStreamContext', () => ({
  useMediaStreams: () => ({
    video: {
      devices: [],
      selectedDeviceId: 'camera-1',
      error: null,
      isPending: false,
    },
    audio: {
      devices: [],
      selectedDeviceId: 'mic-1',
      error: null,
      isPending: false,
    },
    audioOutput: {
      currentDeviceId: 'speaker-1',
      error: null,
      isSupported: true,
      isTesting: false,
      devices: [],
      testOutput: vi.fn(),
    },
    permissions: {
      camera: { browserState: 'granted', shouldShowDialog: false },
      microphone: { browserState: 'granted', shouldShowDialog: false },
      isChecking: false,
      permissionsGranted: true,
      recheckPermissions,
    },
    mediaPreferences: {
      selectedVideoDeviceId: 'camera-1',
      selectedAudioInputDeviceId: 'mic-1',
      selectedAudioOutputDeviceId: 'speaker-1',
      videoEnabled: true,
      audioEnabled: true,
      setSelectedVideoDeviceId: vi.fn(),
      setSelectedAudioInputDeviceId: vi.fn(),
      setSelectedAudioOutputDeviceId: vi.fn(),
      setVideoEnabled: vi.fn(),
      setAudioEnabled: vi.fn(),
      captureSnapshot: () => snapshot,
      restoreSnapshot,
      commitPreferences,
    },
  }),
}))

describe('useMediaSetupController', () => {
  beforeEach(() => {
    invalidateQueries.mockReset()
    recordDecline.mockReset()
    recheckPermissions.mockReset()
    restoreSnapshot.mockReset()
    commitPreferences.mockReset()
  })

  it('commits preferences before completing setup', () => {
    const onComplete = vi.fn()
    const onCancel = vi.fn()

    const { result } = renderHook(() =>
      useMediaSetupController({
        isInGameSettings: false,
        onComplete,
        onCancel,
      }),
    )

    act(() => {
      result.current.handleComplete()
    })

    expect(commitPreferences).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('restores the opening snapshot when cancelling in-game settings', () => {
    const onComplete = vi.fn()
    const onCancel = vi.fn()

    const { result } = renderHook(() =>
      useMediaSetupController({
        isInGameSettings: true,
        onComplete,
        onCancel,
      }),
    )

    act(() => {
      result.current.handleCancel()
    })

    expect(restoreSnapshot).toHaveBeenCalledWith(snapshot)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(commitPreferences).not.toHaveBeenCalled()
  })
})

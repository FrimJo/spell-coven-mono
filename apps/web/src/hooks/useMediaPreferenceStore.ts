import { useCallback, useEffect, useMemo, useState } from 'react'

export const MEDIA_DEVICE_STORAGE_KEY = 'mtg-selected-media-devices'

export interface PersistedMediaDeviceState {
  videoinput: string | null
  audioinput: string | null
  audiooutput: string | null
  timestamp?: number
}

export interface MediaPreferencesSnapshot {
  selectedVideoDeviceId: string | null
  selectedAudioInputDeviceId: string | null
  selectedAudioOutputDeviceId: string | null
  selectedVideoSource: VideoSourceSelection
  videoEnabled: boolean
  audioEnabled: boolean
}

export type VideoSourceSelection =
  | { type: 'device'; deviceId: string | null }
  | { type: 'phone'; pairingId: string }

interface MediaPreferenceStoreState extends MediaPreferencesSnapshot {
  hasCommitted: boolean
}

function defaultState(): MediaPreferenceStoreState {
  return {
    selectedVideoDeviceId: null,
    selectedAudioInputDeviceId: null,
    selectedAudioOutputDeviceId: null,
    selectedVideoSource: { type: 'device', deviceId: null },
    videoEnabled: true,
    audioEnabled: true,
    hasCommitted: false,
  }
}

function readPersistedMediaDevices(): MediaPreferenceStoreState {
  if (typeof window === 'undefined') {
    return defaultState()
  }

  try {
    const stored = localStorage.getItem(MEDIA_DEVICE_STORAGE_KEY)
    if (!stored) {
      return defaultState()
    }

    const parsed = JSON.parse(stored) as PersistedMediaDeviceState

    return {
      selectedVideoDeviceId: parsed.videoinput ?? null,
      selectedAudioInputDeviceId: parsed.audioinput ?? null,
      selectedAudioOutputDeviceId: parsed.audiooutput ?? null,
      selectedVideoSource: {
        type: 'device',
        deviceId: parsed.videoinput ?? null,
      },
      videoEnabled: true,
      audioEnabled: true,
      hasCommitted: Boolean(parsed.timestamp),
    }
  } catch {
    return defaultState()
  }
}

type PersistedDeviceIds = Pick<
  MediaPreferencesSnapshot,
  | 'selectedVideoDeviceId'
  | 'selectedAudioInputDeviceId'
  | 'selectedAudioOutputDeviceId'
>

// Enabled flags are session-only; only device ids and a timestamp persist.
function persistMediaDevices(deviceIds: PersistedDeviceIds): void {
  localStorage.setItem(
    MEDIA_DEVICE_STORAGE_KEY,
    JSON.stringify({
      videoinput: deviceIds.selectedVideoDeviceId,
      audioinput: deviceIds.selectedAudioInputDeviceId,
      audiooutput: deviceIds.selectedAudioOutputDeviceId,
      timestamp: Date.now(),
    } satisfies PersistedMediaDeviceState),
  )
}

export interface MediaPreferenceStore {
  selectedVideoDeviceId: string | null
  selectedAudioInputDeviceId: string | null
  selectedAudioOutputDeviceId: string | null
  selectedVideoSource: VideoSourceSelection
  videoEnabled: boolean
  audioEnabled: boolean
  hasCommitted: boolean
  setSelectedVideoDeviceId: (deviceId: string | null) => void
  setSelectedPhoneCamera: (pairingId: string) => void
  setSelectedAudioInputDeviceId: (deviceId: string | null) => void
  setSelectedAudioOutputDeviceId: (deviceId: string | null) => void
  setVideoEnabled: (enabled: boolean) => void
  setAudioEnabled: (enabled: boolean) => void
  captureSnapshot: () => MediaPreferencesSnapshot
  restoreSnapshot: (snapshot: MediaPreferencesSnapshot) => void
  commitPreferences: () => void
}

export function useMediaPreferenceStore(): MediaPreferenceStore {
  const [state, setState] = useState<MediaPreferenceStoreState>(
    readPersistedMediaDevices,
  )

  useEffect(() => {
    if (!state.hasCommitted || typeof window === 'undefined') {
      return
    }

    persistMediaDevices({
      selectedVideoDeviceId: state.selectedVideoDeviceId,
      selectedAudioInputDeviceId: state.selectedAudioInputDeviceId,
      selectedAudioOutputDeviceId: state.selectedAudioOutputDeviceId,
    })
  }, [
    state.selectedVideoDeviceId,
    state.selectedAudioInputDeviceId,
    state.selectedAudioOutputDeviceId,
    state.hasCommitted,
  ])

  const setSelectedVideoDeviceId = useCallback((deviceId: string | null) => {
    setState((current) =>
      current.selectedVideoDeviceId === deviceId
        ? current
        : {
            ...current,
            selectedVideoDeviceId: deviceId,
            selectedVideoSource: { type: 'device', deviceId },
          },
    )
  }, [])

  const setSelectedPhoneCamera = useCallback((pairingId: string) => {
    setState((current) =>
      current.selectedVideoSource.type === 'phone' &&
      current.selectedVideoSource.pairingId === pairingId
        ? current
        : { ...current, selectedVideoSource: { type: 'phone', pairingId } },
    )
  }, [])

  const setSelectedAudioInputDeviceId = useCallback(
    (deviceId: string | null) => {
      setState((current) =>
        current.selectedAudioInputDeviceId === deviceId
          ? current
          : { ...current, selectedAudioInputDeviceId: deviceId },
      )
    },
    [],
  )

  const setSelectedAudioOutputDeviceId = useCallback(
    (deviceId: string | null) => {
      setState((current) =>
        current.selectedAudioOutputDeviceId === deviceId
          ? current
          : { ...current, selectedAudioOutputDeviceId: deviceId },
      )
    },
    [],
  )

  const setVideoEnabled = useCallback((enabled: boolean) => {
    setState((current) =>
      current.videoEnabled === enabled
        ? current
        : { ...current, videoEnabled: enabled },
    )
  }, [])

  const setAudioEnabled = useCallback((enabled: boolean) => {
    setState((current) =>
      current.audioEnabled === enabled
        ? current
        : { ...current, audioEnabled: enabled },
    )
  }, [])

  const captureSnapshot = useCallback(
    (): MediaPreferencesSnapshot => ({
      selectedVideoDeviceId: state.selectedVideoDeviceId,
      selectedAudioInputDeviceId: state.selectedAudioInputDeviceId,
      selectedAudioOutputDeviceId: state.selectedAudioOutputDeviceId,
      selectedVideoSource: state.selectedVideoSource,
      videoEnabled: state.videoEnabled,
      audioEnabled: state.audioEnabled,
    }),
    [
      state.selectedVideoDeviceId,
      state.selectedAudioInputDeviceId,
      state.selectedAudioOutputDeviceId,
      state.selectedVideoSource,
      state.videoEnabled,
      state.audioEnabled,
    ],
  )

  const restoreSnapshot = useCallback((snapshot: MediaPreferencesSnapshot) => {
    setState((current) => ({
      ...current,
      selectedVideoDeviceId: snapshot.selectedVideoDeviceId,
      selectedAudioInputDeviceId: snapshot.selectedAudioInputDeviceId,
      selectedAudioOutputDeviceId: snapshot.selectedAudioOutputDeviceId,
      selectedVideoSource: snapshot.selectedVideoSource,
      videoEnabled: snapshot.videoEnabled,
      audioEnabled: snapshot.audioEnabled,
    }))
  }, [])

  const commitPreferences = useCallback(() => {
    setState((current) => {
      const next = { ...current, hasCommitted: true }
      if (typeof window !== 'undefined') {
        persistMediaDevices(next)
      }
      return next
    })
  }, [])

  return useMemo(
    (): MediaPreferenceStore => ({
      selectedVideoDeviceId: state.selectedVideoDeviceId,
      selectedAudioInputDeviceId: state.selectedAudioInputDeviceId,
      selectedAudioOutputDeviceId: state.selectedAudioOutputDeviceId,
      selectedVideoSource: state.selectedVideoSource,
      videoEnabled: state.videoEnabled,
      audioEnabled: state.audioEnabled,
      hasCommitted: state.hasCommitted,
      setSelectedVideoDeviceId,
      setSelectedPhoneCamera,
      setSelectedAudioInputDeviceId,
      setSelectedAudioOutputDeviceId,
      setVideoEnabled,
      setAudioEnabled,
      captureSnapshot,
      restoreSnapshot,
      commitPreferences,
    }),
    [
      state.selectedVideoDeviceId,
      state.selectedAudioInputDeviceId,
      state.selectedAudioOutputDeviceId,
      state.selectedVideoSource,
      state.videoEnabled,
      state.audioEnabled,
      state.hasCommitted,
      setSelectedVideoDeviceId,
      setSelectedPhoneCamera,
      setSelectedAudioInputDeviceId,
      setSelectedAudioOutputDeviceId,
      setVideoEnabled,
      setAudioEnabled,
      captureSnapshot,
      restoreSnapshot,
      commitPreferences,
    ],
  )
}

import { useCallback, useEffect, useState } from 'react'

export const MEDIA_DEVICE_STORAGE_KEY = 'mtg-selected-media-devices'

interface PersistedMediaDeviceState {
  videoinput: string | null
  audioinput: string | null
  audiooutput: string | null
  timestamp?: number
}

export interface MediaPreferencesSnapshot {
  selectedVideoDeviceId: string | null
  selectedAudioInputDeviceId: string | null
  selectedAudioOutputDeviceId: string | null
  videoEnabled: boolean
  audioEnabled: boolean
}

interface MediaPreferenceStoreState extends MediaPreferencesSnapshot {
  hasCommitted: boolean
}

function defaultState(): MediaPreferenceStoreState {
  return {
    selectedVideoDeviceId: null,
    selectedAudioInputDeviceId: null,
    selectedAudioOutputDeviceId: null,
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
      videoEnabled: true,
      audioEnabled: true,
      hasCommitted: Boolean(parsed.timestamp),
    }
  } catch {
    return defaultState()
  }
}

function persistMediaDevices(snapshot: MediaPreferencesSnapshot): void {
  localStorage.setItem(
    MEDIA_DEVICE_STORAGE_KEY,
    JSON.stringify({
      videoinput: snapshot.selectedVideoDeviceId,
      audioinput: snapshot.selectedAudioInputDeviceId,
      audiooutput: snapshot.selectedAudioOutputDeviceId,
      timestamp: Date.now(),
    } satisfies PersistedMediaDeviceState),
  )
}

export interface MediaPreferenceStore {
  selectedVideoDeviceId: string | null
  selectedAudioInputDeviceId: string | null
  selectedAudioOutputDeviceId: string | null
  videoEnabled: boolean
  audioEnabled: boolean
  hasCommitted: boolean
  setSelectedVideoDeviceId: (deviceId: string | null) => void
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

    persistMediaDevices(state)
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
        : { ...current, selectedVideoDeviceId: deviceId },
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
      videoEnabled: state.videoEnabled,
      audioEnabled: state.audioEnabled,
    }),
    [
      state.selectedVideoDeviceId,
      state.selectedAudioInputDeviceId,
      state.selectedAudioOutputDeviceId,
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

  return {
    selectedVideoDeviceId: state.selectedVideoDeviceId,
    selectedAudioInputDeviceId: state.selectedAudioInputDeviceId,
    selectedAudioOutputDeviceId: state.selectedAudioOutputDeviceId,
    videoEnabled: state.videoEnabled,
    audioEnabled: state.audioEnabled,
    hasCommitted: state.hasCommitted,
    setSelectedVideoDeviceId,
    setSelectedAudioInputDeviceId,
    setSelectedAudioOutputDeviceId,
    setVideoEnabled,
    setAudioEnabled,
    captureSnapshot,
    restoreSnapshot,
    commitPreferences,
  }
}

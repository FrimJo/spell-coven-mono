import type {
  RoomMediaControls,
  RoomMediaSessionState,
} from '@/types/media-session'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { createLiveKitMediaAdapter } from '@/lib/media/livekit-adapter'
import { createMediaDiagnosticsSnapshot } from '@/lib/media/media-diagnostics'
import { api } from '@convex/_generated/api'
import { useAction } from 'convex/react'

function createEmptyRoomMediaSessionState(): RoomMediaSessionState {
  const state = {
    connectionState: 'disconnected' as const,
    isReconnecting: false,
    local: null,
    remotes: new Map(),
    lastError: null,
    lastDisconnectReason: null,
  }

  return {
    ...state,
    diagnostics: createMediaDiagnosticsSnapshot(state),
  }
}

interface UseRoomMediaSessionOptions {
  roomId: string
  sessionId: string
  enabled: boolean
}

export function useRoomMediaSession({
  roomId,
  sessionId,
  enabled,
}: UseRoomMediaSessionOptions): RoomMediaSessionState & {
  controls: RoomMediaControls
} {
  const issueLiveKitToken = useAction(api.mediaActions.issueLiveKitToken)
  const adapterRef = useRef<ReturnType<
    typeof createLiveKitMediaAdapter
  > | null>(null)
  const isConnectedRef = useRef(false)
  const [state, setState] = useState<RoomMediaSessionState>(
    createEmptyRoomMediaSessionState,
  )
  const {
    mediaPreferences: {
      selectedVideoDeviceId,
      selectedAudioInputDeviceId,
      videoEnabled,
      audioEnabled,
    },
  } = useMediaStreams()
  const mediaPreferencesRef = useRef({
    selectedVideoDeviceId,
    selectedAudioInputDeviceId,
    videoEnabled,
    audioEnabled,
  })

  useEffect(() => {
    mediaPreferencesRef.current = {
      selectedVideoDeviceId,
      selectedAudioInputDeviceId,
      videoEnabled,
      audioEnabled,
    }
  }, [
    selectedVideoDeviceId,
    selectedAudioInputDeviceId,
    videoEnabled,
    audioEnabled,
  ])

  useEffect(() => {
    if (!enabled || !roomId || !sessionId) {
      adapterRef.current?.disconnect()
      adapterRef.current = null
      isConnectedRef.current = false
      queueMicrotask(() => setState(createEmptyRoomMediaSessionState()))
      return
    }

    let cancelled = false
    const adapter = createLiveKitMediaAdapter({
      sessionId,
      onStateChange: (nextState) => {
        if (!cancelled) {
          setState(nextState)
        }
      },
    })
    adapterRef.current = adapter

    issueLiveKitToken({ roomId, sessionId })
      .then(async ({ serverUrl, token }) => {
        if (cancelled) return
        await adapter.connect(serverUrl, token)
        if (cancelled) return
        isConnectedRef.current = true
        const preferences = mediaPreferencesRef.current
        await Promise.all([
          adapter.setCameraEnabled(
            preferences.videoEnabled,
            preferences.selectedVideoDeviceId,
          ),
          adapter.setMicrophoneEnabled(
            preferences.audioEnabled,
            preferences.selectedAudioInputDeviceId,
          ),
        ])
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const lastError =
          error instanceof Error ? error : new Error(String(error))
        setState((current) => ({
          ...current,
          lastError,
          diagnostics: createMediaDiagnosticsSnapshot({
            ...current,
            lastError,
          }),
        }))
      })

    return () => {
      cancelled = true
      isConnectedRef.current = false
      adapter.disconnect()
      if (adapterRef.current === adapter) {
        adapterRef.current = null
      }
    }
  }, [enabled, roomId, sessionId, issueLiveKitToken])

  useEffect(() => {
    if (!enabled || !adapterRef.current || !isConnectedRef.current) return

    adapterRef.current
      .setCameraEnabled(videoEnabled, selectedVideoDeviceId)
      .catch((error: unknown) => {
        const lastError =
          error instanceof Error ? error : new Error(String(error))
        setState((current) => ({
          ...current,
          lastError,
          diagnostics: createMediaDiagnosticsSnapshot({
            ...current,
            lastError,
          }),
        }))
      })
  }, [enabled, videoEnabled, selectedVideoDeviceId])

  useEffect(() => {
    if (!enabled || !adapterRef.current || !isConnectedRef.current) return

    adapterRef.current
      .setMicrophoneEnabled(audioEnabled, selectedAudioInputDeviceId)
      .catch((error: unknown) => {
        const lastError =
          error instanceof Error ? error : new Error(String(error))
        setState((current) => ({
          ...current,
          lastError,
          diagnostics: createMediaDiagnosticsSnapshot({
            ...current,
            lastError,
          }),
        }))
      })
  }, [enabled, audioEnabled, selectedAudioInputDeviceId])

  const controls = useMemo<RoomMediaControls>(
    () => ({
      setCameraEnabled: async (nextEnabled) => {
        await adapterRef.current?.setCameraEnabled(
          nextEnabled,
          selectedVideoDeviceId,
        )
      },
      setMicrophoneEnabled: async (nextEnabled) => {
        await adapterRef.current?.setMicrophoneEnabled(
          nextEnabled,
          selectedAudioInputDeviceId,
        )
      },
    }),
    [selectedVideoDeviceId, selectedAudioInputDeviceId],
  )

  return {
    ...state,
    controls,
  }
}

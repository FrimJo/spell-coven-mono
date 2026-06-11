import type { RoomMediaSessionState } from '@/types/media-session'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { createLiveKitMediaAdapter } from '@/lib/media/livekit-adapter'
import { api } from '@convex/_generated/api'
import { useAction } from 'convex/react'

function createEmptyRoomMediaSessionState(): RoomMediaSessionState {
  return {
    connectionState: 'disconnected',
    isReconnecting: false,
    local: null,
    remotes: new Map(),
    lastError: null,
    lastDisconnectReason: null,
  }
}

function toMediaError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
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
}: UseRoomMediaSessionOptions): RoomMediaSessionState {
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

  const reportError = useCallback((error: unknown) => {
    const mediaError = toMediaError(error)
    if (adapterRef.current) {
      adapterRef.current.reportError(mediaError)
      return
    }

    setState((current) => ({
      ...current,
      lastError: mediaError,
    }))
  }, [])

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
        reportError(error)
      })

    return () => {
      cancelled = true
      isConnectedRef.current = false
      adapter.disconnect()
      adapterRef.current = null
      setState(createEmptyRoomMediaSessionState())
    }
  }, [enabled, roomId, sessionId, issueLiveKitToken, reportError])

  useEffect(() => {
    if (!enabled || !adapterRef.current || !isConnectedRef.current) return

    adapterRef.current
      .setCameraEnabled(videoEnabled, selectedVideoDeviceId)
      .catch(reportError)
  }, [enabled, videoEnabled, selectedVideoDeviceId, reportError])

  useEffect(() => {
    if (!enabled || !adapterRef.current || !isConnectedRef.current) return

    adapterRef.current
      .setMicrophoneEnabled(audioEnabled, selectedAudioInputDeviceId)
      .catch(reportError)
  }, [enabled, audioEnabled, selectedAudioInputDeviceId, reportError])

  return state
}

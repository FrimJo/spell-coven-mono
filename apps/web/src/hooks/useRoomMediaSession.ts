import type { LiveKitMediaAdapter } from '@/lib/media/livekit-adapter'
import type { RoomMediaSessionState } from '@/types/media-session'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import {
  captureAppException,
  startAppSpan,
} from '@/integrations/sentry/reporting'
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
  const adapterRef = useRef<LiveKitMediaAdapter | null>(null)
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

  const reportError = useCallback((error: unknown) => {
    adapterRef.current?.reportError(toMediaError(error))
  }, [])

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

    startAppSpan({ name: 'Issue LiveKit token', op: 'convex.action' }, () =>
      issueLiveKitToken({ roomId, sessionId }),
    )
      .then(async ({ serverUrl, token }) => {
        if (cancelled) return
        await adapter.connect(serverUrl, token)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        captureAppException(error, {
          tags: { feature: 'media', operation: 'start_livekit_session' },
        })
        reportError(error)
      })

    return () => {
      cancelled = true
      adapter.disconnect()
      adapterRef.current = null
      setState(createEmptyRoomMediaSessionState())
    }
  }, [enabled, roomId, sessionId, issueLiveKitToken, reportError])

  const canSync = enabled && state.connectionState === 'connected'

  useEffect(() => {
    if (!canSync || !adapterRef.current) return

    void adapterRef.current
      .setCameraEnabled(videoEnabled, selectedVideoDeviceId)
      .catch(reportError)
  }, [canSync, videoEnabled, selectedVideoDeviceId, reportError])

  useEffect(() => {
    if (!canSync || !adapterRef.current) return

    void adapterRef.current
      .setMicrophoneEnabled(audioEnabled, selectedAudioInputDeviceId)
      .catch(reportError)
  }, [canSync, audioEnabled, selectedAudioInputDeviceId, reportError])

  return state
}

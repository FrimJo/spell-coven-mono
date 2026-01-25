/**
 * MediaStreamContext - Centralized media stream management for game sessions
 *
 * This context manages video and audio streams at the page level, ensuring:
 * - Streams are shared across all components (VideoStreamGrid, MediaSetupDialog)
 * - Cleanup only happens when navigating away from the game page
 * - No stream interruption when opening/closing modals
 */
import type { UseMediaDeviceReturn } from '@/hooks/useMediaDevice'
import type { BrowserPermissionState } from '@/hooks/useMediaPermissions'
import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
} from 'react'
import { useMediaDevice } from '@/hooks/useMediaDevice'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { stopMediaStream } from '@/lib/media-stream-manager'
import { isSuccessState } from '@/types/async-resource'

interface MediaStreamContextValue {
  // Video stream management
  video: UseMediaDeviceReturn
  // Audio stream management
  audio: UseMediaDeviceReturn
  // Combined stream for WebRTC (video + audio tracks)
  combinedStream: MediaStream | null
  // Toggle functions
  toggleVideo: (enabled: boolean) => Promise<void>
  toggleAudio: (enabled: boolean) => void
  // Permission states
  permissions: {
    camera: {
      browserState: BrowserPermissionState | 'checking'
      shouldShowDialog: boolean
    }
    microphone: {
      browserState: BrowserPermissionState | 'checking'
      shouldShowDialog: boolean
    }
    isChecking: boolean
    needsPermissionDialog: boolean
    permissionsBlocked: boolean
    permissionsGranted: boolean
    recheckPermissions: () => Promise<void>
  }
}

const MediaStreamContext = createContext<MediaStreamContextValue | null>(null)

interface MediaStreamProviderProps {
  children: ReactNode
}

export function MediaStreamProvider({ children }: MediaStreamProviderProps) {
  // Check media permissions first - this determines if we show permission dialog
  const {
    camera: cameraPermission,
    microphone: microphonePermission,
    isChecking: isCheckingPermissions,
    recheckPermissions,
  } = useMediaPermissions()

  // Determine permission states
  const needsPermissionDialog =
    !isCheckingPermissions &&
    (cameraPermission.shouldShowDialog || microphonePermission.shouldShowDialog)

  const permissionsBlocked =
    !isCheckingPermissions &&
    (cameraPermission.browserState === 'denied' ||
      microphonePermission.browserState === 'denied')

  // Permissions are granted if:
  // - Microphone is granted (required for audio chat)
  // - Camera is either granted OR still at "prompt" state (which happens when macOS blocks video access)
  // When macOS blocks camera at system level, browser reports "prompt" but no video devices exist.
  // In this case, we should still allow the user to proceed with audio-only functionality.
  const microphoneGranted =
    !isCheckingPermissions && microphonePermission.browserState === 'granted'
  const cameraGrantedOrUnavailable =
    !isCheckingPermissions &&
    (cameraPermission.browserState === 'granted' ||
      cameraPermission.browserState === 'prompt')

  const permissionsGranted = microphoneGranted && cameraGrantedOrUnavailable

  // Use media device hooks - these are the ONLY instances in the app
  // Cleanup will happen when this provider unmounts (navigating away from game page)
  const videoResult = useMediaDevice({
    kind: 'videoinput',
    enabled: permissionsGranted,
  })

  const audioResult = useMediaDevice({
    kind: 'audioinput',
    enabled: permissionsGranted,
  })

  // Combine streams into a single MediaStream for WebRTC
  const combinedStream = useMemo((): MediaStream | null => {
    if (!isSuccessState(videoResult) || !isSuccessState(audioResult)) {
      return null
    }

    const video = videoResult.stream
    const audio = audioResult.stream

    const tracks: MediaStreamTrack[] = []
    if (video) tracks.push(...video.getVideoTracks())
    if (audio) tracks.push(...audio.getAudioTracks())

    if (tracks.length === 0) return null

    return new MediaStream(tracks)
  }, [videoResult, audioResult])

  // Toggle video tracks
  const toggleVideo = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (combinedStream) {
        combinedStream.getVideoTracks().forEach((t) => (t.enabled = enabled))
      }
    },
    [combinedStream],
  )

  // Toggle audio tracks
  const toggleAudio = useCallback(
    (enabled: boolean) => {
      if (combinedStream) {
        combinedStream.getAudioTracks().forEach((t) => (t.enabled = enabled))
      }
    },
    [combinedStream],
  )

  const onStreamUnmount = useEffectEvent(() => {
    console.log('[MediaStreamProvider] Unmounting, cleaning up all streams')
    if (isSuccessState(videoResult) && videoResult.stream) {
      stopMediaStream(videoResult.stream)
    }
    if (isSuccessState(audioResult) && audioResult.stream) {
      stopMediaStream(audioResult.stream)
    }
  })

  // Cleanup streams when provider unmounts (user navigates away)
  useEffect(() => onStreamUnmount, [])

  const value = useMemo<MediaStreamContextValue>(
    () => ({
      video: videoResult,
      audio: audioResult,
      combinedStream,
      toggleVideo,
      toggleAudio,
      permissions: {
        camera: {
          browserState: isCheckingPermissions
            ? 'checking'
            : cameraPermission.browserState,
          shouldShowDialog: cameraPermission.shouldShowDialog,
        },
        microphone: {
          browserState: isCheckingPermissions
            ? 'checking'
            : microphonePermission.browserState,
          shouldShowDialog: microphonePermission.shouldShowDialog,
        },
        isChecking: isCheckingPermissions,
        needsPermissionDialog,
        permissionsBlocked,
        permissionsGranted,
        recheckPermissions,
      },
    }),
    [
      videoResult,
      audioResult,
      combinedStream,
      toggleVideo,
      toggleAudio,
      isCheckingPermissions,
      cameraPermission,
      microphonePermission,
      needsPermissionDialog,
      permissionsBlocked,
      permissionsGranted,
      recheckPermissions,
    ],
  )

  return (
    <MediaStreamContext.Provider value={value}>
      {children}
    </MediaStreamContext.Provider>
  )
}

/**
 * Hook to access media streams from the context.
 * Must be used within a MediaStreamProvider.
 */
export function useMediaStreams(): MediaStreamContextValue {
  const context = useContext(MediaStreamContext)
  if (!context) {
    throw new Error('useMediaStreams must be used within a MediaStreamProvider')
  }
  return context
}

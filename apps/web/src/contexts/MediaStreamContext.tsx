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
  useRef,
} from 'react'
import { useMediaDevice } from '@/hooks/useMediaDevice'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { useMediaEnabledState } from '@/hooks/useSelectedMediaDevice'
import { stopMediaStream } from '@/lib/media-stream-manager'
import { isSuccessState } from '@/types/async-resource'

interface MediaStreamContextValue {
  // Video stream management
  video: UseMediaDeviceReturn
  // Audio stream management
  audio: UseMediaDeviceReturn
  // Combined stream for WebRTC (video + audio tracks)
  combinedStream: MediaStream | null
  // Toggle functions (for runtime toggling during a session)
  toggleVideo: (enabled: boolean) => Promise<void>
  toggleAudio: (enabled: boolean) => void
  // User preferences for camera/mic enabled (persisted to localStorage)
  mediaPreferences: {
    videoEnabled: boolean
    audioEnabled: boolean
    setVideoEnabled: (enabled: boolean) => void
    setAudioEnabled: (enabled: boolean) => void
  }
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

  // Get user's preferences for camera/mic enabled state (persisted to localStorage)
  const { videoEnabled, audioEnabled, setVideoEnabled, setAudioEnabled } =
    useMediaEnabledState()

  // Use media device hooks - these are the ONLY instances in the app
  // Cleanup will happen when this provider unmounts (navigating away from game page)
  // Only enable stream acquisition if permissions are granted AND the user has enabled the device
  const videoResult = useMediaDevice({
    kind: 'videoinput',
    enabled: permissionsGranted && videoEnabled,
  })

  const audioResult = useMediaDevice({
    kind: 'audioinput',
    enabled: permissionsGranted && audioEnabled,
  })

  // Combine streams into a single MediaStream for WebRTC
  // Handle cases where video or audio is intentionally disabled
  // Only include 'live' tracks to avoid using stopped/ended tracks from cache
  const combinedStream = useMemo((): MediaStream | null => {
    const tracks: MediaStreamTrack[] = []

    // Add video tracks if video is enabled and stream is available
    // Filter to only 'live' tracks (excludes stopped tracks from cache)
    if (videoEnabled && isSuccessState(videoResult) && videoResult.stream) {
      const liveTracks = videoResult.stream
        .getVideoTracks()
        .filter((track) => track.readyState === 'live')
      tracks.push(...liveTracks)
    }

    // Add audio tracks if audio is enabled and stream is available
    // Filter to only 'live' tracks (excludes stopped tracks from cache)
    if (audioEnabled && isSuccessState(audioResult) && audioResult.stream) {
      const liveTracks = audioResult.stream
        .getAudioTracks()
        .filter((track) => track.readyState === 'live')
      tracks.push(...liveTracks)
    }

    if (tracks.length === 0) return null

    return new MediaStream(tracks)
  }, [videoResult, audioResult, videoEnabled, audioEnabled])

  // Use refs to avoid recreating callbacks when results change
  const videoResultRef = useRef(videoResult)
  const audioResultRef = useRef(audioResult)
  
  useEffect(() => {
    videoResultRef.current = videoResult
  }, [videoResult])
  
  useEffect(() => {
    audioResultRef.current = audioResult
  }, [audioResult])

  // Toggle video - releases hardware when disabled, re-acquires when enabled
  const toggleVideo = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (!enabled) {
        // Stop video tracks to release camera hardware
        const currentVideoResult = videoResultRef.current
        if (isSuccessState(currentVideoResult) && currentVideoResult.stream) {
          currentVideoResult.stream.getVideoTracks().forEach((track: MediaStreamTrack) => {
            track.stop()
            console.log(
              '[MediaStreamProvider] Stopped video track to release camera',
            )
          })
        }
      }
      // Update preference - this controls whether useMediaDevice acquires a new stream
      setVideoEnabled(enabled)
    },
    [setVideoEnabled],
  )

  // Toggle audio - releases hardware when disabled, re-acquires when enabled
  const toggleAudio = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        // Stop audio tracks to release microphone hardware
        const currentAudioResult = audioResultRef.current
        if (isSuccessState(currentAudioResult) && currentAudioResult.stream) {
          currentAudioResult.stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
            track.stop()
            console.log(
              '[MediaStreamProvider] Stopped audio track to release microphone',
            )
          })
        }
      }
      // Update preference - this controls whether useMediaDevice acquires a new stream
      setAudioEnabled(enabled)
    },
    [setAudioEnabled],
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
      mediaPreferences: {
        videoEnabled,
        audioEnabled,
        setVideoEnabled,
        setAudioEnabled,
      },
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
      videoEnabled,
      audioEnabled,
      setVideoEnabled,
      setAudioEnabled,
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

/**
 * MediaStreamContext - Centralized media stream and preference management
 *
 * Streams and device selections are owned at the page/session boundary so the
 * setup flow and the in-room controls share the same source of truth.
 */
import type { UseAudioOutputReturn } from '@/hooks/useAudioOutput'
import type { UseMediaDeviceReturn } from '@/hooks/useMediaDevice'
import type { BrowserPermissionState } from '@/hooks/useMediaPermissions'
import type {
  MediaPreferencesSnapshot,
  MediaPreferenceStore,
} from '@/hooks/useMediaPreferenceStore'
import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { useAudioOutput } from '@/hooks/useAudioOutput'
import { useMediaDevice } from '@/hooks/useMediaDevice'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { useMediaPreferenceStore } from '@/hooks/useMediaPreferenceStore'
import { stopMediaStream } from '@/lib/media-stream-manager'
import { isSuccessState } from '@/types/async-resource'

interface MediaStreamContextValue {
  video: UseMediaDeviceReturn
  audio: UseMediaDeviceReturn
  audioOutput: Pick<
    UseAudioOutputReturn,
    | 'devices'
    | 'currentDeviceId'
    | 'testOutput'
    | 'isTesting'
    | 'isSupported'
    | 'error'
    | 'isLoading'
    | 'refreshDevices'
  > & {
    setOutputDevice: (deviceId: string) => Promise<void>
  }
  combinedStream: MediaStream | null
  toggleVideo: (enabled: boolean) => Promise<void>
  toggleAudio: (enabled: boolean) => void
  mediaPreferences: Pick<
    MediaPreferenceStore,
    | 'selectedVideoDeviceId'
    | 'selectedAudioInputDeviceId'
    | 'selectedAudioOutputDeviceId'
    | 'videoEnabled'
    | 'audioEnabled'
    | 'hasCommitted'
    | 'setVideoEnabled'
    | 'setAudioEnabled'
    | 'captureSnapshot'
    | 'commitPreferences'
  > & {
    setSelectedVideoDeviceId: (deviceId: string) => void
    setSelectedAudioInputDeviceId: (deviceId: string) => void
    setSelectedAudioOutputDeviceId: (deviceId: string) => Promise<void>
    restoreSnapshot: (snapshot: MediaPreferencesSnapshot) => void
  }
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
  const {
    camera: cameraPermission,
    microphone: microphonePermission,
    isChecking: isCheckingPermissions,
    recheckPermissions,
  } = useMediaPermissions()

  const needsPermissionDialog =
    !isCheckingPermissions &&
    (cameraPermission.shouldShowDialog || microphonePermission.shouldShowDialog)

  const permissionsBlocked =
    !isCheckingPermissions &&
    (cameraPermission.browserState === 'denied' ||
      microphonePermission.browserState === 'denied')

  const microphoneGranted =
    !isCheckingPermissions && microphonePermission.browserState === 'granted'
  const cameraGrantedOrUnavailable =
    !isCheckingPermissions &&
    (cameraPermission.browserState === 'granted' ||
      cameraPermission.browserState === 'prompt')

  const permissionsGranted = microphoneGranted && cameraGrantedOrUnavailable

  const mediaPreferences = useMediaPreferenceStore()

  const videoResult = useMediaDevice({
    kind: 'videoinput',
    selectedDeviceId: mediaPreferences.selectedVideoDeviceId,
    enabled: permissionsGranted && mediaPreferences.videoEnabled,
  })

  const audioResult = useMediaDevice({
    kind: 'audioinput',
    selectedDeviceId: mediaPreferences.selectedAudioInputDeviceId,
    enabled: permissionsGranted && mediaPreferences.audioEnabled,
  })

  const audioOutputState = useAudioOutput({
    initialDeviceId: mediaPreferences.selectedAudioOutputDeviceId ?? 'default',
  })

  useEffect(() => {
    const nextDeviceId = videoResult.selectedDeviceId || null
    if (
      nextDeviceId &&
      nextDeviceId !== mediaPreferences.selectedVideoDeviceId
    ) {
      mediaPreferences.setSelectedVideoDeviceId(nextDeviceId)
    }
  }, [videoResult.selectedDeviceId, mediaPreferences])

  useEffect(() => {
    const nextDeviceId = audioResult.selectedDeviceId || null
    if (
      nextDeviceId &&
      nextDeviceId !== mediaPreferences.selectedAudioInputDeviceId
    ) {
      mediaPreferences.setSelectedAudioInputDeviceId(nextDeviceId)
    }
  }, [audioResult.selectedDeviceId, mediaPreferences])

  useEffect(() => {
    const currentDeviceId = audioOutputState.currentDeviceId || null
    if (
      currentDeviceId &&
      currentDeviceId !== mediaPreferences.selectedAudioOutputDeviceId
    ) {
      mediaPreferences.setSelectedAudioOutputDeviceId(currentDeviceId)
    }
  }, [audioOutputState.currentDeviceId, mediaPreferences])

  useEffect(() => {
    const desiredDeviceId =
      mediaPreferences.selectedAudioOutputDeviceId ?? 'default'

    if (
      audioOutputState.devices.length > 0 &&
      desiredDeviceId !== audioOutputState.currentDeviceId
    ) {
      void audioOutputState.setOutputDevice(desiredDeviceId).catch(() => {})
    }
  }, [mediaPreferences, audioOutputState])

  const setSelectedAudioOutputDeviceId = useCallback(
    async (deviceId: string) => {
      mediaPreferences.setSelectedAudioOutputDeviceId(deviceId)
      await audioOutputState.setOutputDevice(deviceId)
    },
    [mediaPreferences, audioOutputState],
  )

  const restoreSnapshot = useCallback(
    (snapshot: MediaPreferencesSnapshot) => {
      mediaPreferences.restoreSnapshot(snapshot)
      const outputDeviceId = snapshot.selectedAudioOutputDeviceId

      if (outputDeviceId) {
        void audioOutputState.setOutputDevice(outputDeviceId).catch(() => {})
      }
    },
    [mediaPreferences, audioOutputState],
  )

  const combinedStream = useMemo((): MediaStream | null => {
    const tracks: MediaStreamTrack[] = []

    const hasVideo =
      mediaPreferences.videoEnabled &&
      isSuccessState(videoResult) &&
      videoResult.stream
    const hasAudio =
      mediaPreferences.audioEnabled &&
      isSuccessState(audioResult) &&
      audioResult.stream

    if (mediaPreferences.videoEnabled && mediaPreferences.audioEnabled) {
      if (!hasVideo || !hasAudio) {
        return null
      }
    }

    if (hasVideo && isSuccessState(videoResult) && videoResult.stream) {
      tracks.push(
        ...videoResult.stream
          .getVideoTracks()
          .filter((track) => track.readyState === 'live'),
      )
    }

    if (hasAudio && isSuccessState(audioResult) && audioResult.stream) {
      tracks.push(
        ...audioResult.stream
          .getAudioTracks()
          .filter((track) => track.readyState === 'live'),
      )
    }

    return tracks.length === 0 ? null : new MediaStream(tracks)
  }, [videoResult, audioResult, mediaPreferences])

  const videoResultRef = useRef(videoResult)
  const audioResultRef = useRef(audioResult)

  useEffect(() => {
    videoResultRef.current = videoResult
  }, [videoResult])

  useEffect(() => {
    audioResultRef.current = audioResult
  }, [audioResult])

  const toggleVideo = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (!enabled) {
        const currentVideoResult = videoResultRef.current
        if (isSuccessState(currentVideoResult) && currentVideoResult.stream) {
          currentVideoResult.stream
            .getVideoTracks()
            .forEach((track) => track.stop())
        }
      }

      mediaPreferences.setVideoEnabled(enabled)
    },
    [mediaPreferences],
  )

  const toggleAudio = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        const currentAudioResult = audioResultRef.current
        if (isSuccessState(currentAudioResult) && currentAudioResult.stream) {
          currentAudioResult.stream
            .getAudioTracks()
            .forEach((track) => track.stop())
        }
      }

      mediaPreferences.setAudioEnabled(enabled)
    },
    [mediaPreferences],
  )

  useEffect(() => {
    return () => {
      if (isSuccessState(videoResult) && videoResult.stream) {
        stopMediaStream(videoResult.stream)
      }
      if (isSuccessState(audioResult) && audioResult.stream) {
        stopMediaStream(audioResult.stream)
      }
    }
  }, [videoResult, audioResult])

  const value = useMemo<MediaStreamContextValue>(
    () => ({
      video: videoResult,
      audio: audioResult,
      audioOutput: {
        devices: audioOutputState.devices,
        currentDeviceId:
          mediaPreferences.selectedAudioOutputDeviceId ??
          audioOutputState.currentDeviceId,
        setOutputDevice: setSelectedAudioOutputDeviceId,
        testOutput: audioOutputState.testOutput,
        isTesting: audioOutputState.isTesting,
        isSupported: audioOutputState.isSupported,
        error: audioOutputState.error,
        isLoading: audioOutputState.isLoading,
        refreshDevices: audioOutputState.refreshDevices,
      },
      combinedStream,
      toggleVideo,
      toggleAudio,
      mediaPreferences: {
        selectedVideoDeviceId: mediaPreferences.selectedVideoDeviceId,
        selectedAudioInputDeviceId: mediaPreferences.selectedAudioInputDeviceId,
        selectedAudioOutputDeviceId:
          mediaPreferences.selectedAudioOutputDeviceId,
        videoEnabled: mediaPreferences.videoEnabled,
        audioEnabled: mediaPreferences.audioEnabled,
        hasCommitted: mediaPreferences.hasCommitted,
        setSelectedVideoDeviceId: (deviceId: string) =>
          mediaPreferences.setSelectedVideoDeviceId(deviceId),
        setSelectedAudioInputDeviceId: (deviceId: string) =>
          mediaPreferences.setSelectedAudioInputDeviceId(deviceId),
        setSelectedAudioOutputDeviceId,
        setVideoEnabled: mediaPreferences.setVideoEnabled,
        setAudioEnabled: mediaPreferences.setAudioEnabled,
        captureSnapshot: mediaPreferences.captureSnapshot,
        restoreSnapshot,
        commitPreferences: mediaPreferences.commitPreferences,
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
      audioOutputState,
      combinedStream,
      toggleVideo,
      toggleAudio,
      mediaPreferences,
      restoreSnapshot,
      setSelectedAudioOutputDeviceId,
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

export function useMediaStreams(): MediaStreamContextValue {
  const context = useContext(MediaStreamContext)
  if (!context) {
    throw new Error('useMediaStreams must be used within a MediaStreamProvider')
  }
  return context
}

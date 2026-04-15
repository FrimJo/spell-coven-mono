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
import { useLocalMediaSession } from '@/hooks/useLocalMediaSession'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { useMediaPreferenceStore } from '@/hooks/useMediaPreferenceStore'

interface MediaStreamContextValue {
  video: UseMediaDeviceReturn
  audio: UseMediaDeviceReturn
  previewStream: MediaStream
  localMediaSession: {
    previewStream: MediaStream
    videoTrack: MediaStreamTrack | null
    audioTrack: MediaStreamTrack | null
  }
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

function createVideoResource({
  devices,
  selectedDeviceId,
  track,
  actualResolution,
  isPending,
  error,
}: {
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  track: MediaStreamTrack | null
  actualResolution: '1080p' | 'basic' | 'none'
  isPending: boolean
  error: Error | null
}): UseMediaDeviceReturn {
  const base = {
    devices,
    selectedDeviceId,
  }
  const stream = track ? new MediaStream([track]) : undefined

  if (isPending) {
    return {
      ...base,
      isPending: true,
      error,
      stream: undefined,
      videoTrack: undefined,
      audioTrack: undefined,
      actualResolution: undefined,
    }
  }

  if (error) {
    return {
      ...base,
      isPending: false,
      error,
      stream: undefined,
      videoTrack: undefined,
      audioTrack: undefined,
      actualResolution: undefined,
    }
  }

  return {
    ...base,
    isPending: false,
    error: null,
    stream,
    videoTrack: track,
    audioTrack: null,
    actualResolution: track ? actualResolution : 'none',
  } as UseMediaDeviceReturn
}

function createAudioResource({
  devices,
  selectedDeviceId,
  track,
  isPending,
  error,
}: {
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  track: MediaStreamTrack | null
  isPending: boolean
  error: Error | null
}): UseMediaDeviceReturn {
  const base = {
    devices,
    selectedDeviceId,
  }
  const stream = track ? new MediaStream([track]) : undefined

  if (isPending) {
    return {
      ...base,
      isPending: true,
      error,
      stream: undefined,
      videoTrack: undefined,
      audioTrack: undefined,
      actualResolution: undefined,
    }
  }

  if (error) {
    return {
      ...base,
      isPending: false,
      error,
      stream: undefined,
      videoTrack: undefined,
      audioTrack: undefined,
      actualResolution: undefined,
    }
  }

  return {
    ...base,
    isPending: false,
    error: null,
    stream,
    videoTrack: null,
    audioTrack: track,
    actualResolution: 'none',
  } as UseMediaDeviceReturn
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

  const localMediaSession = useLocalMediaSession({
    permissionsGranted,
    videoEnabled: mediaPreferences.videoEnabled,
    selectedVideoDeviceId: mediaPreferences.selectedVideoDeviceId,
    selectedAudioInputDeviceId: mediaPreferences.selectedAudioInputDeviceId,
  })

  const audioOutputState = useAudioOutput({
    initialDeviceId: mediaPreferences.selectedAudioOutputDeviceId ?? 'default',
  })

  useEffect(() => {
    const nextDeviceId = localMediaSession.selectedVideoDeviceId || null
    if (
      nextDeviceId &&
      nextDeviceId !== mediaPreferences.selectedVideoDeviceId
    ) {
      mediaPreferences.setSelectedVideoDeviceId(nextDeviceId)
    }
  }, [localMediaSession.selectedVideoDeviceId, mediaPreferences])

  useEffect(() => {
    const nextDeviceId = localMediaSession.selectedAudioInputDeviceId || null
    if (
      nextDeviceId &&
      nextDeviceId !== mediaPreferences.selectedAudioInputDeviceId
    ) {
      mediaPreferences.setSelectedAudioInputDeviceId(nextDeviceId)
    }
  }, [localMediaSession.selectedAudioInputDeviceId, mediaPreferences])

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
      localMediaSession.videoTrack &&
      localMediaSession.videoTrack.readyState === 'live'
    const hasAudio =
      mediaPreferences.audioEnabled &&
      localMediaSession.audioTrack &&
      localMediaSession.audioTrack.readyState === 'live'

    if (mediaPreferences.videoEnabled && mediaPreferences.audioEnabled) {
      if (!hasVideo || !hasAudio) {
        return null
      }
    }

    if (hasVideo && localMediaSession.videoTrack) {
      tracks.push(localMediaSession.videoTrack)
    }

    if (hasAudio && localMediaSession.audioTrack) {
      tracks.push(localMediaSession.audioTrack)
    }

    return tracks.length === 0 ? null : new MediaStream(tracks)
  }, [
    localMediaSession.audioTrack,
    localMediaSession.videoTrack,
    mediaPreferences.audioEnabled,
    mediaPreferences.videoEnabled,
  ])

  const videoTrackRef = useRef(localMediaSession.videoTrack)
  useEffect(() => {
    videoTrackRef.current = localMediaSession.videoTrack
  }, [localMediaSession.videoTrack])

  const toggleVideo = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (!enabled) {
        videoTrackRef.current?.stop()
      }

      mediaPreferences.setVideoEnabled(enabled)
    },
    [mediaPreferences],
  )

  const toggleAudio = useCallback(
    (enabled: boolean) => {
      mediaPreferences.setAudioEnabled(enabled)
    },
    [mediaPreferences],
  )

  const videoResult = useMemo(
    () =>
      createVideoResource({
        devices: localMediaSession.devices.videoinput,
        selectedDeviceId: localMediaSession.selectedVideoDeviceId,
        track: localMediaSession.video.track,
        actualResolution: localMediaSession.video.actualResolution,
        isPending: localMediaSession.video.isPending,
        error: localMediaSession.video.error,
      }),
    [localMediaSession],
  )

  const audioResult = useMemo(
    () =>
      createAudioResource({
        devices: localMediaSession.devices.audioinput,
        selectedDeviceId: localMediaSession.selectedAudioInputDeviceId,
        track: localMediaSession.audio.track,
        isPending: localMediaSession.audio.isPending,
        error: localMediaSession.audio.error,
      }),
    [localMediaSession],
  )

  const value = useMemo<MediaStreamContextValue>(
    () => ({
      video: videoResult,
      audio: audioResult,
      previewStream: localMediaSession.previewStream,
      localMediaSession: {
        previewStream: localMediaSession.previewStream,
        videoTrack: localMediaSession.videoTrack,
        audioTrack: localMediaSession.audioTrack,
      },
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
      localMediaSession,
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

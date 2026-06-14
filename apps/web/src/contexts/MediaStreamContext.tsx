/**
 * MediaStreamContext - Centralized media preference and permission management
 *
 * Device preview capture lives in setup UI only (useMediaSetupController).
 * In-room media is owned by LiveKit via useRoomMediaSession.
 */
import type { UseAudioOutputReturn } from '@/hooks/useAudioOutput'
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
} from 'react'
import { useAudioOutput } from '@/hooks/useAudioOutput'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { useMediaPreferenceStore } from '@/hooks/useMediaPreferenceStore'

interface MediaStreamContextValue {
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
  const {
    selectedAudioOutputDeviceId,
    setSelectedAudioOutputDeviceId: setStoredAudioOutputDeviceId,
    restoreSnapshot: restoreMediaPreferencesSnapshot,
  } = mediaPreferences

  const audioOutputState = useAudioOutput({
    initialDeviceId: selectedAudioOutputDeviceId ?? 'default',
  })
  const {
    devices: audioOutputDevices,
    currentDeviceId: currentAudioOutputDeviceId,
    setOutputDevice,
    testOutput,
    isTesting,
    isSupported,
    error,
    isLoading,
    refreshDevices,
  } = audioOutputState

  useEffect(() => {
    const currentDeviceId = currentAudioOutputDeviceId || null
    // Seed persisted output only when the user has not chosen one yet. Once
    // selectedAudioOutputDeviceId is set, later browser active-device changes
    // must not overwrite that explicit preference.
    if (currentDeviceId && selectedAudioOutputDeviceId === null) {
      setStoredAudioOutputDeviceId(currentDeviceId)
    }
  }, [
    currentAudioOutputDeviceId,
    selectedAudioOutputDeviceId,
    setStoredAudioOutputDeviceId,
  ])

  useEffect(() => {
    const desiredDeviceId = selectedAudioOutputDeviceId ?? 'default'

    if (
      audioOutputDevices.length > 0 &&
      desiredDeviceId !== currentAudioOutputDeviceId
    ) {
      void setOutputDevice(desiredDeviceId).catch(() => {})
    }
  }, [
    selectedAudioOutputDeviceId,
    audioOutputDevices.length,
    currentAudioOutputDeviceId,
    setOutputDevice,
  ])

  const setSelectedAudioOutputDeviceId = useCallback(
    async (deviceId: string) => {
      setStoredAudioOutputDeviceId(deviceId)
      await setOutputDevice(deviceId)
    },
    [setStoredAudioOutputDeviceId, setOutputDevice],
  )

  const restoreSnapshot = useCallback(
    (snapshot: MediaPreferencesSnapshot) => {
      restoreMediaPreferencesSnapshot(snapshot)
      const outputDeviceId = snapshot.selectedAudioOutputDeviceId

      if (outputDeviceId) {
        void setOutputDevice(outputDeviceId).catch(() => {})
      }
    },
    [restoreMediaPreferencesSnapshot, setOutputDevice],
  )

  const mediaPreferencesForContext = useMemo(
    () => ({
      ...mediaPreferences,
      setSelectedAudioOutputDeviceId,
      restoreSnapshot,
    }),
    [mediaPreferences, setSelectedAudioOutputDeviceId, restoreSnapshot],
  )

  const audioOutputForContext = useMemo(
    () => ({
      devices: audioOutputDevices,
      currentDeviceId:
        selectedAudioOutputDeviceId ?? currentAudioOutputDeviceId,
      setOutputDevice: setSelectedAudioOutputDeviceId,
      testOutput,
      isTesting,
      isSupported,
      error,
      isLoading,
      refreshDevices,
    }),
    [
      audioOutputDevices,
      currentAudioOutputDeviceId,
      testOutput,
      isTesting,
      isSupported,
      error,
      isLoading,
      refreshDevices,
      selectedAudioOutputDeviceId,
      setSelectedAudioOutputDeviceId,
    ],
  )

  const permissionsForContext = useMemo(
    () => ({
      camera: {
        browserState: isCheckingPermissions
          ? ('checking' as const)
          : cameraPermission.browserState,
        shouldShowDialog: cameraPermission.shouldShowDialog,
      },
      microphone: {
        browserState: isCheckingPermissions
          ? ('checking' as const)
          : microphonePermission.browserState,
        shouldShowDialog: microphonePermission.shouldShowDialog,
      },
      isChecking: isCheckingPermissions,
      needsPermissionDialog,
      permissionsBlocked,
      permissionsGranted,
      recheckPermissions,
    }),
    [
      isCheckingPermissions,
      cameraPermission.browserState,
      cameraPermission.shouldShowDialog,
      microphonePermission.browserState,
      microphonePermission.shouldShowDialog,
      needsPermissionDialog,
      permissionsBlocked,
      permissionsGranted,
      recheckPermissions,
    ],
  )

  const value = useMemo<MediaStreamContextValue>(
    () => ({
      audioOutput: audioOutputForContext,
      mediaPreferences: mediaPreferencesForContext,
      permissions: permissionsForContext,
    }),
    [audioOutputForContext, mediaPreferencesForContext, permissionsForContext],
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

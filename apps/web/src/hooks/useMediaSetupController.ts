import type { UseMediaDeviceReturn } from '@/hooks/useMediaDevice'
import type { DeclineType } from '@/lib/permission-storage'
import { useCallback, useEffect, useEffectEvent, useRef } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { mediaStreamQueryKey, useMediaDevice } from '@/hooks/useMediaDevice'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import {
  addAppBreadcrumb,
  captureAppException,
} from '@/integrations/sentry/reporting'
import { stopMediaStream } from '@/lib/media-stream-manager'
import { isSuccessState } from '@/types/async-resource'
import { useQueryClient } from '@tanstack/react-query'

interface UseMediaSetupControllerOptions {
  isInGameSettings: boolean
  onComplete: () => void
  onCancel: () => void
}

function getMediaDeviceStream(result: UseMediaDeviceReturn) {
  return isSuccessState(result) ? result.stream : null
}

export function useMediaSetupController({
  isInGameSettings,
  onComplete,
  onCancel,
}: UseMediaSetupControllerOptions) {
  const queryClient = useQueryClient()
  const { recordDecline } = useMediaPermissions()
  const {
    audioOutput,
    permissions: {
      camera: cameraPermission,
      microphone: microphonePermission,
      isChecking: isCheckingPermissions,
      permissionsGranted: hasPermissions,
      recheckPermissions,
    },
    mediaPreferences: {
      selectedVideoDeviceId,
      selectedAudioInputDeviceId,
      selectedAudioOutputDeviceId,
      videoEnabled,
      audioEnabled,
      setSelectedVideoDeviceId: storeSetSelectedVideoDeviceId,
      setSelectedAudioInputDeviceId: storeSetSelectedAudioInputDeviceId,
      setSelectedAudioOutputDeviceId,
      setVideoEnabled,
      setAudioEnabled,
      captureSnapshot,
      restoreSnapshot,
      commitPreferences,
    },
  } = useMediaStreams()

  const snapshotRef = useRef(captureSnapshot())

  const videoResult = useMediaDevice({
    kind: 'videoinput',
    selectedDeviceId: selectedVideoDeviceId,
    enabled: hasPermissions && videoEnabled,
  })

  const audioResult = useMediaDevice({
    kind: 'audioinput',
    selectedDeviceId: selectedAudioInputDeviceId,
    enabled: hasPermissions && audioEnabled,
  })

  const videoStream = getMediaDeviceStream(videoResult)
  const audioStream = getMediaDeviceStream(audioResult)

  const stopActiveStreams = useEffectEvent(() => {
    if (videoStream) {
      stopMediaStream(videoStream)
    }
    if (audioStream) {
      stopMediaStream(audioStream)
    }
  })

  useEffect(() => {
    const nextDeviceId = videoResult.selectedDeviceId || null
    if (nextDeviceId && nextDeviceId !== selectedVideoDeviceId) {
      storeSetSelectedVideoDeviceId(nextDeviceId)
    }
  }, [
    videoResult.selectedDeviceId,
    selectedVideoDeviceId,
    storeSetSelectedVideoDeviceId,
  ])

  useEffect(() => {
    const nextDeviceId = audioResult.selectedDeviceId || null
    if (nextDeviceId && nextDeviceId !== selectedAudioInputDeviceId) {
      storeSetSelectedAudioInputDeviceId(nextDeviceId)
    }
  }, [
    audioResult.selectedDeviceId,
    selectedAudioInputDeviceId,
    storeSetSelectedAudioInputDeviceId,
  ])

  useEffect(() => {
    return () => {
      stopActiveStreams()
    }
  }, [])

  const videoDevices = videoResult.devices
  const audioInputStream = isSuccessState(audioResult)
    ? audioResult.stream
    : undefined

  const noVideoDevicesAvailable = hasPermissions && videoDevices.length === 0
  const permissionError = noVideoDevicesAvailable
    ? 'No camera detected. Please check that your camera is connected and that your browser has camera access in macOS System Settings > Privacy & Security > Camera.'
    : videoResult.error
      ? `Unable to access selected camera: ${videoResult.error.message}`
      : audioResult.error
        ? `Unable to access selected microphone: ${audioResult.error.message}`
        : audioOutput.error
          ? `Audio output error: ${audioOutput.error.message}`
          : ''

  const handleComplete = useCallback(() => {
    commitPreferences()
    onComplete()
  }, [commitPreferences, onComplete])

  const handleCancel = useCallback(() => {
    if (isInGameSettings) {
      restoreSnapshot(snapshotRef.current)
    }
    onCancel()
  }, [isInGameSettings, restoreSnapshot, onCancel])

  const handlePermissionAccept = useCallback(async () => {
    let gotAnyPermission = false

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      audioStream.getTracks().forEach((track) => track.stop())
      gotAnyPermission = true
    } catch (error) {
      addAppBreadcrumb('media', 'Microphone permission request failed')
      captureAppException(error, {
        tags: { feature: 'media', operation: 'request_microphone_permission' },
      })
      // Ignore and continue to camera permission attempt.
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
      videoStream.getTracks().forEach((track) => track.stop())
      gotAnyPermission = true
    } catch (error) {
      addAppBreadcrumb('media', 'Camera permission request failed')
      captureAppException(error, {
        tags: { feature: 'media', operation: 'request_camera_permission' },
      })
      // Ignore and let permission state explain the outcome.
    }

    if (gotAnyPermission) {
      await queryClient.invalidateQueries({ queryKey: ['MediaDevices'] })
    }

    await recheckPermissions()
  }, [queryClient, recheckPermissions])

  const handlePermissionDecline = useCallback(
    (type: DeclineType) => {
      addAppBreadcrumb('media', 'Media permission declined', {
        declineType: type,
      })
      recordDecline('camera', type)
      recordDecline('microphone', type)
    },
    [recordDecline],
  )

  const releaseDevice = useCallback(
    (result: UseMediaDeviceReturn, kind: MediaDeviceInfo['kind']) => {
      if (!isSuccessState(result) || !result.stream) return

      stopMediaStream(result.stream)
      queryClient.removeQueries({ queryKey: mediaStreamQueryKey(kind) })
    },
    [queryClient],
  )

  const handleVideoToggle = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        releaseDevice(videoResult, 'videoinput')
      }
      setVideoEnabled(enabled)
    },
    [releaseDevice, setVideoEnabled, videoResult],
  )

  const handleAudioToggle = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        releaseDevice(audioResult, 'audioinput')
      }
      setAudioEnabled(enabled)
    },
    [audioResult, releaseDevice, setAudioEnabled],
  )

  return {
    videoResult,
    audioResult,
    audioOutput,
    cameraPermission,
    microphonePermission,
    hasPermissions,
    isCheckingPermissions,
    selectedVideoDeviceId: selectedVideoDeviceId ?? '',
    selectedAudioInputDeviceId: selectedAudioInputDeviceId ?? '',
    selectedAudioOutputDeviceId:
      selectedAudioOutputDeviceId ?? audioOutput.currentDeviceId,
    videoEnabled,
    audioEnabled,
    audioInputStream,
    noVideoDevicesAvailable,
    permissionError,
    canComplete: !isCheckingPermissions,
    handleComplete,
    handleCancel,
    handlePermissionAccept,
    handlePermissionDecline,
    handleVideoToggle,
    handleAudioToggle,
    handleVideoDeviceChange: storeSetSelectedVideoDeviceId,
    handleAudioInputChange: storeSetSelectedAudioInputDeviceId,
    handleAudioOutputChange: setSelectedAudioOutputDeviceId,
  }
}

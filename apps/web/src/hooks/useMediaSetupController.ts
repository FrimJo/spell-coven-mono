import type { DeclineType } from '@/lib/permission-storage'
import { useCallback, useRef } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { isSuccessState } from '@/types/async-resource'
import { useQueryClient } from '@tanstack/react-query'

interface UseMediaSetupControllerOptions {
  isInGameSettings: boolean
  onComplete: () => void
  onCancel: () => void
}

export function useMediaSetupController({
  isInGameSettings,
  onComplete,
  onCancel,
}: UseMediaSetupControllerOptions) {
  const queryClient = useQueryClient()
  const { recordDecline } = useMediaPermissions()
  const {
    video: videoResult,
    audio: audioResult,
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
      setSelectedVideoDeviceId,
      setSelectedAudioInputDeviceId,
      setSelectedAudioOutputDeviceId,
      setVideoEnabled,
      setAudioEnabled,
      captureSnapshot,
      restoreSnapshot,
      commitPreferences,
    },
  } = useMediaStreams()

  const snapshotRef = useRef(captureSnapshot())

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
    } catch {
      // Ignore and continue to camera permission attempt.
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
      videoStream.getTracks().forEach((track) => track.stop())
      gotAnyPermission = true
    } catch {
      // Ignore and let permission state explain the outcome.
    }

    if (gotAnyPermission) {
      await queryClient.invalidateQueries({ queryKey: ['MediaDevices'] })
    }

    await recheckPermissions()
  }, [queryClient, recheckPermissions])

  const handlePermissionDecline = useCallback(
    (type: DeclineType) => {
      recordDecline('camera', type)
      recordDecline('microphone', type)
    },
    [recordDecline],
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
    handleVideoToggle: setVideoEnabled,
    handleAudioToggle: setAudioEnabled,
    handleVideoDeviceChange: setSelectedVideoDeviceId,
    handleAudioInputChange: setSelectedAudioInputDeviceId,
    handleAudioOutputChange: setSelectedAudioOutputDeviceId,
  }
}

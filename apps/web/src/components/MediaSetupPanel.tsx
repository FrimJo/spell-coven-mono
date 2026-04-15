import { useEffect, useMemo, useRef } from 'react'
import { isCameraFocusControlsEnabled } from '@/env'
import { useCameraFocusControls } from '@/hooks/useCameraFocusControls'
import { useMediaSetupController } from '@/hooks/useMediaSetupController'
import { attachVideoStream } from '@/lib/video-stream-utils'
import { isSuccessState } from '@/types/async-resource'

import {
  AudioInputSection,
  AudioOutputSection,
  CameraFocusSection,
  MediaSetupErrorAlert,
  MediaSetupFooter,
  MediaSetupHeader,
  VideoSetupSection,
} from './media-setup/MediaSetupSections'

export interface MediaSetupPanelProps {
  onComplete: () => void
  onCancel: () => void
  isInGameSettings?: boolean
  showHeader?: boolean
  showFooter?: boolean
}

export function MediaSetupPanel({
  onComplete,
  onCancel,
  isInGameSettings = false,
  showHeader = true,
  showFooter = true,
}: MediaSetupPanelProps) {
  const previewRef = useRef<HTMLVideoElement>(null)
  const controller = useMediaSetupController({
    isInGameSettings,
    onComplete,
    onCancel,
  })

  useEffect(() => {
    const previewElement = previewRef.current
    if (
      previewElement &&
      isSuccessState(controller.videoResult) &&
      controller.videoResult.stream
    ) {
      attachVideoStream(previewElement, controller.videoResult.stream)
    }
  }, [controller.videoResult])

  const selectedVideoLabel = useMemo(
    () =>
      controller.videoResult.devices.find(
        (device) => device.deviceId === controller.selectedVideoDeviceId,
      )?.label ?? '',
    [controller.videoResult.devices, controller.selectedVideoDeviceId],
  )

  const focusControls = useCameraFocusControls({
    stream: isSuccessState(controller.videoResult)
      ? controller.videoResult.stream
      : undefined,
    selectedVideoLabel,
  })

  const showFocusControls =
    isCameraFocusControlsEnabled &&
    controller.hasPermissions &&
    controller.videoEnabled

  return (
    <div className="flex h-full flex-col">
      {showHeader && (
        <MediaSetupHeader
          hasPermissions={controller.hasPermissions}
          onCancel={controller.handleCancel}
        />
      )}

      <div className="space-y-6 pr-1 flex-1 overflow-y-auto">
        {controller.hasPermissions && (
          <MediaSetupErrorAlert message={controller.permissionError} />
        )}

        <VideoSetupSection
          hasPermissions={controller.hasPermissions}
          isCheckingPermissions={controller.isCheckingPermissions}
          cameraPermissionState={controller.cameraPermission.browserState}
          microphonePermissionState={
            controller.microphonePermission.browserState
          }
          videoEnabled={controller.videoEnabled}
          selectedVideoDeviceId={controller.selectedVideoDeviceId}
          videoDevices={controller.videoResult.devices}
          noVideoDevicesAvailable={controller.noVideoDevicesAvailable}
          isVideoPending={controller.videoResult.isPending}
          onVideoToggle={controller.handleVideoToggle}
          onVideoDeviceChange={controller.handleVideoDeviceChange}
          onPermissionAccept={controller.handlePermissionAccept}
          onPermissionDecline={controller.handlePermissionDecline}
          previewRef={previewRef}
          focusControls={
            showFocusControls ? (
              <CameraFocusSection
                focusCapabilities={focusControls.focusCapabilities}
                focusMode={focusControls.focusMode}
                focusDistance={focusControls.focusDistance}
                isFocusSupportForced={focusControls.isFocusSupportForced}
                onFocusModeChange={focusControls.handleFocusModeChange}
                onFocusDistanceChange={focusControls.handleFocusDistanceChange}
              />
            ) : null
          }
        />

        {controller.hasPermissions && (
          <AudioInputSection
            audioEnabled={controller.audioEnabled}
            selectedAudioInputDeviceId={controller.selectedAudioInputDeviceId}
            audioInputDevices={controller.audioResult.devices}
            isAudioInputPending={controller.audioResult.isPending}
            audioInputStream={controller.audioInputStream}
            onAudioToggle={controller.handleAudioToggle}
            onAudioInputChange={controller.handleAudioInputChange}
          />
        )}

        <AudioOutputSection
          selectedAudioOutputDeviceId={controller.selectedAudioOutputDeviceId}
          audioOutputDevices={controller.audioOutput.devices}
          isAudioOutputSupported={controller.audioOutput.isSupported}
          isTestingOutput={controller.audioOutput.isTesting}
          onAudioOutputChange={controller.handleAudioOutputChange}
          onTestOutput={controller.audioOutput.testOutput}
        />
      </div>

      {showFooter && (
        <MediaSetupFooter
          canComplete={controller.canComplete}
          onCancel={controller.handleCancel}
          onComplete={controller.handleComplete}
        />
      )}
    </div>
  )
}

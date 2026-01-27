/**
 * MediaSetupPanel - Shared media configuration UI driven by XState
 *
 * This component can be used:
 * - Inline on the /setup page
 * - Inside a dialog for in-game settings
 *
 * It uses the mediaSetupMachine to drive UI states while existing hooks
 * (useMediaStreams, useMediaEnabledState, useAudioOutput) handle persistence
 * to localStorage.
 */

import type { UseAudioOutputOptions } from '@/hooks/useAudioOutput'
import type { OriginalDeviceState } from '@/state/mediaSetupMachine'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { useAudioOutput } from '@/hooks/useAudioOutput'
import { useMediaEnabledState } from '@/hooks/useSelectedMediaDevice'
import { attachVideoStream } from '@/lib/video-stream-utils'
import { mediaSetupMachine } from '@/state/mediaSetupMachine'
import { isSuccessState } from '@/types/async-resource'
import { useMachine } from '@xstate/react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Camera,
  CameraOff,
  Check,
  Focus,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  X,
} from 'lucide-react'

import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Label } from '@repo/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { Slider } from '@repo/ui/components/slider'
import { Switch } from '@repo/ui/components/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { AudioLevelIndicator } from './AudioLevelIndicator'
import { MediaPermissionInline } from './MediaPermissionInline'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MediaSetupPanelProps {
  /**
   * Called when user completes setup successfully
   */
  onComplete: () => void

  /**
   * Called when user cancels setup.
   * For in-game settings, original device state will be restored before calling.
   */
  onCancel: () => void

  /**
   * Whether this is an in-game settings flow (restore on cancel)
   * vs initial setup flow (no restore, just navigate away)
   */
  isInGameSettings?: boolean

  /**
   * Whether to show header with title and cancel button
   * @default true
   */
  showHeader?: boolean

  /**
   * Whether to show footer with action buttons
   * @default true
   */
  showFooter?: boolean
}

// Focus control state
interface FocusCapabilities {
  supportsFocus: boolean
  focusModes: string[]
  focusDistance?: { min: number; max: number; step: number }
  initialFocusMode?: string
  initialFocusDistance?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MediaSetupPanel({
  onComplete,
  onCancel,
  isInGameSettings = false,
  showHeader = true,
  showFooter = true,
}: MediaSetupPanelProps) {
  const queryClient = useQueryClient()

  // ───────────────────────────────────────────────────────────────────────────
  // XState machine
  // ───────────────────────────────────────────────────────────────────────────

  const [state, send] = useMachine(mediaSetupMachine)

  // ───────────────────────────────────────────────────────────────────────────
  // Media context and hooks
  // ───────────────────────────────────────────────────────────────────────────

  const {
    video: videoResult,
    audio: audioResult,
    permissions: {
      camera: cameraPermission,
      microphone: microphonePermission,
      isChecking: isCheckingPermissions,
      permissionsGranted: hasPermissions,
      recheckPermissions,
    },
  } = useMediaStreams()

  // Extract video device info
  const videoDevices = videoResult.devices
  const selectedVideoId = videoResult.selectedDeviceId
  const videoError = videoResult.error
  const isVideoPending = videoResult.isPending
  const switchVideoDevice = videoResult.saveSelectedDevice

  // Extract audio device info
  const audioInputDevices = audioResult.devices
  const selectedAudioInputId = audioResult.selectedDeviceId
  const audioInputStream = isSuccessState(audioResult)
    ? audioResult.stream
    : undefined
  const audioInputError = audioResult.error
  const isAudioInputPending = audioResult.isPending
  const switchAudioInputDevice = audioResult.saveSelectedDevice

  // Get enabled state for video and audio (persisted to localStorage)
  const { videoEnabled, audioEnabled, setVideoEnabled, setAudioEnabled } =
    useMediaEnabledState()

  // Audio output hook
  const audioOutputOptions = useMemo<UseAudioOutputOptions>(
    () => ({ initialDeviceId: 'default' }),
    [],
  )

  const {
    devices: audioOutputDevices,
    currentDeviceId: selectedAudioOutputId,
    testOutput: testAudioOutput,
    isTesting: isTestingOutput,
    isSupported: isAudioOutputSupported,
    error: audioOutputError,
    setOutputDevice: switchAudioOutputDevice,
  } = useAudioOutput(audioOutputOptions)

  // ───────────────────────────────────────────────────────────────────────────
  // Open machine when component mounts
  // ───────────────────────────────────────────────────────────────────────────

  const hasOpenedRef = useRef(false)

  useEffect(() => {
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true

      const currentState: OriginalDeviceState = {
        videoDeviceId: selectedVideoId || null,
        audioInputDeviceId: selectedAudioInputId || null,
        audioOutputDeviceId: selectedAudioOutputId || null,
        videoEnabled,
        audioEnabled,
      }

      send({ type: 'OPEN', isInGameSettings, currentState })
    }
  }, [
    send,
    isInGameSettings,
    selectedVideoId,
    selectedAudioInputId,
    selectedAudioOutputId,
    videoEnabled,
    audioEnabled,
  ])

  // ───────────────────────────────────────────────────────────────────────────
  // Sync permissions state with machine
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isCheckingPermissions) {
      send({ type: 'PERMISSIONS_CHECKING' })
    } else if (hasPermissions) {
      send({ type: 'PERMISSIONS_GRANTED' })
    } else {
      send({ type: 'PERMISSIONS_DENIED' })
    }
  }, [isCheckingPermissions, hasPermissions, send])

  // ───────────────────────────────────────────────────────────────────────────
  // Handle restoring state on cancel (in-game settings mode)
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.matches('restoring') && state.context.originalState) {
      const original = state.context.originalState

      // Restore video device if different
      if (
        original.videoDeviceId &&
        original.videoDeviceId !== selectedVideoId
      ) {
        switchVideoDevice(original.videoDeviceId)
      }

      // Restore audio input device if different
      if (
        original.audioInputDeviceId &&
        original.audioInputDeviceId !== selectedAudioInputId
      ) {
        switchAudioInputDevice(original.audioInputDeviceId)
      }

      // Restore audio output device if different
      if (
        original.audioOutputDeviceId &&
        original.audioOutputDeviceId !== selectedAudioOutputId
      ) {
        switchAudioOutputDevice(original.audioOutputDeviceId)
      }

      // Restore enabled states
      if (original.videoEnabled !== videoEnabled) {
        setVideoEnabled(original.videoEnabled)
      }
      if (original.audioEnabled !== audioEnabled) {
        setAudioEnabled(original.audioEnabled)
      }

      // Finish restoring and call onCancel
      send({ type: 'CLOSE' })
      onCancel()
    }
  }, [
    state,
    selectedVideoId,
    selectedAudioInputId,
    selectedAudioOutputId,
    videoEnabled,
    audioEnabled,
    switchVideoDevice,
    switchAudioInputDevice,
    switchAudioOutputDevice,
    setVideoEnabled,
    setAudioEnabled,
    send,
    onCancel,
  ])

  // ───────────────────────────────────────────────────────────────────────────
  // Video preview ref callback
  // ───────────────────────────────────────────────────────────────────────────

  const videoRefCallback = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      if (videoElement && isSuccessState(videoResult) && videoResult.stream) {
        attachVideoStream(videoElement, videoResult.stream)
      }
    },
    [videoResult],
  )

  // ───────────────────────────────────────────────────────────────────────────
  // Focus controls state
  // ───────────────────────────────────────────────────────────────────────────

  const [focusMode, setFocusMode] = useState<string>('continuous')
  const [focusDistance, setFocusDistance] = useState<number>(0.5)
  const lastInitializedTrackIdRef = useRef<string | null>(null)
  const focusTrackIdRef = useRef<string | null>(null)
  const [focusCapabilities, setFocusCapabilities] =
    useState<FocusCapabilities | null>(null)
  const [isFocusSupportForced, setIsFocusSupportForced] = useState(false)

  const selectedVideoLabel = useMemo(() => {
    return (
      videoDevices.find((device) => device.deviceId === selectedVideoId)
        ?.label ?? ''
    )
  }, [videoDevices, selectedVideoId])

  const forceFocusControls = useMemo(() => {
    return /c920|c922/i.test(selectedVideoLabel)
  }, [selectedVideoLabel])

  const deriveFocusCapabilities = useCallback(
    (videoTrack: MediaStreamTrack): FocusCapabilities => {
      try {
        const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & {
          focusMode?: string[]
          focusDistance?: { min: number; max: number; step: number }
        }
        const settings = videoTrack.getSettings() as MediaTrackSettings & {
          focusMode?: string
          focusDistance?: number
        }

        const focusModeSet = new Set<string>()
        for (const mode of capabilities.focusMode ?? []) {
          focusModeSet.add(mode)
        }
        if (settings.focusMode) {
          focusModeSet.add(settings.focusMode)
        }
        if (
          capabilities.focusDistance ||
          settings.focusDistance !== undefined
        ) {
          focusModeSet.add('manual')
        }

        const focusModes = Array.from(focusModeSet)
        const supportsFocus =
          focusModes.length > 0 ||
          !!capabilities.focusDistance ||
          settings.focusMode !== undefined ||
          settings.focusDistance !== undefined

        if (!supportsFocus) {
          return { supportsFocus: false, focusModes: [] }
        }

        return {
          supportsFocus: true,
          focusModes,
          focusDistance: capabilities.focusDistance,
          initialFocusMode: settings.focusMode ?? focusModes[0],
          initialFocusDistance:
            settings.focusDistance ??
            (capabilities.focusDistance
              ? (capabilities.focusDistance.min +
                  capabilities.focusDistance.max) /
                2
              : undefined),
        }
      } catch {
        return { supportsFocus: false, focusModes: [] }
      }
    },
    [],
  )

  // Derive focus capabilities from video track with a short retry
  useEffect(() => {
    let cancelled = false
    let stateTimer: ReturnType<typeof setTimeout> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleStateUpdate = (
      next: FocusCapabilities | null,
      forced: boolean,
    ) => {
      if (cancelled) return
      stateTimer = setTimeout(() => {
        if (!cancelled) {
          setFocusCapabilities(next)
          setIsFocusSupportForced(forced)
        }
      }, 0)
    }

    if (!isSuccessState(videoResult) || !videoResult.stream) {
      focusTrackIdRef.current = null
      scheduleStateUpdate(null, false)
      return () => {
        cancelled = true
        if (stateTimer) clearTimeout(stateTimer)
        if (retryTimer) clearTimeout(retryTimer)
      }
    }

    const videoTrack = videoResult.stream.getVideoTracks()[0]
    if (!videoTrack) {
      focusTrackIdRef.current = null
      scheduleStateUpdate(null, false)
      return () => {
        cancelled = true
        if (stateTimer) clearTimeout(stateTimer)
        if (retryTimer) clearTimeout(retryTimer)
      }
    }

    const trackId = videoTrack.id
    focusTrackIdRef.current = trackId

    const compute = (attempt = 0) => {
      if (cancelled || focusTrackIdRef.current !== trackId) return
      const derived = deriveFocusCapabilities(videoTrack)
      const forced = !derived.supportsFocus && forceFocusControls
      const nextCapabilities = forced
        ? {
            supportsFocus: true,
            focusModes: ['continuous', 'manual'],
          }
        : derived
      scheduleStateUpdate(nextCapabilities, forced)
      if (!derived.supportsFocus && attempt < 2) {
        retryTimer = setTimeout(() => compute(attempt + 1), 300)
      }
    }

    compute()

    return () => {
      cancelled = true
      if (stateTimer) clearTimeout(stateTimer)
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [videoResult, deriveFocusCapabilities, forceFocusControls])

  // Effect Event for initializing focus settings
  const onFocusTrackChanged = useEffectEvent(
    (capabilities: FocusCapabilities | null) => {
      if (capabilities?.supportsFocus) {
        if (capabilities.initialFocusMode) {
          setFocusMode(capabilities.initialFocusMode)
        }
        if (capabilities.initialFocusDistance !== undefined) {
          setFocusDistance(capabilities.initialFocusDistance)
        }
      }
    },
  )

  // Initialize focus mode/distance from camera settings when track changes
  useEffect(() => {
    if (!isSuccessState(videoResult) || !videoResult.stream) {
      lastInitializedTrackIdRef.current = null
      return
    }

    const videoTrack = videoResult.stream.getVideoTracks()[0]
    const currentTrackId = videoTrack?.id ?? null

    if (
      currentTrackId &&
      currentTrackId !== lastInitializedTrackIdRef.current
    ) {
      lastInitializedTrackIdRef.current = currentTrackId
      onFocusTrackChanged(focusCapabilities)
    }
  }, [videoResult, focusCapabilities])

  // Apply focus constraints to the video track
  const applyFocusConstraints = useCallback(
    async (mode: string, distance?: number) => {
      if (!isSuccessState(videoResult) || !videoResult.stream) return

      const videoTrack = videoResult.stream.getVideoTracks()[0]
      if (!videoTrack) return

      try {
        const constraints: MediaTrackConstraints & {
          advanced?: Array<{ focusMode?: string; focusDistance?: number }>
        } = {
          advanced: [{ focusMode: mode }],
        }

        if (mode === 'manual' && distance !== undefined) {
          constraints.advanced = [{ focusMode: mode, focusDistance: distance }]
        }

        await videoTrack.applyConstraints(constraints)
      } catch (error) {
        console.warn('Failed to apply focus constraints:', error)
      }
    },
    [videoResult],
  )

  const handleFocusModeChange = useCallback(
    (mode: string) => {
      setFocusMode(mode)
      void applyFocusConstraints(
        mode,
        mode === 'manual' ? focusDistance : undefined,
      )
    },
    [applyFocusConstraints, focusDistance],
  )

  const handleFocusDistanceChange = useCallback(
    (value: number[]) => {
      const distance = value[0]
      if (distance === undefined) return
      setFocusDistance(distance)
      void applyFocusConstraints('manual', distance)
    },
    [applyFocusConstraints],
  )

  // ───────────────────────────────────────────────────────────────────────────
  // Derived state
  // ───────────────────────────────────────────────────────────────────────────

  // Detect macOS system-level camera block
  const noVideoDevicesAvailable = hasPermissions && videoDevices.length === 0

  // Derive permission error from all error sources
  const permissionError = noVideoDevicesAvailable
    ? 'No camera detected. Please check that your camera is connected and that your browser has camera access in macOS System Settings > Privacy & Security > Camera.'
    : videoError
      ? `Unable to access selected camera: ${videoError.message}`
      : audioInputError
        ? `Unable to access selected microphone: ${audioInputError.message}`
        : audioOutputError
          ? `Audio output error: ${audioOutputError.message}`
          : ''

  // Check if setup can be completed
  const canComplete =
    hasPermissions &&
    (!videoEnabled || selectedVideoId) &&
    (!audioEnabled || selectedAudioInputId) &&
    !permissionError

  // ───────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleComplete = useCallback(() => {
    send({ type: 'COMPLETE' })
    onComplete()
  }, [send, onComplete])

  const handleCancel = useCallback(() => {
    send({ type: 'CANCEL' })
    // If not in-game settings, just call onCancel directly
    // (restoring happens in the effect above for in-game settings)
    if (!isInGameSettings) {
      onCancel()
    }
  }, [send, isInGameSettings, onCancel])

  const handlePermissionAccept = useCallback(async () => {
    send({ type: 'REQUEST_PERMISSIONS' })

    let gotAnyPermission = false

    // First try audio only
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      audioStream.getTracks().forEach((track) => track.stop())
      gotAnyPermission = true
    } catch {
      // Audio permission failed
    }

    // Then try video
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
      videoStream.getTracks().forEach((track) => track.stop())
      gotAnyPermission = true
    } catch {
      // Video failed - likely macOS blocking camera access
    }

    // Invalidate the media devices query so it re-enumerates with real device IDs
    if (gotAnyPermission) {
      await queryClient.invalidateQueries({ queryKey: ['MediaDevices'] })
    }

    await recheckPermissions()
  }, [send, queryClient, recheckPermissions])

  const handlePermissionDecline = useCallback(() => {
    // User declined - they can still continue without camera/microphone
  }, [])

  const handleVideoToggle = useCallback(
    (enabled: boolean) => {
      setVideoEnabled(enabled)
      send({ type: 'TOGGLE_VIDEO', enabled })
    },
    [setVideoEnabled, send],
  )

  const handleAudioToggle = useCallback(
    (enabled: boolean) => {
      setAudioEnabled(enabled)
      send({ type: 'TOGGLE_AUDIO', enabled })
    },
    [setAudioEnabled, send],
  )

  const handleVideoDeviceChange = useCallback(
    (deviceId: string) => {
      switchVideoDevice(deviceId)
      send({ type: 'SELECT_VIDEO_DEVICE', deviceId })
    },
    [switchVideoDevice, send],
  )

  const handleAudioInputChange = useCallback(
    (deviceId: string) => {
      switchAudioInputDevice(deviceId)
      send({ type: 'SELECT_AUDIO_INPUT', deviceId })
    },
    [switchAudioInputDevice, send],
  )

  const handleAudioOutputChange = useCallback(
    (deviceId: string) => {
      switchAudioOutputDevice(deviceId)
      send({ type: 'SELECT_AUDIO_OUTPUT', deviceId })
    },
    [switchAudioOutputDevice, send],
  )

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {showHeader && (
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Setup Audio & Video
            </h2>
            <p className="text-sm text-slate-400">
              {hasPermissions
                ? 'Configure your camera and audio devices before joining the game'
                : 'Grant camera and microphone access for the best experience'}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-sm text-slate-400 opacity-70 ring-offset-slate-900 transition-opacity hover:text-slate-300 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {permissionError && hasPermissions && (
          <Alert className="border-red-500/30 bg-red-950/50 text-red-200">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-200/90">
              {permissionError}
            </AlertDescription>
          </Alert>
        )}

        {/* Video Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {videoEnabled ? (
                <Camera className="h-4 w-4 text-purple-400" />
              ) : (
                <CameraOff className="h-4 w-4 text-slate-500" />
              )}
              <Label
                className={
                  videoEnabled ? 'text-slate-200' : 'text-slate-500'
                }
              >
                Camera Source
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {videoEnabled ? 'On' : 'Off'}
              </span>
              <Switch
                checked={videoEnabled}
                onCheckedChange={handleVideoToggle}
                className="data-[state=checked]:bg-purple-600"
              />
            </div>
          </div>

          {hasPermissions ? (
            <>
              {videoEnabled ? (
                <>
                  <Select
                    value={selectedVideoId}
                    onValueChange={handleVideoDeviceChange}
                    disabled={noVideoDevicesAvailable}
                  >
                    <SelectTrigger className="border-slate-700 bg-slate-800 text-slate-200">
                      <SelectValue
                        placeholder={
                          noVideoDevicesAvailable
                            ? 'No cameras available'
                            : 'Select camera'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-800">
                      {videoDevices
                        .filter((device) => device.deviceId !== '')
                        .map((device) => (
                          <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                            className="text-slate-200 focus:bg-slate-700"
                          >
                            {device.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {/* Video Preview */}
                  <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                    <video
                      ref={videoRefCallback}
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                    {noVideoDevicesAvailable ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95">
                        <div className="mx-auto max-w-sm space-y-4 p-4">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
                            <AlertCircle className="h-6 w-6 text-amber-400" />
                          </div>

                          <div className="text-center">
                            <h3 className="text-lg font-semibold text-slate-100">
                              No Camera Detected
                            </h3>
                            <p className="mt-1 text-sm text-slate-400">
                              Your camera may be blocked at the system level
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                            <h4 className="mb-2 text-xs font-medium text-slate-200">
                              To enable camera access:
                            </h4>
                            <ol className="space-y-1.5 text-xs text-slate-400">
                              <li className="flex items-start gap-2">
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] text-slate-300">
                                  1
                                </span>
                                <span>
                                  Open System Settings → Privacy &amp; Security
                                </span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] text-slate-300">
                                  2
                                </span>
                                <span>Click Camera in the sidebar</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] text-slate-300">
                                  3
                                </span>
                                <span>Enable access for your browser</span>
                              </li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    ) : isVideoPending ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50">
                        <div className="flex flex-col items-center space-y-3">
                          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                          <p className="text-sm text-slate-200">
                            Initializing Camera
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                /* Camera Off state */
                <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
                      <CameraOff className="h-8 w-8 text-slate-500" />
                    </div>
                    <p className="mt-4 text-sm text-slate-400">
                      Camera is turned off
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      You can join the game without sharing video
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Show inline permission UI in video preview area */
            <div className="aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
              {isCheckingPermissions ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                </div>
              ) : (
                <MediaPermissionInline
                  onAccept={handlePermissionAccept}
                  onDecline={handlePermissionDecline}
                  permissions={{ camera: true, microphone: true }}
                  blocked={{
                    camera: cameraPermission.browserState === 'denied',
                    microphone: microphonePermission.browserState === 'denied',
                  }}
                  compact={false}
                />
              )}
            </div>
          )}

          {/* Focus Control - only show when permissions granted and video enabled */}
          {hasPermissions && videoEnabled && (
            <div
              className={`mt-3 space-y-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 ${
                !focusCapabilities?.supportsFocus ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Focus className="h-4 w-4 text-purple-400" />
                <Label className="text-sm text-slate-200">Camera Focus</Label>
                {!focusCapabilities?.supportsFocus && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
                        Not supported
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[200px] border border-slate-600 bg-slate-800 text-slate-200"
                    >
                      This camera doesn&apos;t support focus control. Try using
                      an external webcam like Logitech C920/C922.
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select
                        value={focusMode}
                        onValueChange={handleFocusModeChange}
                        disabled={!focusCapabilities?.supportsFocus}
                      >
                        <SelectTrigger
                          className={`w-[140px] border-slate-600 bg-slate-700 text-sm text-slate-200 ${
                            !focusCapabilities?.supportsFocus
                              ? 'cursor-not-allowed'
                              : ''
                          }`}
                        >
                          <SelectValue placeholder="Focus mode" />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-800">
                          {focusCapabilities?.focusModes.includes(
                            'continuous',
                          ) && (
                            <SelectItem
                              value="continuous"
                              className="text-slate-200 focus:bg-slate-700"
                            >
                              Auto (Continuous)
                            </SelectItem>
                          )}
                          {focusCapabilities?.focusModes.includes(
                            'single-shot',
                          ) && (
                            <SelectItem
                              value="single-shot"
                              className="text-slate-200 focus:bg-slate-700"
                            >
                              Auto (Single)
                            </SelectItem>
                          )}
                          {focusCapabilities?.focusModes.includes('manual') && (
                            <SelectItem
                              value="manual"
                              className="text-slate-200 focus:bg-slate-700"
                            >
                              Manual
                            </SelectItem>
                          )}
                          {/* Show placeholder options when not supported */}
                          {!focusCapabilities?.supportsFocus && (
                            <>
                              <SelectItem
                                value="continuous"
                                className="text-slate-200 focus:bg-slate-700"
                              >
                                Auto (Continuous)
                              </SelectItem>
                              <SelectItem
                                value="manual"
                                className="text-slate-200 focus:bg-slate-700"
                              >
                                Manual
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  {!focusCapabilities?.supportsFocus && (
                    <TooltipContent
                      side="bottom"
                      className="border border-slate-600 bg-slate-800 text-slate-200"
                    >
                      Focus control not supported by this camera
                    </TooltipContent>
                  )}
                </Tooltip>

                {/* Focus Distance Slider - only show in manual mode when supported */}
                {focusCapabilities?.supportsFocus &&
                  focusMode === 'manual' &&
                  focusCapabilities.focusDistance && (
                    <div className="flex flex-1 items-center gap-3">
                      <span className="text-xs text-slate-400">Near</span>
                      <Slider
                        value={[focusDistance]}
                        onValueChange={handleFocusDistanceChange}
                        min={focusCapabilities.focusDistance.min}
                        max={focusCapabilities.focusDistance.max}
                        step={focusCapabilities.focusDistance.step}
                        className="flex-1 [&_[data-slot=slider-range]]:bg-purple-500 [&_[data-slot=slider-thumb]]:border-purple-500 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-slate-600"
                      />
                      <span className="text-xs text-slate-400">Far</span>
                    </div>
                  )}
              </div>

              <p className="text-xs text-slate-500">
                {!focusCapabilities?.supportsFocus
                  ? 'Focus control is not available for this camera'
                  : focusMode === 'manual'
                    ? 'Adjust the slider to focus on your cards'
                    : 'Camera will automatically adjust focus'}
              </p>
              {isFocusSupportForced && (
                <p className="text-xs text-amber-300">
                  Browser didn&apos;t report focus support for this camera.
                  Trying focus controls anyway.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Audio Input Section - only show if has permissions */}
        {hasPermissions && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {audioEnabled ? (
                  <Mic className="h-4 w-4 text-purple-400" />
                ) : (
                  <MicOff className="h-4 w-4 text-slate-500" />
                )}
                <Label
                  className={audioEnabled ? 'text-slate-200' : 'text-slate-500'}
                >
                  Microphone
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {audioEnabled ? 'On' : 'Off'}
                </span>
                <Switch
                  checked={audioEnabled}
                  onCheckedChange={handleAudioToggle}
                  className="data-[state=checked]:bg-purple-600"
                />
              </div>
            </div>

            {audioEnabled ? (
              <>
                <div className="relative">
                  <Select
                    value={selectedAudioInputId}
                    onValueChange={handleAudioInputChange}
                    disabled={isAudioInputPending}
                  >
                    <SelectTrigger className="border-slate-700 bg-slate-800 text-slate-200">
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-800">
                      {audioInputDevices
                        .filter((device) => device.deviceId !== '')
                        .map((device) => (
                          <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                            className="text-slate-200 focus:bg-slate-700"
                          >
                            {device.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {isAudioInputPending && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                    </div>
                  )}
                </div>

                {/* Audio Level Indicator */}
                <AudioLevelIndicator audioStream={audioInputStream} />
              </>
            ) : (
              /* Microphone Off state */
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
                    <MicOff className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">
                      Microphone is turned off
                    </p>
                    <p className="text-xs text-slate-500">
                      You can join the game without sending audio
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audio Output Section - only show if has permissions */}
        {hasPermissions && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-purple-400" />
              <Label className="text-slate-200">Speaker / Headphones</Label>
            </div>

            <div className="flex gap-2">
              <Select
                value={selectedAudioOutputId}
                onValueChange={handleAudioOutputChange}
                disabled={!isAudioOutputSupported}
              >
                <SelectTrigger className="flex-1 border-slate-700 bg-slate-800 text-slate-200">
                  <SelectValue
                    placeholder={
                      isAudioOutputSupported
                        ? 'Select speaker'
                        : 'Not supported in this browser'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-800">
                  {audioOutputDevices
                    .filter((device) => device.deviceId !== '')
                    .map((device) => (
                      <SelectItem
                        key={device.deviceId}
                        value={device.deviceId}
                        className="text-slate-200 focus:bg-slate-700"
                      >
                        {device.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => void testAudioOutput()}
                disabled={
                  isTestingOutput ||
                  !selectedAudioOutputId ||
                  !isAudioOutputSupported
                }
                className="border-slate-700 bg-slate-800 hover:bg-slate-700"
              >
                {isTestingOutput ? 'Playing...' : 'Test'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Click &quot;Test&quot; to play a short sound
            </p>
          </div>
        )}
      </div>

      {showFooter && (
        <div className="mt-6 flex justify-between gap-2">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-300"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>

          <Button
            onClick={handleComplete}
            disabled={!canComplete}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            <Check className="mr-2 h-4 w-4" />
            Complete Setup
          </Button>
        </div>
      )}
    </div>
  )
}

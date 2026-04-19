import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface FocusCapabilities {
  supportsFocus: boolean
  focusModes: string[]
  focusDistance?: { min: number; max: number; step: number }
  initialFocusMode?: string
  initialFocusDistance?: number
}

interface UseCameraFocusControlsOptions {
  stream?: MediaStream
  selectedVideoLabel: string
}

function deriveFocusCapabilities(
  videoTrack: MediaStreamTrack,
): FocusCapabilities {
  try {
    const capabilities =
      videoTrack.getCapabilities() as MediaTrackCapabilities & {
        focusMode?: string[]
        focusDistance?: { min: number; max: number; step: number }
      }
    const settings = videoTrack.getSettings() as MediaTrackSettings & {
      focusMode?: string
      focusDistance?: number
    }

    const focusModeSet = new Set<string>()

    if (Array.isArray(capabilities.focusMode)) {
      for (const mode of capabilities.focusMode) {
        focusModeSet.add(mode)
      }
    }

    if (settings.focusMode) {
      focusModeSet.add(settings.focusMode)
    }

    const hasFocusDistance =
      !!capabilities.focusDistance || settings.focusDistance !== undefined

    if (hasFocusDistance) {
      focusModeSet.add('manual')
    }

    const focusModes = Array.from(focusModeSet)

    if (focusModes.length === 0 && !hasFocusDistance) {
      return { supportsFocus: false, focusModes: [] }
    }

    return {
      supportsFocus: true,
      focusModes,
      focusDistance: capabilities.focusDistance,
      initialFocusMode:
        settings.focusMode ??
        (focusModes.includes('continuous') ? 'continuous' : focusModes[0]),
      initialFocusDistance:
        settings.focusDistance ??
        (capabilities.focusDistance
          ? (capabilities.focusDistance.min + capabilities.focusDistance.max) /
            2
          : undefined),
    }
  } catch (error) {
    console.warn(
      '[useCameraFocusControls] Failed to derive focus capabilities',
      error,
    )
    return { supportsFocus: false, focusModes: [] }
  }
}

export function useCameraFocusControls({
  stream,
  selectedVideoLabel,
}: UseCameraFocusControlsOptions) {
  const [focusMode, setFocusMode] = useState('continuous')
  const [focusDistance, setFocusDistance] = useState(0.5)
  const [focusCapabilities, setFocusCapabilities] =
    useState<FocusCapabilities | null>(null)
  const [isFocusSupportForced, setIsFocusSupportForced] = useState(false)
  const initializedTrackIdRef = useRef<string | null>(null)
  const activeTrackIdRef = useRef<string | null>(null)

  const shouldForceFocusControls = useMemo(() => {
    const label = selectedVideoLabel.toLowerCase()
    return /logitech.*c9(20|22)|c9(20|22)|hd pro webcam c9(20|22)/i.test(label)
  }, [selectedVideoLabel])

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const videoTrack = stream?.getVideoTracks()[0]
    if (!videoTrack) {
      activeTrackIdRef.current = null
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing external MediaStream track state
      setFocusCapabilities(null)
      setIsFocusSupportForced(false)
      return () => {
        cancelled = true
        if (retryTimer) clearTimeout(retryTimer)
      }
    }

    const trackId = videoTrack.id
    activeTrackIdRef.current = trackId

    const compute = (attempt = 0) => {
      if (cancelled || activeTrackIdRef.current !== trackId) {
        return
      }

      const derived = deriveFocusCapabilities(videoTrack)

      if (derived.supportsFocus) {
        setFocusCapabilities(derived)
        setIsFocusSupportForced(false)
        return
      }

      if (shouldForceFocusControls) {
        setFocusCapabilities({
          supportsFocus: true,
          focusModes: ['continuous', 'manual'],
          focusDistance: derived.focusDistance ?? {
            min: 0,
            max: 1,
            step: 0.01,
          },
          initialFocusMode: derived.initialFocusMode ?? 'continuous',
          initialFocusDistance: derived.initialFocusDistance ?? 0.5,
        })
        setIsFocusSupportForced(true)
      } else {
        setFocusCapabilities(derived)
        setIsFocusSupportForced(false)
      }

      if (!derived.supportsFocus && attempt < 3) {
        retryTimer = setTimeout(() => compute(attempt + 1), 300)
      }
    }

    compute()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [stream, shouldForceFocusControls])

  useEffect(() => {
    const videoTrack = stream?.getVideoTracks()[0]
    const currentTrackId = videoTrack?.id ?? null

    if (
      !currentTrackId ||
      currentTrackId === initializedTrackIdRef.current ||
      !focusCapabilities?.supportsFocus
    ) {
      return
    }

    initializedTrackIdRef.current = currentTrackId

    if (focusCapabilities.initialFocusMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing from async track capabilities
      setFocusMode(focusCapabilities.initialFocusMode)
    }
    if (focusCapabilities.initialFocusDistance !== undefined) {
      setFocusDistance(focusCapabilities.initialFocusDistance)
    }
  }, [stream, focusCapabilities])

  const applyFocusConstraints = useCallback(
    async (mode: string, distance?: number) => {
      const videoTrack = stream?.getVideoTracks()[0]
      if (!videoTrack) {
        return
      }

      try {
        await videoTrack.applyConstraints({
          advanced: [
            mode === 'manual' && distance !== undefined
              ? ({ focusMode: mode, focusDistance: distance } as {
                  focusMode: string
                  focusDistance: number
                })
              : ({ focusMode: mode } as { focusMode: string }),
          ],
        } as MediaTrackConstraints)
      } catch (error) {
        console.warn(
          '[useCameraFocusControls] Failed to apply focus constraints',
          {
            error,
            mode,
            distance,
          },
        )
      }
    },
    [stream],
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
      if (distance === undefined) {
        return
      }

      setFocusDistance(distance)
      void applyFocusConstraints('manual', distance)
    },
    [applyFocusConstraints],
  )

  return {
    focusMode,
    focusDistance,
    focusCapabilities,
    isFocusSupportForced,
    handleFocusModeChange,
    handleFocusDistanceChange,
  }
}

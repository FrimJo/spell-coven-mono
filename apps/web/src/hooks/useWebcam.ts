import type { DetectorType } from '@/lib/detectors'
import { useCallback, useEffect, useRef, useState } from 'react'
import { setupWebcam } from '@/lib/webcam'

interface UseWebcamOptions {
  /** Enable card detection */
  enableCardDetection?: boolean
  /** Detector type to use (opencv, detr, owl-vit) */
  detectorType?: DetectorType
  /** Enable perspective warp for corner refinement */
  usePerspectiveWarp?: boolean
  /** Callback when a card is cropped */
  onCrop?: (canvas: HTMLCanvasElement) => void
  /** Trigger to reinitialize detector (e.g., when camera switches) */
  reinitializeTrigger?: number
}

interface UseWebcamReturn {
  /** Ref for the video element */
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Ref for the overlay canvas (used for card detection) */
  overlayRef: React.RefObject<HTMLCanvasElement | null>
  /** Ref for the cropped canvas (stores cropped card image) */
  croppedRef: React.RefObject<HTMLCanvasElement | null>
  /** Ref for the full resolution canvas (internal use) */
  fullResRef: React.RefObject<HTMLCanvasElement | null>
  /** Get list of available cameras */
  getCameras: () => Promise<MediaDeviceInfo[]>
  /** Get the cropped canvas element */
  getCroppedCanvas: () => HTMLCanvasElement | null
  /** Whether the card detector is initialized */
  isReady: boolean
  /** Whether a card has been cropped */
  hasCroppedImage: boolean
}

/**
 * Hook for managing webcam with optional OpenCV card detection
 *
 * @example
 * ```tsx
 * const { videoRef, overlayRef, isReady } = useWebcam({
 *   enableCardDetection: true,
 * })
 *
 * return (
 *   <div>
 *     <video ref={videoRef} />
 *     <canvas ref={overlayRef} />
 *   </div>
 * )
 * ```
 */
export function useWebcam(options: UseWebcamOptions = {}): UseWebcamReturn {
  const {
    enableCardDetection = false,
    detectorType,
    usePerspectiveWarp = true,
    onCrop: onCropProp,
    reinitializeTrigger = 0,
  } = options

  // Stable callback reference
  const onCrop = useCallback(
    (canvas: HTMLCanvasElement) => {
      onCropProp?.(canvas)
    },
    [onCropProp],
  )

  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const croppedRef = useRef<HTMLCanvasElement>(null)
  const fullResRef = useRef<HTMLCanvasElement>(null)

  const webcamController = useRef<Awaited<
    ReturnType<typeof setupWebcam>
  > | null>(null)
  const isInitialized = useRef(false)

  const [isReady, setIsReady] = useState(false)
  const [hasCroppedImage, setHasCroppedImage] = useState(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      if (!enableCardDetection) {
        // Card detection disabled, nothing to initialize
        setIsReady(true)
        return
      }

      // Wait for refs to be available
      if (
        !videoRef.current ||
        !overlayRef.current ||
        !croppedRef.current ||
        !fullResRef.current
      ) {
        return
      }

      // Initialize or reinitialize card detector
      try {
        // Reset initialization flag to allow reinitialization when video stream changes
        isInitialized.current = false

        webcamController.current = await setupWebcam({
          video: videoRef.current,
          overlay: overlayRef.current,
          cropped: croppedRef.current,
          fullRes: fullResRef.current,
          detectorType,
          usePerspectiveWarp,
          onCrop: (canvas: HTMLCanvasElement) => {
            setHasCroppedImage(true)
            if (onCrop) {
              onCrop(canvas)
            }
          },
        })

        // Update component state only if still mounted
        if (mounted) {
          setIsReady(true)
          isInitialized.current = true
        }
      } catch (err) {
        console.error('[useWebcam] Card detector initialization error:', err)
        isInitialized.current = false
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [
    enableCardDetection,
    detectorType,
    onCrop,
    usePerspectiveWarp,
    reinitializeTrigger,
  ])

  const getCameras = async () => {
    if (webcamController.current) {
      return webcamController.current.getCameras()
    }
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cameras = devices.filter((d) => d.kind === 'videoinput')

    // Filter out mock video file devices
    const realCameras = cameras.filter(
      (camera) => !camera.deviceId.startsWith('video-file:'),
    )

    return realCameras
  }

  const getCroppedCanvas = () => {
    if (webcamController.current) {
      return webcamController.current.getCroppedCanvas()
    }
    return croppedRef.current
  }

  return {
    videoRef,
    overlayRef,
    croppedRef,
    fullResRef,
    getCameras,
    getCroppedCanvas,
    isReady,
    hasCroppedImage,
  }
}

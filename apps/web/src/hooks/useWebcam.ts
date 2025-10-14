import { useEffect, useRef, useState } from 'react'
import { setupWebcam } from '@/lib/webcam'

interface UseWebcamOptions {
  /** Enable OpenCV-based card detection */
  enableCardDetection?: boolean
  /** Callback when a card is cropped */
  onCrop?: () => void
  /** Auto-start video on mount */
  autoStart?: boolean
  /** Preferred camera device ID */
  deviceId?: string | null
}

interface UseWebcamReturn {
  /** Ref for the video element */
  videoRef: React.RefObject<HTMLVideoElement>
  /** Ref for the overlay canvas (used for card detection) */
  overlayRef: React.RefObject<HTMLCanvasElement>
  /** Ref for the cropped canvas (stores cropped card image) */
  croppedRef: React.RefObject<HTMLCanvasElement>
  /** Ref for the full resolution canvas (internal use) */
  fullResRef: React.RefObject<HTMLCanvasElement>
  /** Ref for camera select element */
  cameraSelectRef: React.RefObject<HTMLSelectElement>
  /** Start the webcam with optional device ID */
  startVideo: (deviceId?: string | null) => Promise<void>
  /** Get list of available cameras */
  getCameras: () => Promise<MediaDeviceInfo[]>
  /** Get currently active device ID */
  getCurrentDeviceId: () => string | null
  /** Populate a select element with available cameras */
  populateCameraSelect: (selectEl: HTMLSelectElement | null) => Promise<void>
  /** Get the cropped canvas element */
  getCroppedCanvas: () => HTMLCanvasElement | null
  /** Whether the webcam controller is initialized */
  isReady: boolean
  /** Whether a card has been cropped */
  hasCroppedImage: boolean
  /** Current status message */
  status: string
  /** Loading state */
  isLoading: boolean
}

/**
 * Hook for managing webcam with optional OpenCV card detection
 * 
 * @example
 * ```tsx
 * const { videoRef, overlayRef, startVideo, isReady } = useWebcam({
 *   enableCardDetection: true,
 *   autoStart: true,
 *   onCrop: () => console.log('Card cropped!')
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
    onCrop,
    autoStart = false,
    deviceId = null,
  } = options

  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const croppedRef = useRef<HTMLCanvasElement>(null)
  const fullResRef = useRef<HTMLCanvasElement>(null)
  const cameraSelectRef = useRef<HTMLSelectElement>(null)

  const webcamController = useRef<Awaited<
    ReturnType<typeof setupWebcam>
  > | null>(null)

  const [isReady, setIsReady] = useState(false)
  const [hasCroppedImage, setHasCroppedImage] = useState(false)
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      if (!enableCardDetection) {
        // Simple webcam without OpenCV
        setIsReady(true)
        setStatus('Ready')
        return
      }

      // Initialize webcam with OpenCV card detection
      if (
        videoRef.current &&
        overlayRef.current &&
        croppedRef.current &&
        fullResRef.current
      ) {
        try {
          setIsLoading(true)
          setStatus('Loading OpenCV…')
          
          webcamController.current = await setupWebcam({
            video: videoRef.current,
            overlay: overlayRef.current,
            cropped: croppedRef.current,
            fullRes: fullResRef.current,
            onCrop: () => {
              setHasCroppedImage(true)
              onCrop?.()
            },
          })

          if (mounted) {
            setIsReady(true)
            setStatus('Webcam ready')
            setIsLoading(false)

            // Auto-start if requested
            if (autoStart) {
              await webcamController.current.startVideo(deviceId)
              await webcamController.current.populateCameraSelect(
                cameraSelectRef.current,
              )
            }
          }
        } catch (err) {
          console.error('Webcam initialization error:', err)
          if (mounted) {
            setStatus(
              `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            )
            setIsLoading(false)
          }
        }
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [enableCardDetection, autoStart, deviceId, onCrop])

  const startVideo = async (deviceId?: string | null) => {
    if (enableCardDetection) {
      if (!webcamController.current) {
        console.error('Webcam controller not initialized')
        setStatus('Error: Webcam controller not ready')
        return
      }
      try {
        await webcamController.current.startVideo(deviceId || null)
        await webcamController.current.populateCameraSelect(
          cameraSelectRef.current,
        )
        setStatus('Webcam started')
      } catch (err) {
        console.error('Failed to start webcam:', err)
        setStatus(
          `Error: ${err instanceof Error ? err.message : 'Failed to start webcam'}`,
        )
      }
    } else {
      // Simple video start without OpenCV
      if (!videoRef.current) return
      
      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { width: { ideal: 1920 }, height: { ideal: 1080 } },
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStatus('Webcam started')
      } catch (err) {
        console.error('Failed to start webcam:', err)
        setStatus(
          `Error: ${err instanceof Error ? err.message : 'Failed to start webcam'}`,
        )
      }
    }
  }

  const getCameras = async () => {
    if (webcamController.current) {
      return webcamController.current.getCameras()
    }
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === 'videoinput')
  }

  const getCurrentDeviceId = () => {
    if (webcamController.current) {
      return webcamController.current.getCurrentDeviceId()
    }
    return null
  }

  const populateCameraSelect = async (
    selectEl: HTMLSelectElement | null,
  ) => {
    if (webcamController.current) {
      await webcamController.current.populateCameraSelect(selectEl)
    }
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
    cameraSelectRef,
    startVideo,
    getCameras,
    getCurrentDeviceId,
    populateCameraSelect,
    getCroppedCanvas,
    isReady,
    hasCroppedImage,
    status,
    isLoading,
  }
}

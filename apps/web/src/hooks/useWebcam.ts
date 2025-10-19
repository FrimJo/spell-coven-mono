import type { DetectorType } from '@/lib/detectors'
import { useCallback, useEffect, useRef, useState } from 'react'
import { setupWebcam } from '@/lib/webcam'
import { loadingEvents } from '@/lib/loading-events'

interface UseWebcamOptions {
  /** Enable card detection */
  enableCardDetection?: boolean
  /** Detector type to use (opencv, detr, owl-vit) */
  detectorType?: DetectorType
  /** Enable frame buffer for temporal optimization */
  useFrameBuffer?: boolean
  /** Enable perspective warp for corner refinement */
  usePerspectiveWarp?: boolean
  /** Callback when a card is cropped */
  onCrop?: (canvas: HTMLCanvasElement) => void
  /** Auto-start video on mount */
  autoStart?: boolean
  /** Preferred camera device ID */
  deviceId?: string | null
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
  /** Ref for camera select element */
  cameraSelectRef: React.RefObject<HTMLSelectElement | null>
  /** Start the webcam with optional device ID */
  startVideo: (deviceId?: string | null) => Promise<void>
  /** Stop the webcam */
  stopVideo: () => void
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
  /** Whether video stream is active */
  isVideoActive: boolean
}

/**
 * Hook for managing webcam with optional OpenCV card detection
 *
 * @example
 * ```tsx
 * const { videoRef, overlayRef, startVideo, isReady } = useWebcam({
 *   enableCardDetection: true,
 *   autoStart: true,
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
    useFrameBuffer = true,
    usePerspectiveWarp = true,
    onCrop: onCropProp,
    autoStart = false,
    deviceId = null,
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
  const cameraSelectRef = useRef<HTMLSelectElement>(null)

  const webcamController = useRef<Awaited<
    ReturnType<typeof setupWebcam>
  > | null>(null)
  const isInitialized = useRef(false)
  const autoStartRef = useRef(autoStart)
  const deviceIdRef = useRef(deviceId)

  // Update refs when props change
  autoStartRef.current = autoStart
  deviceIdRef.current = deviceId

  const [isReady, setIsReady] = useState(false)
  const [hasCroppedImage, setHasCroppedImage] = useState(false)
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVideoActive, setIsVideoActive] = useState(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      // Skip if already initialized (prevents re-initialization loop)
      if (isInitialized.current) {
        return
      }

      if (!enableCardDetection) {
        // Simple webcam without OpenCV
        setIsReady(true)
        setStatus('Ready')
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

      // Mark as initialized before starting async work
      isInitialized.current = true

      // Initialize webcam with card detection
      try {
        setIsLoading(true)
        setStatus('Loading detector…')

        webcamController.current = await setupWebcam({
          video: videoRef.current,
          overlay: overlayRef.current,
          cropped: croppedRef.current,
          fullRes: fullResRef.current,
          detectorType,
          useFrameBuffer,
          usePerspectiveWarp,
          onCrop: (canvas: HTMLCanvasElement) => {
            setHasCroppedImage(true)
            if (onCrop) {
              onCrop(canvas)
            }
          },
          onProgress: (msg: string) => {
            if (mounted) {
              setStatus(msg)
            }
          },
        })

        // Emit final game room setup events regardless of mounted state
        // (loading events need to fire to complete the loading UI)
        loadingEvents.emit({
          step: 'game-room',
          progress: 90,
          message: 'Setting up game room...',
        })

        // Wait for CLIP model to be ready before completing
        const { isModelReady } = await import('@/lib/clip-search')
        console.log('[useWebcam] Checking if CLIP model is ready...')
        
        let attempts = 0
        const maxAttempts = 100 // 20 seconds timeout
        while (!isModelReady() && attempts < maxAttempts) {
          if (attempts % 10 === 0) {
            console.log(`[useWebcam] Waiting for CLIP model... (${attempts}/${maxAttempts})`)
          }
          await new Promise((resolve) => setTimeout(resolve, 200))
          attempts++
        }

        if (!isModelReady()) {
          console.error('[useWebcam] ❌ CLIP model not ready after waiting 20 seconds')
          console.error('[useWebcam] This likely means the model failed to load. Check console for errors.')
        } else {
          console.log('[useWebcam] ✅ CLIP model is ready!')
        }

        loadingEvents.emit({
          step: 'complete',
          progress: 100,
          message: 'Game room ready!',
        })

        // Update component state only if still mounted
        if (mounted) {
          setIsReady(true)
          setStatus('Webcam ready')
          setIsLoading(false)

          // Auto-start if requested
          if (autoStartRef.current) {
            // In development, use demo video as default if no deviceId specified
            const defaultDeviceId =
              !deviceIdRef.current && import.meta.env.DEV
                ? 'video-file:/card_demo.webm'
                : deviceIdRef.current

            await webcamController.current.startVideo(defaultDeviceId)
            await webcamController.current.populateCameraSelect(
              cameraSelectRef.current,
            )
          }
        }
      } catch (err) {
        console.error('Webcam initialization error:', err)
        isInitialized.current = false
        if (mounted) {
          setStatus(
            `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          )
          setIsLoading(false)
        }
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
    useFrameBuffer,
    usePerspectiveWarp,
  ])

  const startVideo = async (deviceId?: string | null) => {
    if (enableCardDetection) {
      if (!webcamController.current) {
        console.error('Webcam controller not initialized')
        setStatus('Error: Webcam controller not ready')
        return
      }
      try {
        // In development, use demo video as default if no deviceId specified
        const finalDeviceId =
          !deviceId && import.meta.env.DEV
            ? 'video-file:/card_demo.webm'
            : deviceId || null

        await webcamController.current.startVideo(finalDeviceId)
        await webcamController.current.populateCameraSelect(
          cameraSelectRef.current,
        )
        setStatus('Webcam started')
        setIsVideoActive(true)
      } catch (err) {
        console.error('Failed to start webcam:', err)
        setStatus(
          `Error: ${err instanceof Error ? err.message : 'Failed to start webcam'}`,
        )
        setIsVideoActive(false)
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
        setIsVideoActive(true)
      } catch (err) {
        console.error('Failed to start webcam:', err)
        setStatus(
          `Error: ${err instanceof Error ? err.message : 'Failed to start webcam'}`,
        )
        setIsVideoActive(false)
      }
    }
  }

  const getCameras = async () => {
    if (webcamController.current) {
      return webcamController.current.getCameras()
    }
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cameras = devices.filter((d) => d.kind === 'videoinput')
    
    // In development mode, add mock video file as a camera option
    if (import.meta.env.DEV) {
      const mockCamera: MediaDeviceInfo = {
        deviceId: 'video-file:/card_demo.webm',
        kind: 'videoinput',
        label: 'Mock Webcam (Demo Video)',
        groupId: 'mock-group',
        toJSON: () => ({
          deviceId: 'video-file:/card_demo.webm',
          kind: 'videoinput',
          label: 'Mock Webcam (Demo Video)',
          groupId: 'mock-group',
        }),
      }
      cameras.unshift(mockCamera) // Add at the beginning
    }
    
    return cameras
  }

  const getCurrentDeviceId = () => {
    if (webcamController.current) {
      return webcamController.current.getCurrentDeviceId()
    }
    return null
  }

  const populateCameraSelect = async (selectEl: HTMLSelectElement | null) => {
    if (webcamController.current) {
      await webcamController.current.populateCameraSelect(selectEl)
    }
  }

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setIsVideoActive(false)
      setStatus('Video stopped')
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
    stopVideo,
    getCameras,
    getCurrentDeviceId,
    populateCameraSelect,
    getCroppedCanvas,
    isReady,
    hasCroppedImage,
    status,
    isLoading,
    isVideoActive,
  }
}

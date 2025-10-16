// Card detection for MTG webcam recognition
// Uses pluggable detector architecture (DETR, OWL-ViT, etc.)

import type { DetectedCard } from '@/types/card-query'

import type { CardDetector, DetectorType } from './detectors'
import {
  CROPPED_CARD_HEIGHT,
  CROPPED_CARD_WIDTH,
  DETECTION_INTERVAL_MS,
} from './detection-constants'
import { createDefaultDetector, createDetector } from './detectors'

// OpenCV removed - using DETR bounding boxes for cropping

// ============================================================================
// Detection State
// ============================================================================

let detector: CardDetector | null = null
let currentDetectorType: DetectorType | undefined = undefined
let detectionInterval: number | null = null
let detectedCards: DetectedCard[] = []
let isDetecting = false // Prevent overlapping detections

// ============================================================================
// Performance Monitoring
// ============================================================================

interface PerformanceMetrics {
  inferenceTimeMs: number[]
  detectionCount: number[]
  slowInferenceCount: number
}

let performanceMetrics: PerformanceMetrics = {
  inferenceTimeMs: [],
  detectionCount: [],
  slowInferenceCount: 0,
}

const SLOW_INFERENCE_THRESHOLD_MS = 1000

/**
 * Log performance metrics summary
 */
function logPerformanceMetrics() {
  if (performanceMetrics.inferenceTimeMs.length === 0) return

  // Performance metrics calculation (for future use)
  void (performanceMetrics.inferenceTimeMs.reduce((a, b) => a + b, 0) /
    performanceMetrics.inferenceTimeMs.length)
  void Math.max(...performanceMetrics.inferenceTimeMs)
  void Math.min(...performanceMetrics.inferenceTimeMs)


  // Reset metrics
  performanceMetrics = {
    inferenceTimeMs: [],
    detectionCount: [],
    slowInferenceCount: 0,
  }
}

// Log metrics every 30 seconds
setInterval(logPerformanceMetrics, 30000)

// ============================================================================
// Canvas and Video Elements
// ============================================================================

let overlayCtx: CanvasRenderingContext2D | null = null
let fullResCtx: CanvasRenderingContext2D | null = null
let croppedCtx: CanvasRenderingContext2D | null = null
let videoEl: HTMLVideoElement
let overlayEl: HTMLCanvasElement
let fullResCanvas: HTMLCanvasElement
let croppedCanvas: HTMLCanvasElement

// ============================================================================
// Animation State
// ============================================================================

let animationStarted = false

// ============================================================================
// Media Stream State
// ============================================================================

let currentStream: MediaStream | null = null
let currentDeviceId: string | null = null
let clickHandler: ((evt: MouseEvent) => void) | null = null

// ============================================================================
// Detector Initialization
// ============================================================================

/**
 * Initialize card detector with comprehensive error handling
 * @param detectorType Optional detector type to use
 * @param onProgress Optional callback for progress updates
 * @returns Promise resolving when detector is ready
 * @throws Error with user-friendly message if initialization fails
 */
async function initializeDetector(
  detectorType?: DetectorType,
  onProgress?: (msg: string) => void,
): Promise<void> {
  try {
    // If detector type changed, dispose old detector
    if (detector && currentDetectorType !== detectorType) {
      detector.dispose()
      detector = null
      currentDetectorType = undefined
      // Reset animation flag so detection loop can start again
      animationStarted = false
      // Stop existing detection loop
      stopDetection()
    }

    // Return if already initialized with same type
    if (
      detector &&
      detector.getStatus() === 'ready' &&
      currentDetectorType === detectorType
    ) {
      return
    }

    // Create detector if not exists
    if (!detector) {
      if (detectorType) {
        detector = createDetector(detectorType, { onProgress })
        currentDetectorType = detectorType
      } else {
        detector = createDefaultDetector(onProgress)
        currentDetectorType = undefined
      }
    }

    // Initialize detector
    await detector.initialize()
  } catch (err) {
    // Provide user-friendly error messages based on error type
    const errorMessage = err instanceof Error ? err.message : String(err)

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      const friendlyError = new Error(
        'Detection model unavailable - please check your internet connection and try again',
      )
      friendlyError.cause = err
      throw friendlyError
    } else if (errorMessage.includes('WebGL') || errorMessage.includes('GPU')) {
      const friendlyError = new Error(
        "Your browser doesn't support required features for card detection. Please enable hardware acceleration or try a different browser.",
      )
      friendlyError.cause = err
      throw friendlyError
    } else if (errorMessage.includes('WebGPU')) {
      const friendlyError = new Error(
        'WebGPU not supported. Card detection will use fallback mode which may be slower.',
      )
      friendlyError.cause = err
      console.warn('[Detector]', friendlyError.message)
      // Don't throw - allow fallback to work
    } else {
      const friendlyError = new Error(
        'Failed to initialize card detection. Please refresh the page and try again.',
      )
      friendlyError.cause = err
      console.error('[Detector] Initialization error:', err)
      throw friendlyError
    }
  }
}

/**
 * Draw a polygon on the canvas
 * @param ctx Canvas rendering context
 * @param points Array of points defining the polygon
 * @param color Stroke color (default: 'lime')
 * @param lineWidth Line width in pixels (default: 3)
 */
function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  color = 'lime',
  lineWidth = 3,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()
  ctx.stroke()
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Render detected cards on overlay canvas
 * Draws bounding boxes around each detected card
 * @param cards Array of detected cards with polygon coordinates
 */
function renderDetections(cards: DetectedCard[]) {
  cards.forEach((card) => {
    drawPolygon(overlayCtx!, card.polygon)
  })
}

/**
 * Run detection on current video frame
 * Captures video frame, runs detector inference, filters results, and renders bounding boxes
 * Includes performance monitoring and error handling
 */
async function detectCards() {
  // Skip if already detecting or detector not ready
  if (!detector) {
    return
  }
  if (detector.getStatus() !== 'ready') {
    return
  }
  if (isDetecting) {
    return
  }

  isDetecting = true

  try {
    // Create a temporary canvas for detection (don't touch the overlay yet)
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = overlayEl.width
    tempCanvas.height = overlayEl.height
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height)

    // Run detection using pluggable detector
    const result = await detector.detect(
      tempCanvas,
      overlayEl.width,
      overlayEl.height,
    )

    detectedCards = result.cards

    // Track performance metrics
    performanceMetrics.inferenceTimeMs.push(result.inferenceTimeMs)
    performanceMetrics.detectionCount.push(detectedCards.length)

    // Log slow inferences
    if (result.inferenceTimeMs > SLOW_INFERENCE_THRESHOLD_MS) {
      performanceMetrics.slowInferenceCount++
      console.warn(
        `[Performance] Slow inference: ${result.inferenceTimeMs.toFixed(0)}ms (threshold: ${SLOW_INFERENCE_THRESHOLD_MS}ms)`,
      )
    }

    // Only update overlay if we have detections (minimize canvas operations)
    overlayCtx!.clearRect(0, 0, overlayEl.width, overlayEl.height)
    if (detectedCards.length > 0) {
      renderDetections(detectedCards)
    }

    // Log detection results (less verbose)
    if (detectedCards.length > 0) {
      // Detection logging removed
    }
  } catch (err) {
    console.error('[Detector] Detection error:', err)
    // Don't throw - allow detection to continue on next interval
  } finally {
    isDetecting = false
  }
}

/**
 * Start detection loop
 * Begins periodic detection at configured interval (default: 500ms)
 */
function startDetection() {
  if (detectionInterval) {
    return
  }
  detectionInterval = window.setInterval(detectCards, DETECTION_INTERVAL_MS)
}

/**
 * Stop detection loop
 * Clears detection interval, overlay canvas, and resets detection state
 */
function stopDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval)
    detectionInterval = null
  }
  // Clear overlay when stopping
  if (overlayCtx && overlayEl) {
    overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height)
  }
  detectedCards = []
  isDetecting = false
}

/**
 * Crop card using DETR bounding box with square center-crop preprocessing
 * CRITICAL: Must match Python embedding pipeline preprocessing for accuracy
 * Python pipeline: center-crop to square (min dimension) → resize to 384×384
 * See: packages/mtg-image-db/build_mtg_faiss.py lines 122-135
 * @param box Bounding box from DETR detection (normalized coordinates)
 * @returns True if crop succeeded
 */
function cropCardFromBoundingBox(box: {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}): boolean {
  // Draw full resolution video to canvas
  fullResCanvas.width = videoEl.videoWidth
  fullResCanvas.height = videoEl.videoHeight
  fullResCtx!.drawImage(
    videoEl,
    0,
    0,
    fullResCanvas.width,
    fullResCanvas.height,
  )

  // Convert normalized coordinates to pixels
  const x = box.xmin * fullResCanvas.width
  const y = box.ymin * fullResCanvas.height
  const cardWidth = (box.xmax - box.xmin) * fullResCanvas.width
  const cardHeight = (box.ymax - box.ymin) * fullResCanvas.height


  // CRITICAL FIX: Apply square center-crop to match Python preprocessing
  // Python does: s = min(w, h); crop to square; resize to 384×384
  const minDim = Math.min(cardWidth, cardHeight)
  const cropX = x + (cardWidth - minDim) / 2
  const cropY = y + (cardHeight - minDim) / 2


  // Extract square region from center of card
  const cardImageData = fullResCtx!.getImageData(cropX, cropY, minDim, minDim)

  // Create temporary canvas for the square extracted region
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = minDim
  tempCanvas.height = minDim
  const tempCtx = tempCanvas.getContext('2d')!
  tempCtx.putImageData(cardImageData, 0, 0)

  // Resize to 384×384 (matching Python target_size parameter)
  croppedCanvas.width = CROPPED_CARD_WIDTH
  croppedCanvas.height = CROPPED_CARD_HEIGHT
  croppedCtx!.clearRect(0, 0, croppedCanvas.width, croppedCanvas.height)
  croppedCtx!.drawImage(
    tempCanvas,
    0,
    0,
    minDim,
    minDim,
    0,
    0,
    CROPPED_CARD_WIDTH,
    CROPPED_CARD_HEIGHT,
  )

  // Log cropped card as blob for debugging
  tempCanvas.toBlob((blob) => {
    if (blob) {
      void URL.createObjectURL(blob)
    }
  }, 'image/png')

  return true
}

/**
 * Crop card at click position
 * Finds the closest DETR-detected card and crops it
 * @param x Click X coordinate on overlay canvas
 * @param y Click Y coordinate on overlay canvas
 * @returns Boolean indicating success
 */
function cropCardAt(x: number, y: number): boolean {
  // Need detected cards to crop
  if (!detectedCards.length) {
    console.warn('[Webcam] No cards detected - cannot crop')
    return false
  }

  // Find closest card to click position
  let closestIndex = -1
  let minDist = Infinity

  for (let i = 0; i < detectedCards.length; i++) {
    const card = detectedCards[i]
    const poly = card.polygon

    // Calculate center of polygon
    let cx = 0
    let cy = 0
    for (const p of poly) {
      cx += p.x
      cy += p.y
    }
    cx /= poly.length
    cy /= poly.length

    const d = Math.hypot(cx - x, cy - y)
    if (d < minDist) {
      minDist = d
      closestIndex = i
    }
  }

  if (closestIndex === -1) {
    console.warn('[Webcam] No card found near click')
    return false
  }

  const card = detectedCards[closestIndex]

  // Use the DETR bounding box to crop
  return cropCardFromBoundingBox(card.box)
}

/**
 * Setup webcam detection system
 * Initializes detector, configures canvases, and sets up event handlers
 * @param args Configuration object
 * @param args.video Video element displaying webcam stream
 * @param args.overlay Canvas for detection overlay rendering
 * @param args.cropped Canvas for cropped card output (315x440px)
 * @param args.fullRes Canvas for full-resolution frame capture
 * @param args.detectorType Optional detector type ('detr', 'owl-vit', 'opencv')
 * @param args.onCrop Optional callback when card is cropped, receives the cropped canvas
 * @param args.onProgress Optional callback for model loading progress
 * @returns Promise resolving to webcam control interface
 */
export async function setupWebcam(args: {
  video: HTMLVideoElement
  overlay: HTMLCanvasElement
  cropped: HTMLCanvasElement
  fullRes: HTMLCanvasElement
  detectorType?: DetectorType
  onCrop?: (canvas: HTMLCanvasElement) => void
  onProgress?: (msg: string) => void
}) {
  videoEl = args.video
  overlayEl = args.overlay
  croppedCanvas = args.cropped
  fullResCanvas = args.fullRes

  // Set cropped canvas to MTG card aspect ratio (63:88)
  croppedCanvas.width = CROPPED_CARD_WIDTH
  croppedCanvas.height = CROPPED_CARD_HEIGHT

  overlayCtx = overlayEl.getContext('2d', { willReadFrequently: true })
  fullResCtx = fullResCanvas.getContext('2d', { willReadFrequently: true })
  croppedCtx = croppedCanvas.getContext('2d')

  // Initialize detector
  try {
    await initializeDetector(args.detectorType, args.onProgress)
  } catch (err) {
    console.error('[Detector] Failed to initialize:', err)
    throw err
  }

  // Remove any existing click handler to prevent multiple listeners
  if (clickHandler) {
    overlayEl.removeEventListener('click', clickHandler)
  }

  // Create new click handler
  clickHandler = (evt: MouseEvent) => {
    const rect = overlayEl.getBoundingClientRect()
    const x = evt.clientX - rect.left
    const y = evt.clientY - rect.top

    // Use requestAnimationFrame to make this async and prevent blocking Playwright
    // This ensures the click event completes before we process the crop
    requestAnimationFrame(() => {
      const ok = cropCardAt(x, y)
      if (ok && typeof args.onCrop === 'function') {
        args.onCrop(croppedCanvas)
      }
    })
  }

  overlayEl.addEventListener('click', clickHandler)

  return {
    async startVideo(deviceId: string | null = null) {

      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop())
        currentStream = null
      }

      // Handle video file source (for testing/demo)
      if (deviceId?.startsWith('video-file:')) {
        const videoPath = deviceId.replace('video-file:', '')
        videoEl.src = videoPath
        videoEl.loop = true
        videoEl.muted = true
        currentDeviceId = deviceId
        return new Promise<void>((resolve) => {
          videoEl.onloadedmetadata = () => {
            void videoEl.play()
            if (!animationStarted) {
              animationStarted = true
              startDetection()
            }
            resolve()
          }
        })
      }

      // Handle regular webcam
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: deviceId
          ? {
              deviceId: { exact: deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } },
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        currentStream = stream
        videoEl.srcObject = stream
        const track = stream.getVideoTracks()[0]
        const settings = (
          track.getSettings ? track.getSettings() : {}
        ) as MediaTrackSettings
        currentDeviceId = settings.deviceId || deviceId || null
        return new Promise<void>((resolve) => {
          videoEl.onloadedmetadata = () => {
            void videoEl.play()
            if (!animationStarted) {
              animationStarted = true
              startDetection()
            }
            resolve()
          }
        })
      } catch (err) {
        console.error('[webcam] Failed to get camera access:', err)
        throw err
      }
    },
    async getCameras() {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((d) => d.kind === 'videoinput')
    },
    getCurrentDeviceId() {
      return currentDeviceId
    },
    async populateCameraSelect(selectEl: HTMLSelectElement | null | undefined) {
      if (!selectEl) return
      const cams = await this.getCameras()
      const prev = selectEl.value
      selectEl.innerHTML = ''
      cams.forEach((cam, idx) => {
        const opt = document.createElement('option')
        opt.value = cam.deviceId
        opt.text = cam.label || `Camera ${idx + 1}`
        selectEl.appendChild(opt)
      })
      if (prev && Array.from(selectEl.options).some((o) => o.value === prev))
        selectEl.value = prev
      else if (
        currentDeviceId &&
        Array.from(selectEl.options).some((o) => o.value === currentDeviceId)
      )
        selectEl.value = currentDeviceId
    },
    getCroppedCanvas() {
      return croppedCanvas
    },
    stopDetection() {
      stopDetection()
    },
  }
}

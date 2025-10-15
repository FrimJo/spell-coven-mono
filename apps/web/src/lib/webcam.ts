// DETR-based card detection for MTG webcam recognition
// Uses Transformers.js for browser-native object detection

/* eslint-disable @typescript-eslint/no-explicit-any */

import { pipeline } from '@huggingface/transformers'
import type { DetectedCard, DetectionResult, Point } from '@/types/card-query'
import {
  CONFIDENCE_THRESHOLD,
  DETECTION_INTERVAL_MS,
  DETR_MODEL_ID,
  isValidCardAspectRatio,
  CROPPED_CARD_WIDTH,
  CROPPED_CARD_HEIGHT,
} from './detection-constants'

declare global {
  // OpenCV global (legacy - only used for perspective transform)
  var cv: any
}

// ============================================================================
// DETR Detection State
// ============================================================================

let detector: any = null
let detectionInterval: number | null = null
let statusCallback: ((msg: string) => void) | null = null
let detectedCards: DetectedCard[] = []

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
// Legacy OpenCV State (only for perspective transform)
// ============================================================================

let animationStarted = false

// ============================================================================
// Media Stream State
// ============================================================================

let currentStream: MediaStream | null = null
let currentDeviceId: string | null = null
let clickHandler: ((evt: MouseEvent) => void) | null = null

// ============================================================================
// DETR Pipeline Initialization
// ============================================================================

/**
 * Set loading status message
 */
function setStatus(msg: string) {
  console.log(`[DETR] ${msg}`)
  statusCallback?.(msg)
}

/**
 * Load DETR detection model
 * @param onProgress Optional callback for progress updates
 * @returns Promise resolving to detector pipeline
 */
async function loadDetector(onProgress?: (msg: string) => void): Promise<any> {
  if (detector) return detector

  statusCallback = onProgress || null
  setStatus('Loading detection model...')

  try {
    detector = await pipeline('object-detection', DETR_MODEL_ID, {
      progress_callback: (progress: any) => {
        if (progress.status === 'downloading') {
          const percent = Math.round(progress.progress || 0)
          setStatus(`Downloading: ${progress.file} - ${percent}%`)
        } else if (progress.status === 'done') {
          setStatus(`Loaded: ${progress.file}`)
        }
      },
    })

    setStatus('Detection ready')
    return detector
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unknown error loading detector'
    setStatus(`Failed to load detection model: ${errorMsg}`)
    throw err
  }
}

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
// DETR Detection Functions
// ============================================================================

/**
 * Convert bounding box to 4-point polygon for rendering
 */
function boundingBoxToPolygon(
  box: { xmin: number; ymin: number; xmax: number; ymax: number },
  canvasWidth: number,
  canvasHeight: number,
): Point[] {
  const xmin = box.xmin * canvasWidth
  const ymin = box.ymin * canvasHeight
  const xmax = box.xmax * canvasWidth
  const ymax = box.ymax * canvasHeight

  return [
    { x: xmin, y: ymin }, // Top-left
    { x: xmax, y: ymin }, // Top-right
    { x: xmax, y: ymax }, // Bottom-right
    { x: xmin, y: ymax }, // Bottom-left
  ]
}

/**
 * Filter DETR detections by confidence and aspect ratio
 */
function filterCardDetections(detections: DetectionResult[]): DetectedCard[] {
  return detections
    .filter((det) => {
      // Filter by confidence threshold
      if (det.score < CONFIDENCE_THRESHOLD) return false

      // Calculate aspect ratio
      const width = det.box.xmax - det.box.xmin
      const height = det.box.ymax - det.box.ymin
      const aspectRatio = width / height

      // Filter by aspect ratio
      return isValidCardAspectRatio(aspectRatio)
    })
    .map((det) => ({
      box: det.box,
      score: det.score,
      aspectRatio: (det.box.xmax - det.box.xmin) / (det.box.ymax - det.box.ymin),
      polygon: boundingBoxToPolygon(det.box, overlayEl.width, overlayEl.height),
    }))
}

/**
 * Render detected cards on overlay canvas
 */
function renderDetections(cards: DetectedCard[]) {
  cards.forEach((card) => {
    drawPolygon(overlayCtx!, card.polygon)
  })
}

/**
 * Run DETR detection on current video frame
 */
async function detectCards() {
  if (!detector) return

  // Clear overlay and draw current frame
  overlayCtx!.clearRect(0, 0, overlayEl.width, overlayEl.height)
  overlayCtx!.drawImage(videoEl, 0, 0, overlayEl.width, overlayEl.height)

  try {
    // Run DETR inference
    const detections: DetectionResult[] = await detector(overlayEl, {
      threshold: CONFIDENCE_THRESHOLD,
      percentage: true,
    })

    // Filter and convert to DetectedCard format
    detectedCards = filterCardDetections(detections)

    // Render bounding boxes
    renderDetections(detectedCards)
  } catch (err) {
    console.error('[DETR] Detection error:', err)
  }
}

/**
 * Start detection loop
 */
function startDetection() {
  if (detectionInterval) return
  detectionInterval = window.setInterval(detectCards, DETECTION_INTERVAL_MS)
}

/**
 * Stop detection loop
 */
function stopDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval)
    detectionInterval = null
  }
}

/**
 * Crop card at click position
 * Finds closest detected card and applies perspective transform
 */
function cropCardAt(x: number, y: number) {
  if (!detectedCards.length) return false

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

  if (closestIndex === -1) return false

  const card = detectedCards[closestIndex]
  const poly = card.polygon
  if (videoEl.videoWidth && videoEl.videoHeight) {
    fullResCanvas.width = videoEl.videoWidth
    fullResCanvas.height = videoEl.videoHeight
    fullResCtx!.drawImage(
      videoEl,
      0,
      0,
      fullResCanvas.width,
      fullResCanvas.height,
    )
  }
  // Scale polygon points to full resolution
  const scaleX = fullResCanvas.width / overlayEl.width
  const scaleY = fullResCanvas.height / overlayEl.height
  const coords = [
    poly[0].x * scaleX,
    poly[0].y * scaleY,
    poly[1].x * scaleX,
    poly[1].y * scaleY,
    poly[2].x * scaleX,
    poly[2].y * scaleY,
    poly[3].x * scaleX,
    poly[3].y * scaleY,
  ]
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, coords)
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    croppedCanvas.width,
    0,
    croppedCanvas.width,
    croppedCanvas.height,
    0,
    croppedCanvas.height,
  ])
  const M = cv.getPerspectiveTransform(srcTri, dstTri)
  const frImage = fullResCtx!.getImageData(
    0,
    0,
    fullResCanvas.width,
    fullResCanvas.height,
  )
  const frMat = cv.matFromImageData(frImage)
  const dst = new cv.Mat()
  cv.warpPerspective(
    frMat,
    dst,
    M,
    new cv.Size(croppedCanvas.width, croppedCanvas.height),
  )
  
  // Ensure the output is in RGBA format for ImageData
  const rgba = new cv.Mat()
  if (dst.channels() === 3) {
    cv.cvtColor(dst, rgba, cv.COLOR_RGB2RGBA)
  } else if (dst.channels() === 4) {
    dst.copyTo(rgba)
  } else {
    // Fallback for unexpected channel count
    cv.cvtColor(dst, rgba, cv.COLOR_GRAY2RGBA)
  }
  
  const imgData = new ImageData(
    new Uint8ClampedArray(rgba.data),
    rgba.cols,
    rgba.rows,
  )
  croppedCtx!.putImageData(imgData, 0, 0)
  rgba.delete()
  srcTri.delete()
  dstTri.delete()
  M.delete()
  dst.delete()
  frMat.delete()
  return true
}

export async function setupWebcam(args: {
  video: HTMLVideoElement
  overlay: HTMLCanvasElement
  cropped: HTMLCanvasElement
  fullRes: HTMLCanvasElement
  onCrop?: () => void
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

  // Load DETR detector
  try {
    await loadDetector(args.onProgress)
  } catch (err) {
    console.error('[DETR] Failed to load detector:', err)
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
        args.onCrop()
      }
    })
  }

  overlayEl.addEventListener('click', clickHandler)

  return {
    async startVideo(deviceId: string | null = null) {
      console.log('[webcam] startVideo called with deviceId:', deviceId)
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop())
        currentStream = null
      }
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
      console.log(
        '[webcam] Requesting camera access with constraints:',
        constraints,
      )
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        console.log('[webcam] Camera access granted, stream:', stream)
        currentStream = stream
        videoEl.srcObject = stream
        const track = stream.getVideoTracks()[0]
        const settings = (
          track.getSettings ? track.getSettings() : {}
        ) as MediaTrackSettings
        currentDeviceId = settings.deviceId || deviceId || null
        console.log('[webcam] Video track settings:', settings)
        return new Promise<void>((resolve) => {
          videoEl.onloadedmetadata = () => {
            console.log('[webcam] Video metadata loaded, starting playback')
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

// Card detection for MTG webcam recognition
// Uses pluggable detector architecture (DETR, OWL-ViT, etc.)

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { DetectedCard } from '@/types/card-query'
import {
  CROPPED_CARD_HEIGHT,
  CROPPED_CARD_WIDTH,
  DETECTION_INTERVAL_MS,
} from './detection-constants'
import { createDefaultDetector, createDetector, type CardDetector, type DetectorType } from './detectors'

declare global {
  // OpenCV global (legacy - only used for perspective transform)
  var cv: any
}

// ============================================================================
// Detection State
// ============================================================================

let detector: CardDetector | null = null
let currentDetectorType: DetectorType | undefined = undefined
let detectionInterval: number | null = null
let detectedCards: DetectedCard[] = []
let isDetecting = false // Prevent overlapping detections

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
// Legacy OpenCV State (only for perspective transform and click-based cropping)
// ============================================================================

let animationStarted = false
let opencvLoadPromise: Promise<void> | null = null

/**
 * Ensure OpenCV is loaded (required for click-based cropping)
 */
async function ensureOpenCVLoaded(): Promise<void> {
  if (window.cv && window.cv.Mat) {
    return // Already loaded
  }

  if (opencvLoadPromise) {
    return opencvLoadPromise // Already loading
  }

  opencvLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://docs.opencv.org/4.5.2/opencv.js'
    script.async = true
    
    script.onerror = () => {
      opencvLoadPromise = null
      reject(new Error('Failed to load OpenCV.js'))
    }

    const checkReady = () => {
      if (window.cv && window.cv.Mat) {
        console.log('[Webcam] OpenCV loaded for click-based cropping')
        resolve()
      } else {
        setTimeout(checkReady, 100)
      }
    }

    script.onload = () => {
      checkReady()
    }

    document.head.appendChild(script)
  })

  return opencvLoadPromise
}

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
 * Initialize card detector
 * @param detectorType Optional detector type to use
 * @param onProgress Optional callback for progress updates
 * @returns Promise resolving when detector is ready
 */
async function initializeDetector(
  detectorType?: DetectorType,
  onProgress?: (msg: string) => void
): Promise<void> {
  // If detector type changed, dispose old detector
  if (detector && currentDetectorType !== detectorType) {
    console.log(`[Detector] Switching from ${currentDetectorType} to ${detectorType}`)
    detector.dispose()
    detector = null
    currentDetectorType = undefined
    // Reset animation flag so detection loop can start again
    animationStarted = false
    // Stop existing detection loop
    stopDetection()
  }

  // Return if already initialized with same type
  if (detector && detector.getStatus() === 'ready' && currentDetectorType === detectorType) {
    console.log('[Detector] Already initialized')
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
// Detection Functions
// ============================================================================

/**
 * Render detected cards on overlay canvas
 */
function renderDetections(cards: DetectedCard[]) {
  cards.forEach((card) => {
    drawPolygon(overlayCtx!, card.polygon)
  })
}

/**
 * Run detection on current video frame
 */
async function detectCards() {
  // Skip if already detecting or detector not ready
  if (!detector) {
    console.log('[Detector] No detector available')
    return
  }
  if (detector.getStatus() !== 'ready') {
    console.log(`[Detector] Detector not ready, status: ${detector.getStatus()}`)
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
      overlayEl.height
    )

    detectedCards = result.cards

    // Only update overlay if we have detections (minimize canvas operations)
    overlayCtx!.clearRect(0, 0, overlayEl.width, overlayEl.height)
    if (detectedCards.length > 0) {
      renderDetections(detectedCards)
    }

    // Log detection results (less verbose)
    if (detectedCards.length > 0) {
      console.log(
        `[Detector] ${result.inferenceTimeMs.toFixed(0)}ms | ${detectedCards.length} card(s)`,
      )
    }
  } catch (err) {
    console.error('[Detector] Detection error:', err)
  } finally {
    isDetecting = false
  }
}

/**
 * Start detection loop
 */
function startDetection() {
  if (detectionInterval) {
    console.log('[Detector] Detection loop already running')
    return
  }
  console.log('[Detector] Starting detection loop')
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
  // Clear overlay when stopping
  if (overlayCtx && overlayEl) {
    overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height)
  }
  detectedCards = []
  isDetecting = false
}

/**
 * Crop card at click position using ROI-based detection
 * Clean implementation based on ChatGPT's algorithm
 */
async function cropCardAtClick(x: number, y: number): Promise<boolean> {
  if (!window.cv) {
    console.error('[Webcam] OpenCV not loaded')
    return false
  }

  const cv = window.cv

  // Draw full resolution video to canvas
  fullResCanvas.width = videoEl.videoWidth
  fullResCanvas.height = videoEl.videoHeight
  fullResCtx!.drawImage(videoEl, 0, 0, fullResCanvas.width, fullResCanvas.height)

  // Scale click coordinates to full resolution
  const scaleX = fullResCanvas.width / overlayEl.width
  const scaleY = fullResCanvas.height / overlayEl.height
  const clickX = Math.floor(x * scaleX)
  const clickY = Math.floor(y * scaleY)
  
  const fullW = fullResCanvas.width
  const fullH = fullResCanvas.height
  
  console.log('[Webcam] Click:', clickX, clickY, '/', fullW, 'x', fullH)

  // ROI around click (~50% of min dimension to catch whole card)
  const base = Math.floor(0.5 * Math.min(fullW, fullH))
  const half = Math.max(100, Math.floor(base / 2))
  const roiX = Math.max(0, clickX - half)
  const roiY = Math.max(0, clickY - half)
  const roiW = Math.min(half * 2, fullW - roiX)
  const roiH = Math.min(half * 2, fullH - roiY)
  
  console.log('[Webcam] ROI:', roiX, roiY, roiW, 'x', roiH, '(', (roiW*roiH).toFixed(0), 'px²)')

  // Extract ROI
  const roiImageData = fullResCtx!.getImageData(roiX, roiY, roiW, roiH)
  const roi = cv.matFromImageData(roiImageData)
  
  // Preprocess
  const gray = new cv.Mat()
  const blur = new cv.Mat()
  cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY)
  cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
  
  // Adaptive threshold + morphology
  const thresh = new cv.Mat()
  cv.adaptiveThreshold(blur, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 15, 3)
  
  // Canny edges with lower thresholds to catch more edges
  const edges = new cv.Mat()
  cv.Canny(blur, edges, 30, 90)
  
  // Combine
  const mask = new cv.Mat()
  cv.bitwise_or(thresh, edges, mask)
  
  // Dilate to connect broken edges and make contours more solid
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5))
  cv.dilate(mask, mask, kernel, new cv.Point(-1, -1), 2)
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel)
  
  // Find contours
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
  
  const localClick = new cv.Point(clickX - roiX, clickY - roiY)
  let best: any = null
  
  console.log('[Webcam] Found', contours.size(), 'contours')
  
  const minArea = Math.max(1000, roiW * roiH * 0.01) // At least 1% of ROI
  console.log('[Webcam] Min area threshold:', minArea.toFixed(0))
  
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i)
    const area = cv.contourArea(cnt)
    
    if (area < minArea) { 
      console.log(`[Webcam] Contour ${i}: area=${area.toFixed(0)} (too small)`)
      cnt.delete()
      continue
    }
    
    console.log(`[Webcam] Contour ${i}: area=${area.toFixed(0)} ✓`)
    
    // Prefer contours containing click; else nearest
    const dist = cv.pointPolygonTest(cnt, localClick, true)
    
    // Try quad
    const peri = cv.arcLength(cnt, true)
    const approx = new cv.Mat()
    cv.approxPolyDP(cnt, approx, 0.02 * peri, true)
    
    let pts: number[][] = []
    if (approx.rows === 4 && cv.isContourConvex(approx)) {
      for (let r = 0; r < 4; r++) {
        const p = approx.intPtr(r)
        pts.push([p[0] + roiX, p[1] + roiY])
      }
    } else {
      // Fallback: rotated rect
      const rr = cv.minAreaRect(cnt)
      const box = new cv.Mat()
      cv.boxPoints(rr, box)
      for (let r = 0; r < 4; r++) {
        const p = box.floatPtr(r)
        pts.push([p[0] + roiX, p[1] + roiY])
      }
      box.delete()
    }
    
    const cand = { 
      pts, 
      area, 
      pref: dist >= 0 ? 1 : 0, 
      dist: Math.abs(dist) 
    }
    
    if (!best || cand.pref > best.pref || (cand.pref === best.pref && cand.area > best.area)) {
      best = cand
    }
    
    approx.delete()
    cnt.delete()
  }
  
  // Cleanup
  roi.delete()
  gray.delete()
  blur.delete()
  thresh.delete()
  edges.delete()
  mask.delete()
  kernel.delete()
  contours.delete()
  hierarchy.delete()
  
  if (!best) {
    console.log('[Webcam] No card found')
    return false
  }
  
  console.log('[Webcam] Best contour: area=' + best.area + ', dist=' + best.dist.toFixed(1))
  
  // Order quad: TL, TR, BR, BL
  const ordered = orderQuad(best.pts)
  
  // Draw overlay
  const overlayScaleX = overlayEl.width / fullW
  const overlayScaleY = overlayEl.height / fullH
  overlayCtx!.clearRect(0, 0, overlayEl.width, overlayEl.height)
  overlayCtx!.strokeStyle = 'lime'
  overlayCtx!.lineWidth = 4
  overlayCtx!.beginPath()
  for (let i = 0; i < 4; i++) {
    const px = ordered[i][0] * overlayScaleX
    const py = ordered[i][1] * overlayScaleY
    if (i === 0) overlayCtx!.moveTo(px, py)
    else overlayCtx!.lineTo(px, py)
  }
  overlayCtx!.closePath()
  overlayCtx!.stroke()
  
  setTimeout(() => overlayCtx!.clearRect(0, 0, overlayEl.width, overlayEl.height), 3000)
  
  // Warp
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flat())
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    croppedCanvas.width, 0,
    croppedCanvas.width, croppedCanvas.height,
    0, croppedCanvas.height
  ])
  
  const M = cv.getPerspectiveTransform(srcTri, dstTri)
  const frImage = fullResCtx!.getImageData(0, 0, fullW, fullH)
  const frMat = cv.matFromImageData(frImage)
  const dst = new cv.Mat()
  
  cv.warpPerspective(frMat, dst, M, new cv.Size(croppedCanvas.width, croppedCanvas.height))
  
  const imgData = new ImageData(
    new Uint8ClampedArray(dst.data, 0, dst.cols * dst.rows * 4),
    dst.cols,
    dst.rows
  )
  croppedCtx!.putImageData(imgData, 0, 0)
  
  srcTri.delete()
  dstTri.delete()
  M.delete()
  frMat.delete()
  dst.delete()
  
  croppedCanvas.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob)
      console.log('[Webcam] Cropped card:', url)
    }
  }, 'image/png')
  
  return true
}

// Helper: order quad points as TL, TR, BR, BL
function orderQuad(pts: number[][]): number[][] {
  const centroid = [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length
  ]
  const angle = (p: number[]) => Math.atan2(p[1] - centroid[1], p[0] - centroid[0])
  const sorted = [...pts].sort((a, b) => angle(a) - angle(b))
  
  const top = [...sorted].sort((a, b) => a[1] - b[1]).slice(0, 2).sort((a, b) => a[0] - b[0])
  const bot = [...sorted].sort((a, b) => b[1] - a[1]).slice(0, 2).sort((a, b) => a[0] - b[0])
  
  return [top[0], top[1], bot[1], bot[0]]
}

/**
 * Crop card at click position (legacy - requires detection)
 * Finds closest detected card and applies perspective transform
 */
function cropCardAt(x: number, y: number) {
  // Try direct crop first (no detection needed)
  if (!detectedCards.length) {
    return cropCardAtClick(x, y)
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
  detectorType?: DetectorType
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
        args.onCrop()
      }
    })
  }

  overlayEl.addEventListener('click', clickHandler)

  return {
    async startVideo(deviceId: string | null = null) {
      console.log('[webcam] startVideo called with deviceId:', deviceId)
      
      // Load OpenCV for click-based cropping (async, don't block video start)
      ensureOpenCVLoaded().catch(err => {
        console.error('[webcam] Failed to load OpenCV:', err)
      })
      
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

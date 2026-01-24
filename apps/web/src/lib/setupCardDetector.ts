// Card detection for MTG webcam recognition
// Uses pluggable detector architecture (DETR, OWL-ViT, etc.)

import type { DetectedCard } from '@/types/card-query'

import { isDevelopment } from '@/env.js'
import type { CardDetector, DetectorType } from './detectors/index.js'
import {
  enhanceCanvasContrast,
  getQueryContrastEnhancement,
  warmModel,
} from './clip-search.js'
import {
  CROPPED_CARD_HEIGHT,
  CROPPED_CARD_WIDTH,
} from './detection-constants.js'
import { refineBoundingBoxToCorners } from './detectors/geometry/bbox-refinement.js'
import { warpCardToCanonical } from './detectors/geometry/perspective.js'
import { createDetector } from './detectors/index.js'
import { loadingEvents } from './loading-events.js'

// ============================================================================
// Debug Blob URL Helpers
// ============================================================================

/**
 * Generate a blob URL from a canvas and log it to the console for debugging
 * @param canvas The canvas to capture
 * @param stageName The name of the pipeline stage
 * @param stageNumber The stage number (1-based)
 * @param color CSS color for the console badge
 */
function logDebugBlobUrl(
  canvas: HTMLCanvasElement,
  stageName: string,
  stageNumber: number,
  color: string,
): void {
  canvas.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob)
      console.groupCollapsed(
        `%c[DEBUG STAGE ${stageNumber}] ${stageName}`,
        `background: ${color}; color: white; padding: 2px 6px; border-radius: 3px;`,
      )
      console.log(
        '%c ',
        `background: url(${url}) no-repeat; background-size: contain; padding: 100px 150px;`,
      )
      console.log('Blob URL (copy this):', url)
      console.log('Dimensions:', `${canvas.width}x${canvas.height}`)
      console.groupEnd()
    }
  }, 'image/png')
}

// OpenCV removed - using DETR bounding boxes for cropping

// ============================================================================
// Detection State
// ============================================================================

let detector: CardDetector | null = null
let currentDetectorType: DetectorType | undefined = undefined
let detectionInterval: number | null = null
let detectedCards: DetectedCard[] = []
let isDetecting = false // Prevent overlapping detections

// Feature flags
let enablePerspectiveWarp = true

// Current frame canvas for click handling
let currentFrameCanvas: HTMLCanvasElement | null = null
let currentFullResCanvas: HTMLCanvasElement | null = null

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
// Click Handling State
// ============================================================================

let clickHandler: ((evt: MouseEvent) => void) | null = null
const CLICK_DEBOUNCE_MS = 2000 // Minimum time between clicks (2 seconds)
const CARD_CROP_PADDING_RATIO = 0.02 // Slight padding to avoid clipping card edges

// Use global state to prevent multiple HMR instances from processing clicks concurrently
declare global {
  interface Window {
    __cardDetectorClickState?: {
      isProcessing: boolean
      lastClickTime: number
    }
  }
}

function getGlobalClickState() {
  if (!window.__cardDetectorClickState) {
    window.__cardDetectorClickState = {
      isProcessing: false,
      lastClickTime: 0,
    }
  }
  return window.__cardDetectorClickState
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getClampedCropRect(
  box: { xmin: number; ymin: number; xmax: number; ymax: number },
  canvasWidth: number,
  canvasHeight: number,
  paddingRatio: number = 0,
) {
  const rawX = box.xmin * canvasWidth
  const rawY = box.ymin * canvasHeight
  const rawWidth = (box.xmax - box.xmin) * canvasWidth
  const rawHeight = (box.ymax - box.ymin) * canvasHeight

  const padX = rawWidth * paddingRatio
  const padY = rawHeight * paddingRatio

  const paddedX = rawX - padX
  const paddedY = rawY - padY
  const paddedWidth = rawWidth + padX * 2
  const paddedHeight = rawHeight + padY * 2

  const clampedX = clamp(Math.round(paddedX), 0, canvasWidth - 1)
  const clampedY = clamp(Math.round(paddedY), 0, canvasHeight - 1)
  const clampedWidth = Math.max(
    1,
    Math.min(Math.round(paddedWidth), canvasWidth - clampedX),
  )
  const clampedHeight = Math.max(
    1,
    Math.min(Math.round(paddedHeight), canvasHeight - clampedY),
  )

  return {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight,
  }
}

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
      // Stop existing detection loop
      stopDetection()
    }

    // Return if already initialized with same type
    if (
      detector &&
      detector.getStatus() === 'ready' &&
      currentDetectorType === detectorType
    ) {
      // Still emit events for already-initialized detector
      loadingEvents.emit({
        step: 'detector',
        progress: 80,
        message: 'Card detector ready',
      })
      return
    }

    // Emit detector initialization start
    loadingEvents.emit({
      step: 'detector',
      progress: 60,
      message: 'Initializing card detector...',
    })

    // Create detector if not exists
    if (!detector) {
      // Track progress for smooth loading bar updates
      let lastProgress = 60
      const progressCallback = (msg: string) => {
        onProgress?.(msg)
        // Increment progress gradually (60-75% during download)
        lastProgress = Math.min(lastProgress + 1, 75)
        loadingEvents.emit({
          step: 'detector',
          progress: lastProgress,
          message: msg,
        })
      }

      if (!detectorType) {
        throw new Error(
          'Detector type is required. Please specify a detector type.',
        )
      }

      detector = createDetector(detectorType, {
        onProgress: progressCallback,
      })
      currentDetectorType = detectorType
    }

    // Initialize detector
    await detector.initialize()

    // Emit detector ready
    loadingEvents.emit({
      step: 'detector',
      progress: 80,
      message: 'Card detector ready',
    })
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
      // Don't throw - allow fallback to work
    } else {
      const friendlyError = new Error(
        'Failed to initialize card detection. Please refresh the page and try again.',
      )
      friendlyError.cause = err
      throw friendlyError
    }
  }
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Run detection on current video frame
 * Captures video frame, runs detector inference, filters results, and renders bounding boxes
 * Includes performance monitoring and error handling
 * @param clickPoint Optional click coordinates for point-based detection
 */
async function detectCards(clickPoint?: { x: number; y: number }) {
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
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })
    if (!tempCtx) {
      throw new Error(
        'setupCardDetector: Failed to get 2d context from temp canvas',
      )
    }
    tempCtx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height)

    // Store current frame for click handling (full resolution for accuracy)
    const fullResSnapshot = document.createElement('canvas')
    fullResSnapshot.width = videoEl.videoWidth
    fullResSnapshot.height = videoEl.videoHeight
    const fullResSnapshotCtx = fullResSnapshot.getContext('2d', {
      willReadFrequently: true,
    })
    if (fullResSnapshotCtx) {
      fullResSnapshotCtx.drawImage(
        videoEl,
        0,
        0,
        fullResSnapshot.width,
        fullResSnapshot.height,
      )
      currentFullResCanvas = fullResSnapshot
      currentFrameCanvas = fullResSnapshot
    } else {
      currentFrameCanvas = tempCanvas
      currentFullResCanvas = null
    }

    // Set click point for SlimSAM detector if provided
    if (
      clickPoint &&
      'setClickPoint' in detector &&
      typeof detector.setClickPoint === 'function'
    ) {
      detector.setClickPoint(clickPoint)
    }

    // Run detection using pluggable detector
    const result = await detector.detect(
      tempCanvas,
      overlayEl.width,
      overlayEl.height,
    )

    detectedCards = result.cards

    // Clear overlay - no detection boxes shown
    if (!overlayCtx) {
      throw new Error('setupCardDetector: overlayCtx is not initialized')
    }
    overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height)
  } catch {
    // Silently handle detection errors
  } finally {
    isDetecting = false
  }
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
  currentFrameCanvas = null
  currentFullResCanvas = null
  isDetecting = false
}

/**
 * Crop card from bounding box
 * CRITICAL: Must match Python embedding pipeline preprocessing for accuracy
 * Python pipeline: pad to square with black borders → resize to target size (default 224)
 * See: packages/mtg-image-db/build_mtg_faiss.py
 * @param box Bounding box from DETR detection (normalized coordinates)
 * @param sourceCanvas Optional source canvas to crop from (if not provided, uses videoEl)
 * @returns True if crop succeeded, false otherwise
 */
function cropCardFromBoundingBox(
  box: {
    xmin: number
    ymin: number
    xmax: number
    ymax: number
  },
  sourceCanvas?: HTMLCanvasElement | null,
): boolean {
  // Use provided source canvas or draw from video element
  let canvasToUse: HTMLCanvasElement

  if (sourceCanvas) {
    canvasToUse = sourceCanvas
  } else {
    // Draw full resolution video to canvas
    fullResCanvas.width = videoEl.videoWidth
    fullResCanvas.height = videoEl.videoHeight
    if (!fullResCtx) {
      throw new Error('setupCardDetector: fullResCtx is not initialized')
    }
    fullResCtx.drawImage(
      videoEl,
      0,
      0,
      fullResCanvas.width,
      fullResCanvas.height,
    )
    canvasToUse = fullResCanvas
  }

  // Convert normalized coordinates to pixels
  const cropRect = getClampedCropRect(
    box,
    canvasToUse.width,
    canvasToUse.height,
    CARD_CROP_PADDING_RATIO,
  )

  // Extract the full card region from the bounding box
  const canvasCtx = canvasToUse.getContext('2d', { willReadFrequently: true })
  if (!canvasCtx) {
    throw new Error('setupCardDetector: Failed to get 2d context from canvas')
  }
  const cardImageData = canvasCtx.getImageData(
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
  )

  // Create temporary canvas for the extracted card
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = cropRect.width
  tempCanvas.height = cropRect.height
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })
  if (!tempCtx) {
    throw new Error(
      'setupCardDetector: Failed to get 2d context from temp canvas',
    )
  }
  tempCtx.putImageData(cardImageData, 0, 0)

  // Apply contrast enhancement BEFORE resize to match Python preprocessing order
  // Python: load → enhance contrast → pad → resize
  // Browser: crop → enhance contrast → pad → resize
  const contrastFactor = getQueryContrastEnhancement()
  const contrastEnhancedCanvas = enhanceCanvasContrast(tempCanvas, contrastFactor)

  // Resize to target dimensions (224×224) with aspect ratio preservation and padding
  // The CLIP model expects square images, so we center the card and add black padding
  croppedCanvas.width = CROPPED_CARD_WIDTH
  croppedCanvas.height = CROPPED_CARD_HEIGHT
  if (!croppedCtx) {
    throw new Error('setupCardDetector: croppedCtx is not initialized')
  }
  croppedCtx.fillStyle = 'black'
  croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height)
  croppedCtx.imageSmoothingEnabled = true
  croppedCtx.imageSmoothingQuality = 'high'

  // Calculate scaling to fit card within 224×224 while preserving aspect ratio
  const scale = Math.min(
    CROPPED_CARD_WIDTH / cropRect.width,
    CROPPED_CARD_HEIGHT / cropRect.height,
  )
  const scaledWidth = cropRect.width * scale
  const scaledHeight = cropRect.height * scale

  // Center the card in the canvas
  const offsetX = (CROPPED_CARD_WIDTH - scaledWidth) / 2
  const offsetY = (CROPPED_CARD_HEIGHT - scaledHeight) / 2

  if (!croppedCtx) {
    throw new Error('setupCardDetector: croppedCtx is not initialized')
  }
  croppedCtx.drawImage(
    contrastEnhancedCanvas,
    0,
    0,
    cropRect.width,
    cropRect.height,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight,
  )

  return true
}

/**
 * Draw card border on overlay canvas (development only)
 * @param box Bounding box in normalized coordinates
 * @param color Border color
 * @param lineWidth Border line width
 */
function drawCardBorder(
  box: { xmin: number; ymin: number; xmax: number; ymax: number },
  color: string = '#00ff00',
  lineWidth: number = 3,
): void {
  if (!overlayCtx || !overlayEl) return

  // Convert normalized coordinates to pixels
  const x = box.xmin * overlayEl.width
  const y = box.ymin * overlayEl.height
  const width = (box.xmax - box.xmin) * overlayEl.width
  const height = (box.ymax - box.ymin) * overlayEl.height

  // Draw rectangle border
  overlayCtx.strokeStyle = color
  overlayCtx.lineWidth = lineWidth
  overlayCtx.strokeRect(x, y, width, height)
}

/**
 * Crop card at click position
 * Finds the closest DETR-detected card and crops it
 * @param x Click X coordinate on overlay canvas
 * @param y Click Y coordinate on overlay canvas
 * @returns Boolean indicating success
 */
async function cropCardAt(x: number, y: number): Promise<boolean> {
  // Need detected cards to crop
  if (!detectedCards.length) {
    console.log(
      '%c[DEBUG cropCardAt] No detected cards available',
      'color: #999;',
    )
    return false
  }

  // Find best card at click position
  // Priority: 1) Click inside box, 2) Nearest center, 3) Highest confidence, 4) Smaller box
  let bestIndex = -1
  let bestScore = -Infinity

  // Log click position relative to detected boxes
  console.log(
    '%c[DEBUG cropCardAt] Checking click position against detected boxes',
    'color: #999;',
  )

  // Second pass: find best detection at click
  for (let i = 0; i < detectedCards.length; i++) {
    const card = detectedCards[i]
    if (!card) continue
    const box = card.box

    // Convert normalized box to pixel coordinates
    const boxXMin = box.xmin * overlayEl.width
    const boxYMin = box.ymin * overlayEl.height
    const boxXMax = box.xmax * overlayEl.width
    const boxYMax = box.ymax * overlayEl.height

    // Check if click is inside this box
    const isInside =
      x >= boxXMin && x <= boxXMax && y >= boxYMin && y <= boxYMax

    if (!isInside) continue

    // Calculate box area (smaller is better for cards)
    const boxWidth = boxXMax - boxXMin
    const boxHeight = boxYMax - boxYMin
    const area = boxWidth * boxHeight
    const canvasArea = overlayEl.width * overlayEl.height

    // Distance from click to box center (closer is better)
    const centerX = boxXMin + boxWidth / 2
    const centerY = boxYMin + boxHeight / 2
    const dx = x - centerX
    const dy = y - centerY
    const distance = Math.hypot(dx, dy)
    const maxDistance = Math.hypot(overlayEl.width, overlayEl.height)
    const distanceScore = (1 - distance / maxDistance) * 200000

    // Score: balance between proximity, confidence, and size
    // Use percentage of canvas area - smaller boxes get exponentially higher scores
    const areaPercentage = area / canvasArea

    // Exponential penalty for large boxes
    const sizeScore = Math.pow(1 - areaPercentage, 3) * 100000

    // Weight confidence heavily to prefer high-confidence detections
    const confidenceScore = card.score * 1000000

    const totalScore = distanceScore + sizeScore + confidenceScore

    if (totalScore > bestScore) {
      bestScore = totalScore
      bestIndex = i
    }
  }

  if (bestIndex === -1) {
    console.log(
      '%c[DEBUG cropCardAt] Click was not inside any detected bounding box',
      'color: #ff9800;',
    )
    return false
  }

  const card = detectedCards[bestIndex]
  if (!card) {
    throw new Error(`setupCardDetector: Card not found at index ${bestIndex}`)
  }

  console.log(
    `%c[DEBUG cropCardAt] Selected card ${bestIndex + 1} (score: ${card.score.toFixed(3)})`,
    'color: #4CAF50;',
  )

  // Draw card border in development mode
  if (isDevelopment) {
    // Clear previous border first
    if (overlayCtx && overlayEl) {
      overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height)
    }
    // Draw border around detected card
    drawCardBorder(card.box, '#00ff00', 3)
  }

  // Use the current full-res frame canvas captured during detection
  const sourceCanvas = currentFullResCanvas ?? currentFrameCanvas
  if (!sourceCanvas) {
    console.log(
      '%c[DEBUG cropCardAt] No current frame canvas available',
      'color: #f44336;',
    )
    return false
  }

  const cropRect = getClampedCropRect(
    card.box,
    sourceCanvas.width,
    sourceCanvas.height,
    CARD_CROP_PADDING_RATIO,
  )
  const cardWidthPx = cropRect.width
  const cardHeightPx = cropRect.height
  const detectionCropCanvas = document.createElement('canvas')
  detectionCropCanvas.width = cardWidthPx
  detectionCropCanvas.height = cardHeightPx
  const detectionCropCtx = detectionCropCanvas.getContext('2d', {
    willReadFrequently: true,
  })
  if (detectionCropCtx) {
    detectionCropCtx.drawImage(
      sourceCanvas,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      cardWidthPx,
      cardHeightPx,
    )

    // DEBUG STAGE 2: Log the raw bounding box crop (before perspective correction)
    logDebugBlobUrl(
      detectionCropCanvas,
      'Bounding box crop (raw detection)',
      2,
      '#4CAF50', // Green
    )
  }

  // T022: Use warped canvas if available (from SlimSAM perspective correction) and enabled
  if (enablePerspectiveWarp && card.warpedCanvas) {
    // DEBUG STAGE 3: Log SlimSAM warped canvas before resize
    logDebugBlobUrl(
      card.warpedCanvas,
      'After perspective correction (SlimSAM warp)',
      3,
      '#FF9800', // Orange
    )

    // Apply contrast enhancement BEFORE resize to match Python preprocessing order
    const contrastFactor = getQueryContrastEnhancement()
    const contrastEnhancedCanvas = enhanceCanvasContrast(
      card.warpedCanvas,
      contrastFactor,
    )

    // Copy warped canvas to cropped canvas
    croppedCanvas.width = CROPPED_CARD_WIDTH
    croppedCanvas.height = CROPPED_CARD_HEIGHT
    if (!croppedCtx) {
      throw new Error('setupCardDetector: croppedCtx is not initialized')
    }
    croppedCtx.fillStyle = 'black'
    croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height)
    croppedCtx.imageSmoothingEnabled = true
    croppedCtx.imageSmoothingQuality = 'high'
    croppedCtx.drawImage(
      contrastEnhancedCanvas,
      0,
      0,
      contrastEnhancedCanvas.width,
      contrastEnhancedCanvas.height,
      0,
      0,
      CROPPED_CARD_WIDTH,
      CROPPED_CARD_HEIGHT,
    )

    return true
  }

  // Two-stage pipeline: Refine bounding box to precise corners + perspective correction
  if (enablePerspectiveWarp && currentDetectorType !== 'slimsam') {
    try {
      // Step 1: Refine bounding box to precise card corners using OpenCV
      const quad = await refineBoundingBoxToCorners(
        sourceCanvas,
        card.box,
        overlayEl.width,
        overlayEl.height,
        0.15, // 15% padding around bbox
      )

      if (quad) {
        // Step 2: Apply perspective correction to get canonical 224×224 image
        const warpedCanvas = await warpCardToCanonical(sourceCanvas, quad)

        // DEBUG STAGE 3: Log OpenCV warped canvas
        logDebugBlobUrl(
          warpedCanvas,
          'After perspective correction (OpenCV warp)',
          3,
          '#FF9800', // Orange
        )

        // Apply contrast enhancement BEFORE resize to match Python preprocessing order
        const contrastFactor = getQueryContrastEnhancement()
        const contrastEnhancedCanvas = enhanceCanvasContrast(
          warpedCanvas,
          contrastFactor,
        )

        // Copy warped canvas to cropped canvas
        croppedCanvas.width = CROPPED_CARD_WIDTH
        croppedCanvas.height = CROPPED_CARD_HEIGHT
        if (!croppedCtx) {
          throw new Error('setupCardDetector: croppedCtx is not initialized')
        }
        croppedCtx.fillStyle = 'black'
        croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height)
        croppedCtx.imageSmoothingEnabled = true
        croppedCtx.imageSmoothingQuality = 'high'
        croppedCtx.drawImage(
          contrastEnhancedCanvas,
          0,
          0,
          contrastEnhancedCanvas.width,
          contrastEnhancedCanvas.height,
          0,
          0,
          CROPPED_CARD_WIDTH,
          CROPPED_CARD_HEIGHT,
        )

        return true
      }
    } catch {
      // Fallback to simple crop on error
    }
  }

  // Fallback: Use the bounding box to crop from source canvas (no perspective correction)
  return cropCardFromBoundingBox(card.box, sourceCanvas)
}

/**
 * Initialize card detector with video element and canvas refs
 * @param args.video Video element to analyze
 * @param args.overlay Canvas for drawing detection overlays
 * @param args.cropped Canvas for storing cropped card images
 * @param args.fullRes Canvas for full resolution processing
 * @param args.detectorType Optional detector type to use
 * @param args.usePerspectiveWarp Whether to apply perspective warp
 * @param args.onCrop Callback when a card is cropped
 * @param args.onProgress Optional callback for model loading progress
 * @returns Promise resolving to card detector control interface
 */
export async function setupCardDetector(args: {
  video: HTMLVideoElement
  overlay: HTMLCanvasElement
  cropped: HTMLCanvasElement
  fullRes: HTMLCanvasElement
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
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
  croppedCtx = croppedCanvas.getContext('2d', { willReadFrequently: true })

  // Set perspective warp flag
  enablePerspectiveWarp = args.usePerspectiveWarp !== false

  // Initialize detector
  try {
    await initializeDetector(args.detectorType, args.onProgress)
  } catch {
    console.error('[Detector] Failed to initialize')
  }

  // Remove any existing click handler to prevent multiple listeners
  if (clickHandler) {
    overlayEl.removeEventListener('click', clickHandler)
  }

  // Create new click handler
  clickHandler = (evt: MouseEvent) => {
    const now = performance.now()
    const globalState = getGlobalClickState()

    // Debounce clicks (prevent double-clicks)
    if (now - globalState.lastClickTime < CLICK_DEBOUNCE_MS) {
      console.log(
        '%c[DEBUG] Click debounced (too soon after last click)',
        'color: #999;',
      )
      return
    }

    // Prevent overlapping click processing (global across all HMR instances)
    if (globalState.isProcessing) {
      console.log(
        '%c[DEBUG] Click ignored (already processing)',
        'color: #999;',
      )
      return
    }

    const rect = overlayEl.getBoundingClientRect()
    const clickX = evt.clientX - rect.left
    const clickY = evt.clientY - rect.top

    // Scale click coordinates from display size to canvas size
    const x = Math.floor(clickX * (overlayEl.width / rect.width))
    const y = Math.floor(clickY * (overlayEl.height / rect.height))

    globalState.lastClickTime = now
    globalState.isProcessing = true

    console.log(
      '%c[DEBUG] Processing click',
      'background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px;',
      { x, y },
    )

    // Performance tracking: Click to database response pipeline
    const metrics = {
      detection: 0,
      crop: 0,
      embedding: 0,
      search: 0,
      total: 0,
    }

    // Use requestAnimationFrame to make this async and prevent blocking Playwright
    // This ensures the click event completes before we process the crop
    requestAnimationFrame(async () => {
      try {
        // 1. Run detection at click point
        const detectionStart = performance.now()
        await detectCards({ x, y })
        metrics.detection = performance.now() - detectionStart

        // DEBUG STAGE 1: Log the video frame at the time of click
        if (currentFrameCanvas) {
          logDebugBlobUrl(
            currentFrameCanvas,
            'Video frame at click time',
            1,
            '#2196F3', // Blue
          )
        }

        // Log detection results
        if (detectedCards.length === 0) {
          console.log(
            '%c[DEBUG] No cards detected in frame',
            'background: #f44336; color: white; padding: 2px 6px; border-radius: 3px;',
          )
          console.log('Click position:', { x, y })
          console.log(
            'Tip: Make sure a card is visible in the video and the detector is initialized',
          )
        } else {
          console.log(
            `%c[DEBUG] Found ${detectedCards.length} card(s) in frame`,
            'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px;',
          )
          detectedCards.forEach((card, i) => {
            const boxPx = {
              xmin: Math.round(
                card.box.xmin * (currentFrameCanvas?.width ?? 0),
              ),
              ymin: Math.round(
                card.box.ymin * (currentFrameCanvas?.height ?? 0),
              ),
              xmax: Math.round(
                card.box.xmax * (currentFrameCanvas?.width ?? 0),
              ),
              ymax: Math.round(
                card.box.ymax * (currentFrameCanvas?.height ?? 0),
              ),
            }
            console.log(
              `  Card ${i + 1}: score=${card.score.toFixed(3)}, box=`,
              boxPx,
            )
          })
        }

        // 2. Crop the detected card
        const cropStart = performance.now()
        const ok = await cropCardAt(x, y)
        metrics.crop = performance.now() - cropStart

        if (!ok) {
          console.log(
            '%c[DEBUG] Failed to crop card at click position',
            'background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px;',
          )
          console.log('Click position:', { x, y })
          if (detectedCards.length > 0) {
            console.log(
              'Cards were detected but click was not inside any bounding box',
            )
          }
        }

        if (ok && typeof args.onCrop === 'function') {
          // 3. Embedding and search happen in onCrop callback
          // Store metrics start time for callback to use
          const canvasWithMetrics = croppedCanvas as HTMLCanvasElement & {
            __metricsStart?: number
            __pipelineMetrics?: typeof metrics
          }
          canvasWithMetrics.__metricsStart = performance.now()
          canvasWithMetrics.__pipelineMetrics = metrics
          args.onCrop(croppedCanvas)
        }
      } finally {
        // Always reset the global flag, even if there was an error
        getGlobalClickState().isProcessing = false
        console.log('%c[DEBUG] Click processing complete', 'color: #999;')
      }
    })
  }

  overlayEl.addEventListener('click', clickHandler)

  // Add mouse move listener to warm up the model when user hovers over the stream
  // This eliminates the first-inference penalty (2-5x slower) by pre-compiling the model
  let mouseWarmupHandler: ((evt: MouseEvent) => void) | null = null
  mouseWarmupHandler = () => {
    // Warm up the model on first mouse move
    warmModel().catch(() => {
      // Model warmup failed - non-critical, will initialize on first detection
    })
    // Remove listener after first trigger to avoid repeated warmups
    if (mouseWarmupHandler) {
      overlayEl.removeEventListener('mousemove', mouseWarmupHandler)
      mouseWarmupHandler = null
    }
  }
  overlayEl.addEventListener('mousemove', mouseWarmupHandler)

  return {
    /**
     * Get the cropped card canvas
     * @returns The canvas element containing the cropped card image
     */
    getCroppedCanvas() {
      return croppedCanvas
    },

    /**
     * Stop card detection
     */
    stopDetection() {
      stopDetection()
    },
  }
}

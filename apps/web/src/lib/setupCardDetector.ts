// Card detection for MTG webcam recognition
// Uses pluggable detector architecture (DETR, OWL-ViT, etc.)

import type { DetectedCard } from '@/types/card-query'

import type { CardDetector, DetectorType } from './detectors/index.js'
import {
  enhanceCanvasContrast,
  getQueryContrastEnhancement,
  getQueryTargetSize,
  waitForEmbeddings,
  warmModel,
} from './clip-search.js'
import {
  captureVideoFrame,
  cropAndCenterToSquare,
  normalizedBoxToCropRegion,
} from './detectors/geometry/crop.js'
// Removed: refineBoundingBoxToCorners and warpCardToCanonical - perspective warp disabled
import { createDetector } from './detectors/index.js'

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
        `background: url(${url}) no-repeat; background-size: contain; padding: 150px;`,
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

// Note: These module-level variables are still used for some shared state,
// but the critical videoEl is now passed explicitly to functions to support
// multiple video streams (local, remote, test) with separate card detection.

// ============================================================================
// Click Handling State
// ============================================================================

const CLICK_DEBOUNCE_MS = 2000 // Minimum time between clicks (2 seconds)

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
      return
    }

    // Create detector if not exists
    if (!detector) {
      if (!detectorType) {
        throw new Error(
          'Detector type is required. Please specify a detector type.',
        )
      }

      detector = createDetector(detectorType, {
        onProgress,
      })
      currentDetectorType = detectorType
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
 * Instance-specific detection context
 * Each video stream gets its own context to avoid cross-contamination
 */
interface DetectionContext {
  videoEl: HTMLVideoElement
  overlayEl: HTMLCanvasElement
  fullResCanvas: HTMLCanvasElement
  croppedCanvas: HTMLCanvasElement
  overlayCtx: CanvasRenderingContext2D
  fullResCtx: CanvasRenderingContext2D
  croppedCtx: CanvasRenderingContext2D
  enablePerspectiveWarp: boolean
}

/**
 * Run detection on current video frame
 * Captures video frame, runs detector inference, filters results, and renders bounding boxes
 * Includes performance monitoring and error handling
 * @param ctx Detection context with video and canvas elements
 * @param clickPoint Optional click coordinates for point-based detection
 */
async function detectCards(
  ctx: DetectionContext,
  clickPoint?: { x: number; y: number },
) {
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
    // Capture video frame at native resolution (preserves aspect ratio)
    const { canvas: frameCanvas } = captureVideoFrame(
      ctx.videoEl,
      ctx.overlayEl.width,
      ctx.overlayEl.height,
    )

    console.log('[detectCards] Frame captured:', {
      frameWidth: frameCanvas.width,
      frameHeight: frameCanvas.height,
      videoWidth: ctx.videoEl.videoWidth,
      videoHeight: ctx.videoEl.videoHeight,
      clickPoint,
    })

    // Store for both detection and click handling
    currentFrameCanvas = frameCanvas
    currentFullResCanvas = frameCanvas

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
      frameCanvas,
      ctx.overlayEl.width,
      ctx.overlayEl.height,
    )

    console.log('[detectCards] Detection result:', {
      detector: currentDetectorType,
      cards: result.cards.length,
      hasWarpedCanvas: result.cards.map((c) => !!c.warpedCanvas),
    })

    detectedCards = result.cards

    // Clear overlay - no detection boxes shown
    ctx.overlayCtx.clearRect(0, 0, ctx.overlayEl.width, ctx.overlayEl.height)
  } catch (err) {
    // Log detection errors instead of silently swallowing them
    console.error('[detectCards] Detection error:', err)
  } finally {
    isDetecting = false
  }
}

/**
 * Stop detection loop
 * Clears detection interval, overlay canvas, and resets detection state
 * @param ctx Optional detection context to clear specific overlay
 */
function stopDetection(ctx?: DetectionContext) {
  if (detectionInterval) {
    clearInterval(detectionInterval)
    detectionInterval = null
  }
  // Clear overlay when stopping
  if (ctx) {
    ctx.overlayCtx.clearRect(0, 0, ctx.overlayEl.width, ctx.overlayEl.height)
  }
  detectedCards = []
  currentFrameCanvas = null
  currentFullResCanvas = null
  isDetecting = false
}

/**
 * Crop card at click position
 * Finds the closest DETR-detected card and crops it
 * @param ctx Detection context with canvas elements
 * @param x Click X coordinate on overlay canvas
 * @param y Click Y coordinate on overlay canvas
 * @returns Boolean indicating success
 */
async function cropCardAt(
  ctx: DetectionContext,
  x: number,
  y: number,
): Promise<boolean> {
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

  // Use video dimensions for coordinate conversion (matches detection canvas)
  const frameWidth = ctx.videoEl.videoWidth || ctx.overlayEl.width
  const frameHeight = ctx.videoEl.videoHeight || ctx.overlayEl.height

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

    // Convert normalized box to pixel coordinates (using video dimensions)
    const boxXMin = box.xmin * frameWidth
    const boxYMin = box.ymin * frameHeight
    const boxXMax = box.xmax * frameWidth
    const boxYMax = box.ymax * frameHeight

    // Check if click is inside this box
    const isInside =
      x >= boxXMin && x <= boxXMax && y >= boxYMin && y <= boxYMax

    if (!isInside) continue

    // Calculate box area (smaller is better for cards)
    const boxWidth = boxXMax - boxXMin
    const boxHeight = boxYMax - boxYMin
    const area = boxWidth * boxHeight
    const canvasArea = frameWidth * frameHeight

    // Distance from click to box center (closer is better)
    const centerX = boxXMin + boxWidth / 2
    const centerY = boxYMin + boxHeight / 2
    const dx = x - centerX
    const dy = y - centerY
    const distance = Math.hypot(dx, dy)
    const maxDistance = Math.hypot(frameWidth, frameHeight)
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

  // Use the current full-res frame canvas captured during detection
  const sourceCanvas = currentFullResCanvas ?? currentFrameCanvas
  if (!sourceCanvas) {
    console.log(
      '%c[DEBUG cropCardAt] No current frame canvas available',
      'color: #f44336;',
    )
    return false
  }

  // Use warped canvas from SlimSAM perspective correction
  console.log('[cropCardAt] Perspective warp check:', {
    enablePerspectiveWarp: ctx.enablePerspectiveWarp,
    hasWarpedCanvas: !!card.warpedCanvas,
  })
  if (ctx.enablePerspectiveWarp && card.warpedCanvas) {
    // Apply contrast enhancement
    const contrastFactor = getQueryContrastEnhancement()
    const contrastEnhancedCanvas = enhanceCanvasContrast(
      card.warpedCanvas,
      contrastFactor,
    )

    // Copy to cropped canvas (warpedCanvas is already the right size)
    ctx.croppedCanvas.width = contrastEnhancedCanvas.width
    ctx.croppedCanvas.height = contrastEnhancedCanvas.height
    ctx.croppedCtx.drawImage(contrastEnhancedCanvas, 0, 0)

    return true
  }

  // Fallback: Simple bounding box crop (when perspective warp is disabled)
  // Use source canvas dimensions (video native resolution) for coordinate conversion
  const targetSize = getQueryTargetSize()
  const region = normalizedBoxToCropRegion(
    card.box,
    sourceCanvas.width,
    sourceCanvas.height,
  )

  const croppedResult = cropAndCenterToSquare(sourceCanvas, region, {
    targetSize,
    highQuality: true,
    debugLabel: 'Fallback bbox crop (no perspective warp)',
    debugStage: 99,
    debugColor: '#F44336',
  })

  // Copy result to the instance's cropped canvas
  ctx.croppedCanvas.width = croppedResult.width
  ctx.croppedCanvas.height = croppedResult.height
  ctx.croppedCtx.drawImage(croppedResult, 0, 0)

  return true
}

/**
 * Initialize card detector with video element and canvas refs
 * Each instance creates its own detection context to support multiple video streams.
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
  // Create instance-specific context - captured in closures below
  // This allows multiple video streams to have independent card detection
  const instanceOverlayEl = args.overlay
  const instanceCroppedCanvas = args.cropped
  const instanceFullResCanvas = args.fullRes

  // Wait for embeddings/manifest to be loaded before accessing manifest values
  // This ensures we have contrast enhancement factor and target size from the build
  await waitForEmbeddings()

  // Set cropped canvas to target size from manifest
  const targetSize = getQueryTargetSize()
  instanceCroppedCanvas.width = targetSize
  instanceCroppedCanvas.height = targetSize

  const instanceOverlayCtx = instanceOverlayEl.getContext('2d', {
    willReadFrequently: true,
  })
  const instanceFullResCtx = instanceFullResCanvas.getContext('2d', {
    willReadFrequently: true,
  })
  const instanceCroppedCtx = instanceCroppedCanvas.getContext('2d', {
    willReadFrequently: true,
  })

  if (!instanceOverlayCtx || !instanceFullResCtx || !instanceCroppedCtx) {
    throw new Error('setupCardDetector: Failed to get 2d context from canvases')
  }

  // Create the detection context for this instance
  const ctx: DetectionContext = {
    videoEl: args.video,
    overlayEl: instanceOverlayEl,
    fullResCanvas: instanceFullResCanvas,
    croppedCanvas: instanceCroppedCanvas,
    overlayCtx: instanceOverlayCtx,
    fullResCtx: instanceFullResCtx,
    croppedCtx: instanceCroppedCtx,
    enablePerspectiveWarp: args.usePerspectiveWarp !== false,
  }

  // Initialize detector (shared across all instances)
  try {
    await initializeDetector(args.detectorType, args.onProgress)
  } catch {
    console.error('[Detector] Failed to initialize')
  }

  // Store click handler reference for cleanup
  let instanceClickHandler: ((evt: MouseEvent) => void) | null = null

  // Create new click handler that captures this instance's context
  instanceClickHandler = (evt: MouseEvent) => {
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

    const rect = ctx.overlayEl.getBoundingClientRect()
    const clickX = evt.clientX - rect.left
    const clickY = evt.clientY - rect.top

    // Scale click coordinates from display size to video's native size
    // (detection now uses video dimensions, not overlay dimensions)
    const videoWidth = ctx.videoEl.videoWidth || ctx.overlayEl.width
    const videoHeight = ctx.videoEl.videoHeight || ctx.overlayEl.height
    const x = Math.floor(clickX * (videoWidth / rect.width))
    const y = Math.floor(clickY * (videoHeight / rect.height))

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
        // 1. Run detection at click point using this instance's video element
        const detectionStart = performance.now()
        await detectCards(ctx, { x, y })
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

        // 2. Crop the detected card using this instance's context
        const cropStart = performance.now()
        const ok = await cropCardAt(ctx, x, y)
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
          const canvasWithMetrics = ctx.croppedCanvas as HTMLCanvasElement & {
            __metricsStart?: number
            __pipelineMetrics?: typeof metrics
          }
          canvasWithMetrics.__metricsStart = performance.now()
          canvasWithMetrics.__pipelineMetrics = metrics
          args.onCrop(ctx.croppedCanvas)
        }
      } finally {
        // Always reset the global flag, even if there was an error
        getGlobalClickState().isProcessing = false
        console.log('%c[DEBUG] Click processing complete', 'color: #999;')
      }
    })
  }

  ctx.overlayEl.addEventListener('click', instanceClickHandler)

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
      ctx.overlayEl.removeEventListener('mousemove', mouseWarmupHandler)
      mouseWarmupHandler = null
    }
  }
  ctx.overlayEl.addEventListener('mousemove', mouseWarmupHandler)

  return {
    /**
     * Get the cropped card canvas
     * @returns The canvas element containing the cropped card image
     */
    getCroppedCanvas() {
      return ctx.croppedCanvas
    },

    /**
     * Stop card detection
     */
    stopDetection() {
      stopDetection(ctx)
      // Remove click handler when stopping
      if (instanceClickHandler) {
        ctx.overlayEl.removeEventListener('click', instanceClickHandler)
        instanceClickHandler = null
      }
    },
  }
}

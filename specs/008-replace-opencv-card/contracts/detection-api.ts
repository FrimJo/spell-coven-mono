/**
 * Detection API Contract
 * 
 * Defines the public interface for DETR-based card detection system.
 * This contract ensures compatibility between detection and identification pipelines.
 * 
 * Version: 1.0.0
 * Date: 2025-10-15
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Bounding box in normalized coordinates [0.0, 1.0]
 * Origin: top-left (0, 0)
 */
export interface BoundingBox {
  /** Left edge as percentage of frame width */
  xmin: number
  /** Top edge as percentage of frame height */
  ymin: number
  /** Right edge as percentage of frame width */
  xmax: number
  /** Bottom edge as percentage of frame height */
  ymax: number
}

/**
 * Raw detection result from DETR model
 */
export interface DetectionResult {
  /** Object class label (e.g., "book", "remote", "card") */
  label: string
  /** Confidence score [0.0, 1.0] */
  score: number
  /** Location in normalized coordinates */
  box: BoundingBox
}

/**
 * 2D point in pixel coordinates
 */
export interface Point {
  x: number
  y: number
}

/**
 * Validated card detection ready for user interaction
 */
export interface DetectedCard {
  /** Bounding box in normalized coordinates */
  box: BoundingBox
  /** Confidence score [0.5, 1.0] */
  score: number
  /** Computed aspect ratio (width/height) */
  aspectRatio: number
  /** 4-point polygon for rendering (TL, TR, BR, BL) */
  polygon: Point[]
}

/**
 * Detection system state
 */
export type DetectionStatus = 'idle' | 'loading' | 'ready' | 'detecting' | 'error'

/**
 * Detection error types
 */
export type DetectionErrorType =
  | 'MODEL_LOAD_FAILED'
  | 'INFERENCE_FAILED'
  | 'INVALID_VIDEO_FRAME'
  | 'WEBGL_NOT_SUPPORTED'
  | 'NETWORK_ERROR'

// ============================================================================
// Configuration
// ============================================================================

/**
 * Detection system configuration
 */
export interface DetectionConfig {
  /** DETR model identifier */
  modelId: string
  /** Minimum confidence threshold [0.0, 1.0] */
  confidenceThreshold: number
  /** MTG card aspect ratio (width/height) */
  targetAspectRatio: number
  /** Aspect ratio tolerance (±percentage) */
  aspectRatioTolerance: number
  /** Detection inference interval (milliseconds) */
  detectionIntervalMs: number
  /** Cropped card width (pixels) */
  croppedCardWidth: number
  /** Cropped card height (pixels) */
  croppedCardHeight: number
}

/**
 * Default configuration values
 */
export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  modelId: 'Xenova/detr-resnet-50',
  confidenceThreshold: 0.5,
  targetAspectRatio: 63 / 88, // ~0.716
  aspectRatioTolerance: 0.20, // ±20%
  detectionIntervalMs: 500, // 2 FPS
  croppedCardWidth: 315,
  croppedCardHeight: 440,
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Setup options for webcam detection system
 */
export interface SetupWebcamOptions {
  /** Video element displaying webcam stream */
  video: HTMLVideoElement
  /** Canvas for detection overlay rendering */
  overlay: HTMLCanvasElement
  /** Canvas for cropped card output */
  cropped: HTMLCanvasElement
  /** Canvas for full-resolution frame capture */
  fullRes: HTMLCanvasElement
  /** Optional callback when card is cropped */
  onCrop?: () => void
  /** Optional configuration overrides */
  config?: Partial<DetectionConfig>
}

/**
 * Webcam detection system interface
 */
export interface WebcamDetectionSystem {
  /**
   * Start video stream from camera
   * @param deviceId Optional camera device ID
   * @returns Promise that resolves when video is ready
   */
  startVideo(deviceId?: string | null): Promise<void>

  /**
   * Get list of available cameras
   * @returns Promise with array of video input devices
   */
  getCameras(): Promise<MediaDeviceInfo[]>

  /**
   * Get currently active camera device ID
   * @returns Device ID or null if no camera active
   */
  getCurrentDeviceId(): string | null

  /**
   * Populate camera select dropdown
   * @param selectEl Select element to populate
   */
  populateCameraSelect(selectEl: HTMLSelectElement | null | undefined): Promise<void>

  /**
   * Get reference to cropped card canvas
   * @returns Canvas element with cropped card image
   */
  getCroppedCanvas(): HTMLCanvasElement
}

/**
 * Progress callback for model loading
 */
export interface ProgressCallback {
  (message: string): void
}

/**
 * Detection system setup function
 * 
 * @param options Setup configuration
 * @returns Promise resolving to detection system interface
 * 
 * @example
 * ```typescript
 * const system = await setupWebcam({
 *   video: videoElement,
 *   overlay: overlayCanvas,
 *   cropped: croppedCanvas,
 *   fullRes: fullResCanvas,
 *   onCrop: () => console.log('Card cropped'),
 *   config: {
 *     confidenceThreshold: 0.6,
 *     detectionIntervalMs: 250
 *   }
 * })
 * 
 * await system.startVideo()
 * ```
 */
export declare function setupWebcam(
  options: SetupWebcamOptions
): Promise<WebcamDetectionSystem>

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate bounding box coordinates
 */
export function validateBoundingBox(box: BoundingBox): boolean {
  return (
    box.xmin >= 0 && box.xmin <= 1 &&
    box.ymin >= 0 && box.ymin <= 1 &&
    box.xmax >= 0 && box.xmax <= 1 &&
    box.ymax >= 0 && box.ymax <= 1 &&
    box.xmax > box.xmin &&
    box.ymax > box.ymin &&
    (box.xmax - box.xmin) >= 0.01 &&
    (box.ymax - box.ymin) >= 0.01
  )
}

/**
 * Validate detection result
 */
export function validateDetectionResult(result: DetectionResult): boolean {
  return (
    typeof result.label === 'string' &&
    result.label.length > 0 &&
    typeof result.score === 'number' &&
    result.score >= 0 && result.score <= 1 &&
    validateBoundingBox(result.box)
  )
}

/**
 * Validate aspect ratio is within MTG card tolerance
 */
export function validateCardAspectRatio(
  aspectRatio: number,
  config: DetectionConfig = DEFAULT_DETECTION_CONFIG
): boolean {
  const minRatio = config.targetAspectRatio * (1 - config.aspectRatioTolerance)
  const maxRatio = config.targetAspectRatio * (1 + config.aspectRatioTolerance)
  return aspectRatio >= minRatio && aspectRatio <= maxRatio
}

/**
 * Validate video element is ready for detection
 */
export function validateVideoElement(video: HTMLVideoElement): boolean {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  )
}

/**
 * Validate cropped canvas matches expected dimensions
 */
export function validateCroppedCanvas(
  canvas: HTMLCanvasElement,
  config: DetectionConfig = DEFAULT_DETECTION_CONFIG
): boolean {
  return (
    canvas.width === config.croppedCardWidth &&
    canvas.height === config.croppedCardHeight &&
    canvas.getContext('2d') !== null
  )
}

// ============================================================================
// Coordinate Conversion Utilities
// ============================================================================

/**
 * Convert normalized coordinates to pixel coordinates
 */
export function toPixelCoordinates(
  box: BoundingBox,
  canvasWidth: number,
  canvasHeight: number
): { xmin: number; ymin: number; xmax: number; ymax: number } {
  return {
    xmin: box.xmin * canvasWidth,
    ymin: box.ymin * canvasHeight,
    xmax: box.xmax * canvasWidth,
    ymax: box.ymax * canvasHeight,
  }
}

/**
 * Convert pixel coordinates to normalized coordinates
 */
export function toNormalizedCoordinates(
  pixelBox: { xmin: number; ymin: number; xmax: number; ymax: number },
  canvasWidth: number,
  canvasHeight: number
): BoundingBox {
  return {
    xmin: pixelBox.xmin / canvasWidth,
    ymin: pixelBox.ymin / canvasHeight,
    xmax: pixelBox.xmax / canvasWidth,
    ymax: pixelBox.ymax / canvasHeight,
  }
}

/**
 * Compute aspect ratio from bounding box
 */
export function computeAspectRatio(box: BoundingBox): number {
  const width = box.xmax - box.xmin
  const height = box.ymax - box.ymin
  return width / height
}

/**
 * Convert bounding box to 4-point polygon
 */
export function boundingBoxToPolygon(
  box: BoundingBox,
  canvasWidth: number,
  canvasHeight: number
): Point[] {
  const pixel = toPixelCoordinates(box, canvasWidth, canvasHeight)
  return [
    { x: pixel.xmin, y: pixel.ymin }, // Top-left
    { x: pixel.xmax, y: pixel.ymin }, // Top-right
    { x: pixel.xmax, y: pixel.ymax }, // Bottom-right
    { x: pixel.xmin, y: pixel.ymax }, // Bottom-left
  ]
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for DetectionResult
 */
export function isDetectionResult(value: unknown): value is DetectionResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'label' in value &&
    'score' in value &&
    'box' in value &&
    validateDetectionResult(value as DetectionResult)
  )
}

/**
 * Type guard for DetectedCard
 */
export function isDetectedCard(value: unknown): value is DetectedCard {
  return (
    typeof value === 'object' &&
    value !== null &&
    'box' in value &&
    'score' in value &&
    'aspectRatio' in value &&
    'polygon' in value &&
    Array.isArray((value as DetectedCard).polygon) &&
    (value as DetectedCard).polygon.length === 4
  )
}

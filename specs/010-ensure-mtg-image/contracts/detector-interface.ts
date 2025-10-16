/**
 * Card Detector Interface Contract
 * 
 * Defines the standard interface that all card detector implementations
 * (OpenCV, SlimSAM, DETR, OWL-ViT) must conform to.
 * 
 * This contract ensures:
 * - Consistent initialization and lifecycle management
 * - Standard detection output format
 * - Proper error handling and status reporting
 * - Resource cleanup
 */

/**
 * Detector initialization status
 */
export type DetectorStatus = 'uninitialized' | 'loading' | 'ready' | 'error'

/**
 * Configuration for detector initialization
 */
export interface DetectorConfig {
  /** Model identifier (e.g., 'Xenova/slimsam', 'Xenova/detr-resnet-50') */
  modelId: string
  
  /** Minimum confidence threshold for detections (0-1) */
  confidenceThreshold: number
  
  /** Detection interval in milliseconds */
  detectionIntervalMs: number
  
  /** Optional progress callback for model loading */
  onProgress?: (message: string) => void
  
  /** Optional device preference ('auto', 'webgpu', 'webgl', 'wasm') */
  device?: string
  
  /** Optional data type ('fp32', 'fp16') */
  dtype?: string
}

/**
 * 2D point in canvas coordinates
 */
export interface Point {
  x: number
  y: number
}

/**
 * Axis-aligned bounding box
 */
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Detected card with polygon boundary
 */
export interface DetectedCard {
  /** Card boundary as array of points (minimum 4 for quadrilateral) */
  polygon: Point[]
  
  /** Detection confidence score (0-1) */
  confidence: number
  
  /** Axis-aligned bounding box */
  boundingBox: BoundingBox
}

/**
 * Result of a detection operation
 */
export interface DetectionOutput {
  /** Filtered and validated card detections */
  cards: DetectedCard[]
  
  /** Time taken for detection in milliseconds */
  inferenceTimeMs: number
  
  /** Number of raw detections before filtering */
  rawDetectionCount: number
}

/**
 * Abstract interface for card detection models
 * 
 * Implementations must provide:
 * - Model initialization with progress tracking
 * - Single-frame detection
 * - Status reporting
 * - Resource cleanup
 * 
 * Contract Requirements:
 * - initialize() MUST be called before detect()
 * - initialize() MUST transition status: uninitialized → loading → ready
 * - detect() MUST throw if status is not 'ready'
 * - dispose() MUST clean up all model resources
 * - getStatus() MUST return current initialization state
 */
export interface CardDetector {
  /**
   * Get current detector status
   * 
   * @returns Current initialization status
   */
  getStatus(): DetectorStatus
  
  /**
   * Initialize the detector model
   * 
   * Contract:
   * - MUST load model and transition status to 'ready' on success
   * - MUST transition status to 'error' on failure
   * - MUST call onProgress callback during loading (if provided)
   * - MUST be idempotent (safe to call multiple times)
   * 
   * @returns Promise that resolves when model is ready
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>
  
  /**
   * Detect cards in a video frame
   * 
   * Contract:
   * - MUST throw if status is not 'ready'
   * - MUST return DetectionOutput with filtered cards
   * - MUST include inference time in milliseconds
   * - MUST handle WebGPU unavailability gracefully (fallback to WebGL/WASM)
   * 
   * @param canvas Canvas containing the frame to analyze
   * @param canvasWidth Display width for polygon conversion
   * @param canvasHeight Display height for polygon conversion
   * @returns Detection results with filtered cards
   * @throws Error if detector not initialized or detection fails
   */
  detect(
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<DetectionOutput>
  
  /**
   * Clean up detector resources
   * 
   * Contract:
   * - MUST release all model resources
   * - MUST transition status to 'uninitialized'
   * - MUST be safe to call multiple times
   */
  dispose(): void
}

/**
 * Detector type identifier
 * 
 * Used for detector selection via query parameter or configuration
 */
export type DetectorType = 'opencv' | 'detr' | 'owl-vit' | 'slimsam'

/**
 * Factory configuration for creating detectors
 */
export interface DetectorFactoryConfig {
  /** Type of detector to create */
  type: DetectorType
  
  /** Detector-specific configuration */
  config: DetectorConfig
}

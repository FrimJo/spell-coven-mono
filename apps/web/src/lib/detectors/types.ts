/**
 * Card detector abstraction types
 * 
 * Defines the interface for pluggable card detection models,
 * enabling easy switching between DETR, OWL-ViT, or other detectors.
 * 
 * @module detectors/types
 */

import type { DetectedCard } from '@/types/card-query'

/**
 * Configuration for detector initialization
 */
export interface DetectorConfig {
  /** Model identifier (e.g., 'Xenova/detr-resnet-50') */
  modelId: string
  
  /** Minimum confidence threshold for detections */
  confidenceThreshold: number
  
  /** Detection interval in milliseconds */
  detectionIntervalMs: number
  
  /** Optional progress callback for model loading */
  onProgress?: (message: string) => void
  
  /** Optional device preference ('auto', 'webgpu', 'wasm', 'cpu') */
  device?: string
  
  /** Optional data type ('fp32', 'fp16') */
  dtype?: string
}

/**
 * Status of detector initialization
 */
export type DetectorStatus = 'uninitialized' | 'loading' | 'ready' | 'error'

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
 */
export interface CardDetector {
  /**
   * Get current detector status
   */
  getStatus(): DetectorStatus
  
  /**
   * Initialize the detector model
   * @returns Promise that resolves when model is ready
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>
  
  /**
   * Detect cards in a video frame
   * @param canvas Canvas containing the frame to analyze
   * @param canvasWidth Display width for polygon conversion
   * @param canvasHeight Display height for polygon conversion
   * @returns Detection results with filtered cards
   */
  detect(
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<DetectionOutput>
  
  /**
   * Clean up detector resources
   */
  dispose(): void
}

/**
 * Detector type identifier
 */
export type DetectorType = 'opencv' | 'detr' | 'owl-vit'

/**
 * Factory configuration for creating detectors
 */
export interface DetectorFactoryConfig {
  /** Type of detector to create */
  type: DetectorType
  
  /** Detector-specific configuration */
  config: DetectorConfig
}

/**
 * Card detector module exports
 * 
 * Provides pluggable card detection with support for multiple models.
 * 
 * @module detectors
 */

// Core types
export type {
  CardDetector,
  DetectorConfig,
  DetectorStatus,
  DetectionOutput,
  DetectorType,
  DetectorFactoryConfig,
} from './types'

// Detector implementations
export { OpenCVDetector, type OpenCVConfig } from './opencv-detector'
export { DETRDetector } from './detr-detector'
export { OWLViTDetector, type OWLViTConfig } from './owl-vit-detector'
export { SlimSAMDetector } from './slimsam-detector'

// Factory
export {
  createDetector,
  createDefaultDetector,
  getDefaultDetectorType,
} from './factory'

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
} from './types.js'

// Detector implementations
export { OpenCVDetector, type OpenCVConfig } from './opencv-detector.js'
export { DETRDetector } from './detr-detector.js'
export { OWLViTDetector, type OWLViTConfig } from './owl-vit-detector.js'
export { SlimSAMDetector } from './slimsam-detector.js'

// Factory
export { createDetector } from './factory.js'

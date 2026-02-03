/**
 * Canvas cropping utilities
 *
 * Shared functions for cropping regions from a canvas with proper
 * aspect ratio preservation and centering.
 *
 * @module detectors/geometry/crop
 */

import { CANONICAL_CARD_SIZE } from '../types.js'

/**
 * Crop region specification in pixels
 */
export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Options for bounding box crop
 */
export interface BBoxCropOptions {
  /** Target output size (square canvas) */
  targetSize?: number
  /** Enable high-quality image smoothing */
  highQuality?: boolean
  /** Debug label for logging */
  debugLabel?: string
  /** Debug stage number for logging */
  debugStage?: number
  /** Debug background color */
  debugColor?: string
}

/**
 * Crop a region from a canvas and resize to a centered square
 *
 * Core cropping logic used by both perspective.ts and setupCardDetector.ts.
 * Crops the specified region, scales it to fit the target size while
 * maintaining aspect ratio, and centers it on a black background.
 *
 * @param sourceCanvas - Source canvas to crop from
 * @param region - Crop region in pixels
 * @param options - Crop options
 * @returns New canvas with cropped and centered image
 */
export function cropAndCenterToSquare(
  sourceCanvas: HTMLCanvasElement,
  region: CropRegion,
  options: BBoxCropOptions = {},
): HTMLCanvasElement {
  const {
    targetSize = CANONICAL_CARD_SIZE.width,
    highQuality = true,
    debugLabel,
    debugStage,
    debugColor = '#FF5722',
  } = options

  // Clamp region to canvas bounds
  const x = Math.max(0, Math.floor(region.x))
  const y = Math.max(0, Math.floor(region.y))
  const width = Math.min(sourceCanvas.width - x, Math.ceil(region.width))
  const height = Math.min(sourceCanvas.height - y, Math.ceil(region.height))

  // Create output canvas with black background
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetSize
  outputCanvas.height = targetSize
  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error(
      'cropAndCenterToSquare: Failed to get 2d context from canvas',
    )
  }

  // Fill with black
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, targetSize, targetSize)

  // Calculate scaling to fit the crop into the target size while maintaining aspect ratio
  const scale = Math.min(targetSize / width, targetSize / height)
  const scaledWidth = Math.round(width * scale)
  const scaledHeight = Math.round(height * scale)

  // Center the cropped image in the output canvas
  const offsetX = Math.round((targetSize - scaledWidth) / 2)
  const offsetY = Math.round((targetSize - scaledHeight) / 2)

  // Configure image smoothing
  ctx.imageSmoothingEnabled = highQuality
  if (highQuality) {
    ctx.imageSmoothingQuality = 'high'
  }

  // Draw the cropped region scaled and centered
  ctx.drawImage(
    sourceCanvas,
    x,
    y,
    width,
    height, // source rectangle
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight, // destination rectangle
  )

  // Log debug info if requested
  if (debugLabel) {
    const stagePrefix =
      debugStage !== undefined ? `[DEBUG STAGE ${debugStage}] ` : '[DEBUG] '
    outputCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        console.groupCollapsed(
          `%c${stagePrefix}${debugLabel}`,
          `background: ${debugColor}; color: white; padding: 2px 6px; border-radius: 3px;`,
        )
        console.log(
          '%c ',
          `background: url(${url}) no-repeat; background-size: contain; padding: 150px;`,
        )
        console.log('Blob URL (copy this):', url)
        console.log(
          'Output dimensions:',
          `${outputCanvas.width}x${outputCanvas.height}`,
        )
        console.log('Crop region:', { x, y, width, height })
        console.log('Scaled dimensions:', { scaledWidth, scaledHeight })
        console.groupEnd()
      }
    }, 'image/png')
  }

  return outputCanvas
}

/**
 * Compute bounding box from quad corners
 *
 * @param quad - Object with topLeft, topRight, bottomLeft, bottomRight points
 * @returns CropRegion representing the axis-aligned bounding box
 */
export function quadToBoundingBox(quad: {
  topLeft: { x: number; y: number }
  topRight: { x: number; y: number }
  bottomLeft: { x: number; y: number }
  bottomRight: { x: number; y: number }
}): CropRegion {
  const xs = [
    quad.topLeft.x,
    quad.topRight.x,
    quad.bottomLeft.x,
    quad.bottomRight.x,
  ]
  const ys = [
    quad.topLeft.y,
    quad.topRight.y,
    quad.bottomLeft.y,
    quad.bottomRight.y,
  ]

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Convert normalized bounding box (0-1) to pixel coordinates
 *
 * @param box - Normalized bounding box with xmin, ymin, xmax, ymax (0-1)
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @returns CropRegion in pixel coordinates
 */
export function normalizedBoxToCropRegion(
  box: { xmin: number; ymin: number; xmax: number; ymax: number },
  canvasWidth: number,
  canvasHeight: number,
): CropRegion {
  return {
    x: Math.round(box.xmin * canvasWidth),
    y: Math.round(box.ymin * canvasHeight),
    width: Math.round((box.xmax - box.xmin) * canvasWidth),
    height: Math.round((box.ymax - box.ymin) * canvasHeight),
  }
}

/**
 * Capture video frame result
 */
export interface CapturedFrame {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
}

/**
 * Capture a video frame to a canvas at the video's natural resolution
 *
 * Creates a canvas with the video's native dimensions and draws the current
 * frame to it. This preserves the correct aspect ratio without stretching.
 *
 * @param video - Video element to capture from
 * @param fallbackWidth - Fallback width if video dimensions unavailable
 * @param fallbackHeight - Fallback height if video dimensions unavailable
 * @returns CapturedFrame with canvas, context, and dimensions
 * @throws Error if canvas context cannot be created
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  fallbackWidth?: number,
  fallbackHeight?: number,
): CapturedFrame {
  const width = video.videoWidth || fallbackWidth || 640
  const height = video.videoHeight || fallbackHeight || 480

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('captureVideoFrame: Failed to get 2d context from canvas')
  }

  ctx.drawImage(video, 0, 0, width, height)

  return { canvas, ctx, width, height }
}

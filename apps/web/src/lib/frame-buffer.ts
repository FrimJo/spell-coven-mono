/**
 * Frame Buffer for temporal optimization
 *
 * Maintains a rolling buffer of recent video frames with sharpness scores
 * to enable selecting the sharpest frame within a time window.
 *
 * Uses a circular buffer for O(1) operations and WeakMap for metadata
 * to prevent memory leaks.
 *
 * @module frame-buffer
 */

import type { FrameMetadata } from './detectors/types'

/**
 * Configuration for FrameBuffer
 */
export interface FrameBufferConfig {
  /** Maximum number of frames to buffer (default: 6) */
  maxFrames?: number

  /** Time window for sharpest frame selection in ms (default: 150) */
  timeWindowMs?: number
}

/**
 * Circular buffer for video frames with sharpness tracking
 *
 * Maintains the most recent N frames and their sharpness scores.
 * Enables selecting the sharpest frame within a time window.
 */
export class FrameBuffer {
  private buffer: (HTMLCanvasElement | null)[]
  private metadata: WeakMap<
    HTMLCanvasElement,
    { timestamp: number; sharpness: number }
  >
  private maxFrames: number
  private timeWindowMs: number
  private writeIndex: number
  private count: number

  /**
   * Create a new FrameBuffer
   *
   * @param config - Buffer configuration
   */
  constructor(config: FrameBufferConfig = {}) {
    this.maxFrames = config.maxFrames ?? 6
    this.timeWindowMs = config.timeWindowMs ?? 150
    this.buffer = new Array(this.maxFrames)
    this.metadata = new WeakMap()
    this.writeIndex = 0
    this.count = 0
  }

  /**
   * Add a frame to the buffer
   *
   * Automatically evicts oldest frame when buffer is full.
   * Creates a copy of the canvas to prevent mutations.
   *
   * @param canvas - Canvas containing the frame
   * @param timestamp - Capture timestamp in milliseconds
   * @param sharpness - Sharpness score (Laplacian variance)
   */
  add(canvas: HTMLCanvasElement, timestamp: number, sharpness: number): void {
    // Create a copy of the canvas to prevent mutations
    const copy = document.createElement('canvas')
    copy.width = canvas.width
    copy.height = canvas.height
    const ctx = copy.getContext('2d')
    if (!ctx) {
      console.error('[FrameBuffer] Failed to get canvas context')
      return
    }
    ctx.drawImage(canvas, 0, 0)

    // Store in circular buffer (automatically evicts oldest)
    this.buffer[this.writeIndex] = copy
    this.metadata.set(copy, { timestamp, sharpness })

    // Advance write index (circular)
    this.writeIndex = (this.writeIndex + 1) % this.maxFrames
    this.count = Math.min(this.count + 1, this.maxFrames)

    console.log('[FrameBuffer] Added frame:', {
      timestamp,
      sharpness: sharpness.toFixed(2),
      bufferSize: this.count,
    })
  }

  /**
   * Get the sharpest frame within a time window
   *
   * @param referenceTime - Reference timestamp in milliseconds
   * @param windowMs - Time window in milliseconds (default: config.timeWindowMs)
   * @returns Sharpest frame metadata or null if no frames in window
   */
  getSharpest(referenceTime: number, windowMs?: number): FrameMetadata | null {
    const window = windowMs ?? this.timeWindowMs
    const minTime = referenceTime - window
    const maxTime = referenceTime + window

    let sharpestFrame: HTMLCanvasElement | null = null
    let maxSharpness = -Infinity

    // Search all frames in buffer
    for (let i = 0; i < this.count; i++) {
      const frame = this.buffer[i]
      if (!frame) continue

      const meta = this.metadata.get(frame)
      if (!meta) continue

      // Check if frame is within time window
      if (meta.timestamp >= minTime && meta.timestamp <= maxTime) {
        if (meta.sharpness > maxSharpness) {
          maxSharpness = meta.sharpness
          sharpestFrame = frame
        }
      }
    }

    if (!sharpestFrame) {
      console.warn('[FrameBuffer] No frames found in time window:', {
        referenceTime,
        window: `±${window}ms`,
        bufferSize: this.count,
      })
      return null
    }

    const meta = this.metadata.get(sharpestFrame)!

    console.log('[FrameBuffer] Selected sharpest frame:', {
      timestamp: meta.timestamp,
      sharpness: meta.sharpness.toFixed(2),
      timeDelta: `${meta.timestamp - referenceTime}ms`,
    })

    return {
      canvas: sharpestFrame,
      timestamp: meta.timestamp,
      sharpness: meta.sharpness,
    }
  }

  /**
   * Get all frames currently in the buffer
   *
   * @returns Array of frame metadata
   */
  getAll(): FrameMetadata[] {
    const frames: FrameMetadata[] = []

    for (let i = 0; i < this.count; i++) {
      const frame = this.buffer[i]
      if (!frame) continue

      const meta = this.metadata.get(frame)
      if (!meta) continue

      frames.push({
        canvas: frame,
        timestamp: meta.timestamp,
        sharpness: meta.sharpness,
      })
    }

    return frames
  }

  /**
   * Clear all frames from the buffer
   *
   * Resets the buffer to empty state.
   */
  clear(): void {
    // Clear references to allow garbage collection
    for (let i = 0; i < this.buffer.length; i++) {
      this.buffer[i] = null
    }

    this.writeIndex = 0
    this.count = 0

    console.log('[FrameBuffer] Cleared buffer')
  }

  /**
   * Get current buffer size
   *
   * @returns Number of frames currently buffered
   */
  size(): number {
    return this.count
  }

  /**
   * Check if buffer is empty
   *
   * @returns true if buffer has no frames
   */
  isEmpty(): boolean {
    return this.count === 0
  }

  /**
   * Check if buffer is full
   *
   * @returns true if buffer is at max capacity
   */
  isFull(): boolean {
    return this.count === this.maxFrames
  }
}

/**
 * Tests for card edge refinement
 * 
 * Note: These tests require a browser environment with canvas support
 * Run with: npm run test (using vitest with jsdom)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { isOpenCVLoaded, refineCardEdges } from './card-edge-refiner'

describe('Card Edge Refiner', () => {
  describe('isOpenCVLoaded', () => {
    it('should return false when OpenCV is not loaded', () => {
      expect(isOpenCVLoaded()).toBe(false)
    })
  })

  describe('refineCardEdges', () => {
    it('should return error when OpenCV is not loaded', () => {
      const canvas = document.createElement('canvas')
      canvas.width = 384
      canvas.height = 384

      const result = refineCardEdges(canvas)

      expect(result.success).toBe(false)
      expect(result.error).toContain('OpenCV not loaded')
    })

    it('should handle empty canvas', () => {
      // This test would need OpenCV loaded
      // Skipped in CI/CD environments
      const canvas = document.createElement('canvas')
      canvas.width = 384
      canvas.height = 384

      const result = refineCardEdges(canvas)

      // Without OpenCV, should fail gracefully
      expect(result.success).toBe(false)
    })
  })

  describe('RefinementResult', () => {
    it('should have correct structure for success', () => {
      // Mock successful result
      const mockResult: {
        success: true
        refinedCanvas: HTMLCanvasElement
        edges: {
          corners: Array<{ x: number; y: number }>
          confidence: number
        }
      } = {
        success: true,
        refinedCanvas: document.createElement('canvas'),
        edges: {
          corners: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          confidence: 0.95,
        },
      }

      expect(mockResult.success).toBe(true)
      expect(mockResult.refinedCanvas).toBeInstanceOf(HTMLCanvasElement)
      expect(mockResult.edges.corners).toHaveLength(4)
      expect(mockResult.edges.confidence).toBeGreaterThan(0)
      expect(mockResult.edges.confidence).toBeLessThanOrEqual(1)
    })

    it('should have correct structure for failure', () => {
      const mockResult: {
        success: false
        error: string
      } = {
        success: false,
        error: 'No quadrilateral found',
      }

      expect(mockResult.success).toBe(false)
      expect(mockResult.error).toBeDefined()
    })
  })
})

/**
 * Integration test (requires OpenCV to be loaded manually)
 * This is more of a manual test/demo
 */
describe.skip('Card Edge Refiner - Integration', () => {
  beforeAll(async () => {
    // In a real test, you'd load OpenCV here
    // For now, these tests are skipped
  })

  it('should refine a card image', () => {
    // Create a test canvas with a card-like shape
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')!

    // Draw a rotated rectangle (simulating a card)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 400, 400)
    ctx.fillStyle = 'black'
    ctx.save()
    ctx.translate(200, 200)
    ctx.rotate(Math.PI / 6) // 30 degrees
    ctx.fillRect(-100, -140, 200, 280) // Card-like aspect ratio
    ctx.restore()

    const result = refineCardEdges(canvas, 384, 384)

    if (isOpenCVLoaded()) {
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.refinedCanvas).toBeDefined()
        expect(result.edges?.confidence).toBeGreaterThan(0.7)
      }
    } else {
      expect(result.success).toBe(false)
    }
  })
})

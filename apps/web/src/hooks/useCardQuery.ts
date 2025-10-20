import type { CardQueryState, UseCardQueryReturn } from '@/types/card-query'
import { useCallback, useRef, useState } from 'react'
import { embedFromCanvas, top1 } from '@/lib/clip-search'
import { validateCanvas } from '@/types/card-query'
import { generateOrientationCandidates } from '@/lib/detectors/geometry/orientation'

export function useCardQuery(): UseCardQueryReturn {
  const [state, setState] = useState<CardQueryState>({
    status: 'idle',
    result: null,
    error: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const query = useCallback(
    async (canvas: HTMLCanvasElement) => {
      console.log('[useCardQuery] Query called with canvas:', {
        width: canvas.width,
        height: canvas.height,
      })

      // Cancel any pending query
      cancel()

      // Create new abort controller for this query
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Validate canvas
      const validation = validateCanvas(canvas)
      console.log('[useCardQuery] Canvas validation:', validation)

      if (!validation.isValid) {
        console.error(
          '[useCardQuery] Canvas validation failed:',
          validation.error,
        )
        setState({
          status: 'error',
          result: null,
          error: validation.error || 'Invalid canvas',
        })
        return
      }

      // Optional: Convert canvas to blob URL for debugging
      if (import.meta.env.DEV) {
        canvas.toBlob((blob) => {
          if (blob) {
            URL.createObjectURL(blob)
          }
        })
      }

      // Set querying state
      setState({
        status: 'querying',
        result: null,
        error: null,
      })

      try {
        // Check if aborted
        if (abortController.signal.aborted) {
          return
        }

        // Generate 180° rotation (cards are almost always upside down)
        console.log('[useCardQuery] Generating 180° rotation candidate...')
        const rotated180 = generateOrientationCandidates(canvas)[2] // Index 2 is 180°
        console.log('[useCardQuery] Generated 180° rotation candidate')

        // Check if aborted
        if (abortController.signal.aborted) {
          return
        }

        // Embed the 180° rotated canvas
        console.log('[useCardQuery] Starting embedding...')
        const { embedding, metrics: embeddingMetrics } = await embedFromCanvas(rotated180).catch((err) => {
          throw new Error(`Failed to embed canvas: ${err.message}`)
        })
        console.log('[useCardQuery] Embedding completed')

        // Query the database
        const searchStart = performance.now()
        const result = top1(embedding, canvas)
        const searchMs = performance.now() - searchStart

        if (!result) {
          throw new Error('No valid result from database search')
        }

        // Check if aborted after query
        if (abortController.signal.aborted) {
          return
        }

        // Log performance summary
        if ((canvas as any).__pipelineMetrics) {
          const metrics = (canvas as any).__pipelineMetrics
          const totalMs = metrics.detection + metrics.crop + embeddingMetrics.total + searchMs
          
          console.log('🎯 Pipeline Performance:', {
            'Detection': `${metrics.detection.toFixed(0)}ms`,
            'Crop & Warp': `${metrics.crop.toFixed(0)}ms`,
            'Embedding': `${embeddingMetrics.total.toFixed(0)}ms`,
            'Search': `${searchMs.toFixed(0)}ms`,
            'Total': `${totalMs.toFixed(0)}ms`
          })
          
          // Log detailed embedding breakdown if contrast enhancement is enabled
          if (embeddingMetrics.contrast > 0) {
            console.log('📊 Embedding Breakdown:', {
              'Contrast Enhancement': `${embeddingMetrics.contrast.toFixed(0)}ms`,
              'CLIP Inference': `${embeddingMetrics.inference.toFixed(0)}ms`,
              'L2 Normalization': `${embeddingMetrics.normalization.toFixed(0)}ms`,
              'Total Embedding': `${embeddingMetrics.total.toFixed(0)}ms`
            })
          } else {
            console.log('📊 Embedding Breakdown:', {
              'CLIP Inference': `${embeddingMetrics.inference.toFixed(0)}ms`,
              'L2 Normalization': `${embeddingMetrics.normalization.toFixed(0)}ms`,
              'Total Embedding': `${embeddingMetrics.total.toFixed(0)}ms`
            })
          }
        }

        // Set success state
        setState({
          status: 'success',
          result,
          error: null,
        })
        console.log('[useCardQuery] State updated to success')
      } catch (err) {
        // Only update state if not aborted
        if (!abortController.signal.aborted) {
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to identify card'

          setState({
            status: 'error',
            result: null,
            error: errorMessage,
          })
        }
      } finally {
        // Clear abort controller if this was the active one
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
      }
    },
    [cancel],
  )

  return { state, query, cancel }
}

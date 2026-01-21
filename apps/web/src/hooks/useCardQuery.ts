import type { CardQueryState, UseCardQueryReturn } from '@/types/card-query'
import { useCallback, useRef, useState } from 'react'
import {
  embedFromCanvas,
  top1,
  topK,
  type EmbeddingMetrics,
} from '@/lib/clip-search'
import { generateOrientationCandidates } from '@/lib/detectors/geometry/orientation'
import { validateCanvas } from '@/types/card-query'

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

      // Log the input canvas (after crop & perspective warp, before rotation)
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          console.groupCollapsed(
            '%c[DEBUG STAGE 4] Final cropped card (resized to 224x224, before rotation)',
            'background: #9C27B0; color: white; padding: 2px 6px; border-radius: 3px;',
          )
          console.log(
            '%c ',
            `background: url(${url}) no-repeat; background-size: contain; padding: 100px 150px;`,
          )
          console.log('Blob URL (copy this):', url)
          console.log('Dimensions:', `${canvas.width}x${canvas.height}`)
          console.groupEnd()
        }
      }, 'image/png')

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

        // Generate all orientation candidates and search for the best match
        console.log('[useCardQuery] Generating orientation candidates...')
        const orientationCandidates = generateOrientationCandidates(canvas)
        if (!orientationCandidates.length) {
          throw new Error('useCardQuery: Failed to generate orientation candidates')
        }
        console.log('[useCardQuery] Generated orientation candidates:', orientationCandidates.length)

        let bestResult: ReturnType<typeof top1> | null = null
        let bestScore = -Infinity
        let bestOrientation = -1
        let bestEmbeddingMetrics: EmbeddingMetrics | null = null
        let totalEmbeddingMs = 0
        let totalSearchMs = 0
        let bestEmbedding: Float32Array | null = null
        const TOP_K = 5

        for (let i = 0; i < orientationCandidates.length; i++) {
          const candidate = orientationCandidates[i]
          if (!candidate) continue

          // Check if aborted
          if (abortController.signal.aborted) {
            return
          }

          // Log the candidate canvas
          candidate.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              console.groupCollapsed(
                `%c[DEBUG STAGE 5] Card orientation candidate ${i} (ready for embedding)`,
                'background: #E91E63; color: white; padding: 2px 6px; border-radius: 3px;',
              )
              console.log(
                '%c ',
                `background: url(${url}) no-repeat; background-size: contain; padding: 100px 150px;`,
              )
              console.log('Blob URL (copy this):', url)
              console.log('Dimensions:', `${candidate.width}x${candidate.height}`)
              console.groupEnd()
            }
          }, 'image/png')

          // Embed the candidate
          console.log(`[useCardQuery] Starting embedding for orientation ${i}...`)
          const { embedding, metrics: embeddingMetrics } = await embedFromCanvas(
            candidate,
          ).catch((err) => {
            throw new Error(`Failed to embed canvas: ${err.message}`)
          })
          totalEmbeddingMs += embeddingMetrics.total
          console.log(`[useCardQuery] Embedding completed for orientation ${i}`)

          // Query the database
          console.log('[useCardQuery] Embedding dimension:', embedding.length)
          const searchStart = performance.now()
          let result
          try {
            result = top1(embedding)
          } catch (err) {
            console.error('[useCardQuery] top1() threw error:', err)
            throw err
          }
          const searchMs = performance.now() - searchStart
          totalSearchMs += searchMs
          console.log(
            `[useCardQuery] Database search completed in ${searchMs.toFixed(0)}ms (orientation ${i})`,
          )
          console.log('[useCardQuery] Search result:', result)

          if (result && result.score > bestScore) {
            bestScore = result.score
            bestResult = result
            bestOrientation = i
            bestEmbeddingMetrics = embeddingMetrics
            bestEmbedding = embedding
          }
        }

        if (!bestResult) {
          throw new Error('No valid result from database search')
        }

        // Check if aborted after query
        if (abortController.signal.aborted) {
          return
        }

        if (bestEmbedding) {
          const topKResults = topK(bestEmbedding, TOP_K)
          console.groupCollapsed(
            `[useCardQuery] Top-${TOP_K} results (orientation ${bestOrientation})`,
          )
          topKResults.forEach((item, index) => {
            console.log(
              `#${index + 1} score=${item.score.toFixed(4)} name="${item.name}" set=${item.set}`,
            )
          })
          console.groupEnd()
        }

        // Log performance summary
        const canvasWithMetrics = canvas as HTMLCanvasElement & {
          __pipelineMetrics?: { detection: number; crop: number }
        }
        if (canvasWithMetrics.__pipelineMetrics) {
          const metrics = canvasWithMetrics.__pipelineMetrics
          const totalMs =
            metrics.detection + metrics.crop + totalEmbeddingMs + totalSearchMs

          console.log('🎯 Pipeline Performance:', {
            Detection: `${metrics.detection.toFixed(0)}ms`,
            'Crop & Warp': `${metrics.crop.toFixed(0)}ms`,
            Embedding: `${totalEmbeddingMs.toFixed(0)}ms`,
            Search: `${totalSearchMs.toFixed(0)}ms`,
            Total: `${totalMs.toFixed(0)}ms`,
          })
          console.log('[useCardQuery] Best orientation index:', bestOrientation)

          // Log detailed embedding breakdown if contrast enhancement is enabled
          if (bestEmbeddingMetrics && bestEmbeddingMetrics.contrast > 0) {
            console.log('📊 Embedding Breakdown:', {
              'Contrast Enhancement': `${bestEmbeddingMetrics.contrast.toFixed(0)}ms`,
              'CLIP Inference': `${bestEmbeddingMetrics.inference.toFixed(0)}ms`,
              'L2 Normalization': `${bestEmbeddingMetrics.normalization.toFixed(0)}ms`,
              'Total Embedding': `${bestEmbeddingMetrics.total.toFixed(0)}ms`,
            })
          } else {
            console.log('📊 Embedding Breakdown:', {
              'CLIP Inference': `${bestEmbeddingMetrics?.inference.toFixed(0) ?? '0'}ms`,
              'L2 Normalization': `${bestEmbeddingMetrics?.normalization.toFixed(0) ?? '0'}ms`,
              'Total Embedding': `${bestEmbeddingMetrics?.total.toFixed(0) ?? '0'}ms`,
            })
          }
        }

        // Set success state
        setState({
          status: 'success',
          result: bestResult,
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

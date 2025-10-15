import type { CardQueryState, UseCardQueryReturn } from '@/types/card-query'
import { useCallback, useRef, useState } from 'react'
import { embedFromCanvas, top1 } from '@/lib/search'
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
      console.log('[useCardQuery] query() called with canvas:', canvas)
      
      // Cancel any pending query
      cancel()

      // Create new abort controller for this query
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Validate canvas
      console.log('[useCardQuery] Validating canvas...')
      const validation = validateCanvas(canvas)
      console.log('[useCardQuery] Validation result:', validation)
      
      if (!validation.isValid) {
        console.error('[useCardQuery] Canvas validation failed:', validation.error)
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
            const blobUrl = URL.createObjectURL(blob)
            console.log('Cropped card image:', blobUrl)
          }
        })
      }

      // Set querying state
      console.log('[useCardQuery] Setting status to "querying"')
      setState({
        status: 'querying',
        result: null,
        error: null,
      })

      try {
        // Check if aborted
        if (abortController.signal.aborted) {
          console.log('[useCardQuery] Query aborted before embedding')
          return
        }

        // Embed the canvas
        console.log('[useCardQuery] Calling embedFromCanvas...')
        const embedding = await embedFromCanvas(canvas)
        console.log('[useCardQuery] Embedding complete:', embedding)

        // Check if aborted after embedding
        if (abortController.signal.aborted) {
          return
        }

        // Query the database
        const result = top1(embedding)

        // Check if aborted after query
        if (abortController.signal.aborted) {
          return
        }

        // Set success state
        setState({
          status: 'success',
          result,
          error: null,
        })
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

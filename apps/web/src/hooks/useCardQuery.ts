import type { CardQueryState, UseCardQueryReturn } from '@/types/card-query'
import { useCallback, useRef, useState } from 'react'
import { embedFromCanvas, top1 } from '@/lib/search'
import { canvasToBase64, validateCanvas } from '@/types/card-query'

export function useCardQuery(): UseCardQueryReturn {
  const [state, setState] = useState<CardQueryState>({
    status: 'idle',
    result: null,
    error: null,
    croppedImageBase64: null,
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
      // Cancel any pending query
      cancel()

      // Create new abort controller for this query
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Validate canvas
      const validation = validateCanvas(canvas)
      if (!validation.isValid) {
        setState({
          status: 'error',
          result: null,
          error: validation.error || 'Invalid canvas',
          croppedImageBase64: null,
        })
        return
      }

      // Convert canvas to base64 for debugging
      const base64 = canvasToBase64(canvas)
      console.log('Cropped card image:', base64)

      // Set querying state
      setState({
        status: 'querying',
        result: null,
        error: null,
        croppedImageBase64: base64,
      })

      try {
        // Check if aborted
        if (abortController.signal.aborted) {
          return
        }

        // Embed the canvas
        const embedding = await embedFromCanvas(canvas)

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
          croppedImageBase64: base64,
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
            croppedImageBase64: base64,
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

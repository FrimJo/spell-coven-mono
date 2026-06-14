import type {
  CardHistoryEntry,
  CardQueryResult,
  CardQueryState,
  UseCardQueryReturn,
} from '@/types/card-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addAppBreadcrumb,
  captureAppException,
} from '@/integrations/sentry/reporting'
import { runCardQueryPipeline } from '@/lib/search/card-query-pipeline'
import { validateCanvas } from '@/types/card-query'

/** Maximum number of history entries to store per room */
const MAX_HISTORY_ENTRIES = 30

/** Prefix for localStorage key */
const STORAGE_KEY_PREFIX = 'spell-coven:card-history:'

/**
 * Load card history from localStorage for a specific room
 */
function loadHistory(roomId: string): CardHistoryEntry[] {
  if (!roomId) return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${roomId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as CardHistoryEntry[]
  } catch {
    return []
  }
}

/**
 * Save card history to localStorage for a specific room
 */
function saveHistory(roomId: string, history: CardHistoryEntry[]): void {
  if (!roomId) return
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${roomId}`,
      JSON.stringify(history),
    )
  } catch {
    // Ignore quota errors
  }
}

/**
 * Remove card history from localStorage for a specific room
 */
function removeHistory(roomId: string): void {
  if (!roomId) return
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${roomId}`)
  } catch {
    // Ignore errors
  }
}

/**
 * Create a history entry from a CardQueryResult
 */
function createHistoryEntry(
  result: CardQueryResult,
  source: 'search' | 'detection',
): CardHistoryEntry {
  return {
    id: `${result.name}:${result.set}`,
    name: result.name,
    set: result.set,
    image_url: result.image_url,
    card_url: result.card_url,
    scryfall_uri: result.scryfall_uri,
    timestamp: Date.now(),
    source,
  }
}

export function useCardQuery(roomId: string): UseCardQueryReturn {
  const [state, setState] = useState<CardQueryState>({
    status: 'idle',
    result: null,
    error: null,
    queryImageUrl: null,
  })

  // History state
  const [history, setHistory] = useState<CardHistoryEntry[]>([])

  // Dismissed state - when true, preview is hidden even if history exists
  const [isDismissed, setIsDismissed] = useState(false)

  // Track roomId to detect changes
  const roomIdRef = useRef<string>(roomId)

  // Load history from localStorage on mount or when roomId changes
  useEffect(() => {
    if (roomId !== roomIdRef.current) {
      roomIdRef.current = roomId
      setIsDismissed(false) // Reset dismissed state when switching rooms
    }
    const loaded = loadHistory(roomId)
    setHistory(loaded)
  }, [roomId])

  /**
   * Add an entry to history (capped at MAX_HISTORY_ENTRIES, most recent first)
   */
  const addToHistory = useCallback(
    (result: CardQueryResult, source: 'search' | 'detection') => {
      const entry = createHistoryEntry(result, source)
      setHistory((prev) => {
        // Remove duplicate if it exists (same id)
        const filtered = prev.filter((e) => e.id !== entry.id)
        // Add to front and cap
        const updated = [entry, ...filtered].slice(0, MAX_HISTORY_ENTRIES)
        saveHistory(roomId, updated)
        return updated
      })
    },
    [roomId],
  )

  /**
   * Clear the history for current room
   */
  const clearHistory = useCallback(() => {
    setHistory([])
    removeHistory(roomId)
  }, [roomId])

  /**
   * Remove a single entry from history (by id and timestamp)
   */
  const removeFromHistory = useCallback(
    (entry: CardHistoryEntry) => {
      setHistory((prev) => {
        const updated = prev.filter(
          (e) => !(e.id === entry.id && e.timestamp === entry.timestamp),
        )
        saveHistory(roomId, updated)
        return updated
      })
    },
    [roomId],
  )

  const abortControllerRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  /**
   * Clear the current result state and dismiss the preview
   */
  const clearResult = useCallback(() => {
    cancel()
    setIsDismissed(true) // Dismiss the preview
    setState({
      status: 'idle',
      result: null,
      error: null,
      queryImageUrl: null,
    })
  }, [cancel])

  /**
   * Manually set a card result (e.g., from Scryfall search selection).
   * Cancels any pending query and sets state to success.
   * Adds the result to history.
   */
  const setResult = useCallback(
    (result: CardQueryResult) => {
      cancel()
      setIsDismissed(false) // Un-dismiss when new card is selected
      setState({
        status: 'success',
        result,
        error: null,
        queryImageUrl: null, // Clear query image when manually setting result
      })
      // Add to history
      addToHistory(result, 'search')
    },
    [cancel, addToHistory],
  )

  /**
   * Set a card result without adding to history (e.g., clicking history entry).
   * Cancels any pending query and sets state to success.
   */
  const setResultWithoutHistory = useCallback(
    (result: CardQueryResult) => {
      cancel()
      setIsDismissed(false) // Un-dismiss when selecting from history
      setState({
        status: 'success',
        result,
        error: null,
        queryImageUrl: null, // Clear query image when manually setting result
      })
      // Do NOT add to history
    },
    [cancel],
  )

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
        addAppBreadcrumb('scanner', 'Canvas validation failed', {
          error: validation.error,
          width: canvas.width,
          height: canvas.height,
        })
        console.error(
          '[useCardQuery] Canvas validation failed:',
          validation.error,
        )
        setState({
          status: 'error',
          result: null,
          error: validation.error || 'Invalid canvas',
          queryImageUrl: null,
        })
        return
      }

      // Capture query image as data URL (for development debugging)
      const queryImageUrl = canvas.toDataURL('image/png')

      // Set querying state
      setState({
        status: 'querying',
        result: null,
        error: null,
        queryImageUrl,
      })

      try {
        // Check if aborted
        if (abortController.signal.aborted) {
          return
        }

        const pipelineResult = await runCardQueryPipeline(
          canvas,
          abortController.signal,
        )
        if (!pipelineResult) return

        // Set success state
        setIsDismissed(false) // Un-dismiss when new card is detected
        setState({
          status: 'success',
          result: pipelineResult.result,
          error: null,
          queryImageUrl: pipelineResult.queryImageUrl,
        })
        // Add to history (detection source)
        addToHistory(pipelineResult.result, 'detection')
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
            queryImageUrl,
          })
          captureAppException(err, {
            tags: { feature: 'scanner', operation: 'identify_card' },
          })
        }
      } finally {
        // Clear abort controller if this was the active one
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
      }
    },
    [cancel, addToHistory],
  )

  return {
    state,
    query,
    cancel,
    setResult,
    setResultWithoutHistory,
    history,
    isDismissed,
    clearHistory,
    clearResult,
    removeFromHistory,
  }
}

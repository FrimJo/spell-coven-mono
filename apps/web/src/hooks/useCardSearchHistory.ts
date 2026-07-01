import type {
  CardSearchHistoryEntry,
  CardSearchResult,
  UseCardSearchHistoryReturn,
} from '@/types/card-search'
import { useCallback, useState } from 'react'

const MAX_HISTORY_ENTRIES = 30
const STORAGE_KEY_PREFIX = 'spell-coven:card-history:'

function loadHistory(roomId: string): CardSearchHistoryEntry[] {
  if (!roomId) return []

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${roomId}`)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CardSearchHistoryEntry[]) : []
  } catch {
    return []
  }
}

function saveHistory(roomId: string, history: CardSearchHistoryEntry[]): void {
  if (!roomId) return

  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${roomId}`,
      JSON.stringify(history),
    )
  } catch {
    // History persistence is best-effort when storage is unavailable or full.
  }
}

function removeStoredHistory(roomId: string): void {
  if (!roomId) return

  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${roomId}`)
  } catch {
    // History persistence is best-effort when storage is unavailable.
  }
}

function createHistoryEntry(result: CardSearchResult): CardSearchHistoryEntry {
  return {
    ...result,
    id: `${result.name}:${result.set}`,
    timestamp: Date.now(),
  }
}

export function useCardSearchHistory(
  roomId: string,
): UseCardSearchHistoryReturn {
  const [currentResult, setCurrentResult] = useState<CardSearchResult | null>(
    null,
  )
  const [history, setHistory] = useState<CardSearchHistoryEntry[]>(() =>
    loadHistory(roomId),
  )
  const [isDismissed, setIsDismissed] = useState(false)

  const addToHistory = useCallback(
    (result: CardSearchResult) => {
      const entry = createHistoryEntry(result)
      setHistory((previous) => {
        const updated = [
          entry,
          ...previous.filter((candidate) => candidate.id !== entry.id),
        ].slice(0, MAX_HISTORY_ENTRIES)
        saveHistory(roomId, updated)
        return updated
      })
    },
    [roomId],
  )

  const setResult = useCallback(
    (result: CardSearchResult) => {
      setIsDismissed(false)
      setCurrentResult(result)
      addToHistory(result)
    },
    [addToHistory],
  )

  const setResultWithoutHistory = useCallback((result: CardSearchResult) => {
    setIsDismissed(false)
    setCurrentResult(result)
  }, [])

  const clearResult = useCallback(() => {
    setIsDismissed(true)
    setCurrentResult(null)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    removeStoredHistory(roomId)
  }, [roomId])

  const removeFromHistory = useCallback(
    (entry: CardSearchHistoryEntry) => {
      setHistory((previous) => {
        const updated = previous.filter(
          (candidate) =>
            candidate.id !== entry.id ||
            candidate.timestamp !== entry.timestamp,
        )
        saveHistory(roomId, updated)
        return updated
      })
    },
    [roomId],
  )

  return {
    currentResult,
    history,
    isDismissed,
    setResult,
    setResultWithoutHistory,
    clearHistory,
    removeFromHistory,
    clearResult,
  }
}

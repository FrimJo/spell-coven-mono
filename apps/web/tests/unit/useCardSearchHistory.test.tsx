import { useCardSearchHistory } from '@/hooks/useCardSearchHistory'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

const ROOM_ID = 'ABC123'
const STORAGE_KEY = `spell-coven:card-history:${ROOM_ID}`

describe('useCardSearchHistory', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('selects manual results and keeps one recent entry per card', () => {
    const { result } = renderHook(() => useCardSearchHistory(ROOM_ID))
    const card = {
      name: 'Lightning Bolt',
      set: 'LEA',
      scryfall_uri: 'https://scryfall.com/card/lea/161/lightning-bolt',
    }

    act(() => {
      result.current.setResult(card)
      result.current.setResult(card)
    })

    expect(result.current.currentResult).toEqual(card)
    expect(result.current.history).toHaveLength(1)
    const historyEntry = result.current.history[0]
    if (!historyEntry) throw new Error('Expected a history entry')
    expect(historyEntry.id).toBe('Lightning Bolt:LEA')
    expect(historyEntry.name).toBe(card.name)
    expect(historyEntry.set).toBe(card.set)
    expect(historyEntry.scryfall_uri).toBe(card.scryfall_uri)
  })

  it('selects a history result without adding another entry', () => {
    const { result } = renderHook(() => useCardSearchHistory(ROOM_ID))
    const card = { name: 'Counterspell', set: 'LEA' }

    act(() => result.current.setResult(card))
    const historyLength = result.current.history.length

    act(() => result.current.setResultWithoutHistory(card))

    expect(result.current.currentResult).toEqual(card)
    expect(result.current.history).toHaveLength(historyLength)
  })

  it('loads legacy persisted entries while ignoring obsolete fields', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'Sol Ring:LEA',
          name: 'Sol Ring',
          set: 'LEA',
          timestamp: 1,
          obsolete: true,
        },
      ]),
    )

    const { result } = renderHook(() => useCardSearchHistory(ROOM_ID))

    expect(result.current.history).toHaveLength(1)
    const legacyEntry = result.current.history[0]
    if (!legacyEntry) throw new Error('Expected a legacy history entry')
    expect(legacyEntry.id).toBe('Sol Ring:LEA')
    expect(legacyEntry.name).toBe('Sol Ring')
    expect(legacyEntry.set).toBe('LEA')
    expect(legacyEntry.timestamp).toBe(1)
  })
})

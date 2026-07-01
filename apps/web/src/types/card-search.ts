export interface CardSearchResult {
  name: string
  set: string
  scryfall_uri?: string
  image_url?: string
  card_url?: string
}

export interface CardSearchHistoryEntry extends CardSearchResult {
  id: string
  timestamp: number
}

export interface UseCardSearchHistoryReturn {
  currentResult: CardSearchResult | null
  history: CardSearchHistoryEntry[]
  isDismissed: boolean
  setResult: (result: CardSearchResult) => void
  setResultWithoutHistory: (result: CardSearchResult) => void
  clearHistory: () => void
  removeFromHistory: (entry: CardSearchHistoryEntry) => void
  clearResult: () => void
}

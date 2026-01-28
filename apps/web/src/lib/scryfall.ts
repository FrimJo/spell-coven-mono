/**
 * Scryfall API client for commander search
 *
 * Provides fuzzy autocomplete, card lookup, and partner/background detection.
 */

const SCRYFALL_API = 'https://api.scryfall.com'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScryfallRelatedCard {
  object: 'related_card'
  id: string
  component: 'token' | 'meld_part' | 'meld_result' | 'combo_piece'
  name: string
  type_line: string
  uri: string
}

export interface ScryfallCard {
  object: 'card'
  id: string
  oracle_id: string
  name: string
  type_line: string
  oracle_text?: string
  keywords: string[]
  all_parts?: ScryfallRelatedCard[]
  image_uris?: {
    small: string
    normal: string
    large: string
    art_crop: string
  }
  scryfall_uri: string
  legalities: Record<string, string>
}

export interface ScryfallAutocompleteResponse {
  object: 'catalog'
  total_values: number
  data: string[]
}

export interface ScryfallSearchResponse {
  object: 'list'
  total_cards: number
  has_more: boolean
  data: ScryfallCard[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Partner/Background Keywords
// ─────────────────────────────────────────────────────────────────────────────

/** Keywords that allow a second commander */
export const DUAL_COMMANDER_KEYWORDS = [
  'Partner',
  'Partner with',
  'Choose a background',
  'Friends forever',
  "Doctor's companion",
] as const

export type DualCommanderKeyword = (typeof DUAL_COMMANDER_KEYWORDS)[number]

/**
 * Detect which dual-commander keyword(s) a card has
 */
export function detectDualCommanderKeywords(
  card: ScryfallCard,
): DualCommanderKeyword[] {
  const found: DualCommanderKeyword[] = []
  for (const kw of DUAL_COMMANDER_KEYWORDS) {
    // Scryfall keywords are case-insensitive in practice; normalize
    if (card.keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      found.push(kw)
    }
  }
  return found
}

/**
 * For "Partner with" cards, extract the specific partner name from all_parts
 */
export function getSpecificPartner(card: ScryfallCard): string | null {
  if (!card.all_parts) return null
  // Find combo_piece that is a legendary creature and not the card itself
  for (const part of card.all_parts) {
    if (
      part.component === 'combo_piece' &&
      part.name !== card.name &&
      part.type_line.includes('Legendary Creature')
    ) {
      return part.name
    }
  }
  return null
}

/**
 * Check if a card is a Background (for Commander 2 filtering)
 */
export function isBackground(card: ScryfallCard): boolean {
  return card.type_line.toLowerCase().includes('background')
}

/**
 * Check if a card is legal as a commander
 */
export function isLegalCommander(card: ScryfallCard): boolean {
  // Must be legal in commander format
  if (card.legalities.commander !== 'legal') return false
  // Must be legendary creature or have "can be your commander"
  const typeLine = card.type_line.toLowerCase()
  if (typeLine.includes('legendary creature')) return true
  if (typeLine.includes('legendary planeswalker')) return true
  // Background enchantments can be commanders (paired)
  if (typeLine.includes('background')) return true
  // Check oracle text for "can be your commander"
  if (card.oracle_text?.toLowerCase().includes('can be your commander'))
    return true
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch autocomplete suggestions for a card name query
 * Uses Scryfall's /cards/autocomplete endpoint
 */
export async function autocomplete(query: string): Promise<string[]> {
  if (query.length < 2) return []
  const url = `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data: ScryfallAutocompleteResponse = await res.json()
  return data.data
}

/**
 * Fetch a card by exact or fuzzy name
 * Uses Scryfall's /cards/named endpoint
 */
export async function getCardByName(
  name: string,
  fuzzy = true,
): Promise<ScryfallCard | null> {
  const param = fuzzy ? 'fuzzy' : 'exact'
  const url = `${SCRYFALL_API}/cards/named?${param}=${encodeURIComponent(name)}`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

/**
 * Search for cards matching a query (Scryfall search syntax)
 * Uses Scryfall's /cards/search endpoint
 */
export async function searchCards(
  query: string,
  limit = 20,
): Promise<ScryfallCard[]> {
  const url = `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name`
  const res = await fetch(url)
  if (!res.ok) return []
  const data: ScryfallSearchResponse = await res.json()
  return data.data.slice(0, limit)
}

/**
 * Search for all Background cards (for "Choose a Background" commanders)
 */
export async function searchBackgrounds(): Promise<ScryfallCard[]> {
  return searchCards('type:background', 100)
}

/**
 * Search for cards with a specific keyword (for Partner, Friends forever, etc.)
 */
export async function searchByKeyword(
  keyword: string,
): Promise<ScryfallCard[]> {
  return searchCards(`keyword:"${keyword}"`, 100)
}

/**
 * Search for legendary creatures legal as commanders
 */
export async function searchCommanders(query: string): Promise<ScryfallCard[]> {
  // Filter for legendary creatures/planeswalkers legal in commander
  return searchCards(
    `${query} (type:legendary type:creature OR type:legendary type:planeswalker OR type:background) legal:commander`,
    20,
  )
}

/**
 * Search for commanders and sidekick cards (Backgrounds, Partners, etc.)
 * Returns only card names for autocomplete-like behavior
 * Uses Scryfall's is:commander filter plus sidekick keywords
 */
export async function searchCommanderAndSidekicks(
  query: string,
): Promise<string[]> {
  if (query.length < 2) return []
  
  // Build query: user text + (is:commander OR sidekick keywords)
  // Sidekick keywords: Background, Partner, Partner with, Friends forever, Doctor's companion, Choose a Background
  const sidekickQuery = [
    'is:commander',
    'type:background',
    'keyword:"Partner"',
    'keyword:"Partner with"',
    'keyword:"Friends forever"',
    'keyword:"Doctor\'s companion"',
    'keyword:"Choose a background"',
  ].join(' OR ')
  
  const fullQuery = `${query} (${sidekickQuery})`
  const cards = await searchCards(fullQuery, 20)
  return cards.map((card) => card.name)
}

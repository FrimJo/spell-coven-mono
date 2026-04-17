export interface ScryfallCard {
  name: string;
  id: string;
  set: string;
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
}

// Fetch all Standard-legal cards from Scryfall search API
export async function fetchStandardCards(): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = [];
  let url: string | null = 'https://api.scryfall.com/cards/search?q=legal%3Astandard&unique=prints&order=name';

  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Scryfall error: ${res.status}`);
    const page = await res.json() as { data: ScryfallCard[]; has_more: boolean; next_page?: string };
    cards.push(...page.data);
    url = page.has_more ? (page.next_page ?? null) : null;
    // Respect Scryfall rate limit: 50–100ms between requests
    if (url) await new Promise(r => setTimeout(r, 100));
  }

  return cards;
}

export function getImageUrl(card: ScryfallCard): string | null {
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return null;
}

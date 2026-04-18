export interface ScryfallCard {
  name: string;
  id: string;
  set: string;
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
}

const HEADERS = {
  'User-Agent': 'spell-casters-mtg/0.1 (https://github.com/tonylam07/spell-casters-mtg)',
  'Accept': 'application/json',
};

async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429 && attempt <= 5) {
    const wait = 2000 * attempt;
    console.log(`  rate-limited, waiting ${wait}ms (attempt ${attempt}/5)`);
    await new Promise(r => setTimeout(r, wait));
    return fetchWithRetry(url, attempt + 1);
  }
  return res;
}

// Fetch all Standard-legal cards from Scryfall search API.
// unique=cards returns ~2k unique cards (vs. ~10k printings).
export async function fetchStandardCards(): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = [];
  let url: string | null = 'https://api.scryfall.com/cards/search?q=legal%3Astandard&unique=cards&order=name';
  let page = 0;

  while (url) {
    page++;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`Scryfall error: ${res.status}`);
    const body = await res.json() as { data: ScryfallCard[]; has_more: boolean; next_page?: string };
    cards.push(...body.data);
    console.log(`  page ${page}: +${body.data.length} cards (total ${cards.length})`);
    url = body.has_more ? (body.next_page ?? null) : null;
    if (url) await new Promise(r => setTimeout(r, 150));
  }

  return cards;
}

export function getImageUrl(card: ScryfallCard): string | null {
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return null;
}

export interface ScryfallCard {
  name: string;
  id: string;
  set: string;
  legalities?: { standard?: string };
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
}

interface BulkData {
  type: string;
  download_uri: string;
  size: number;
}

const HEADERS = {
  'User-Agent': 'spell-casters-mtg/0.1 (https://github.com/tonylam07/spell-casters-mtg)',
  'Accept': 'application/json',
};

// Scryfall recommends bulk data for batch processing (one large download,
// no rate-limit pagination). See https://scryfall.com/docs/api/bulk-data
//
// The "oracle_cards" bulk gives one entry per unique card name (~30k cards,
// ~150 MB). We download it once and filter to Standard-legal only.
export async function fetchStandardCards(): Promise<ScryfallCard[]> {
  console.log('  fetching bulk-data manifest...');
  const manifestRes = await fetch('https://api.scryfall.com/bulk-data', { headers: HEADERS });
  if (!manifestRes.ok) throw new Error(`Bulk manifest error: ${manifestRes.status}`);
  const manifest = await manifestRes.json() as { data: BulkData[] };

  const oracle = manifest.data.find(b => b.type === 'oracle_cards');
  if (!oracle) throw new Error('oracle_cards bulk not found in manifest');

  const sizeMB = (oracle.size / 1024 / 1024).toFixed(1);
  console.log(`  downloading oracle_cards bulk (${sizeMB} MB)...`);
  const bulkRes = await fetch(oracle.download_uri, { headers: HEADERS });
  if (!bulkRes.ok) throw new Error(`Bulk download error: ${bulkRes.status}`);
  const allCards = await bulkRes.json() as ScryfallCard[];

  const standard = allCards.filter(c => c.legalities?.standard === 'legal');
  console.log(`  ${allCards.length} total cards, ${standard.length} Standard-legal`);
  return standard;
}

export function getImageUrl(card: ScryfallCard): string | null {
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return null;
}

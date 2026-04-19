export interface ScryfallCard {
  name: string;
  id: string;
  set: string;
  legalities?: Record<string, string>;
  image_uris?: { normal: string };
  card_faces?: Array<{ name?: string; image_uris?: { normal: string } }>;
}

interface BulkData {
  type: string;
  download_uri: string;
  size: number;
}

export const SUPPORTED_FORMATS = [
  'standard',
  'modern',
  'pioneer',
  'legacy',
  'vintage',
  'commander',
  'pauper',
] as const;

export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

const HEADERS = {
  'User-Agent': 'spell-casters-mtg/0.1 (https://github.com/tonylam07/spell-casters-mtg)',
  'Accept': 'application/json',
};

// Scryfall recommends bulk data for batch processing (one large download,
// no rate-limit pagination). See https://scryfall.com/docs/api/bulk-data
//
// We use the "unique_artwork" bulk which gives one entry per unique
// (oracle_id, illustration) pair (~50k cards, ~400 MB) so that visually
// distinct printings (showcase, borderless, promos, multiple set printings)
// each contribute their own embedding. Format-legality filter applies after
// download.
export async function fetchLegalCards(format: string): Promise<ScryfallCard[]> {
  if (!(SUPPORTED_FORMATS as readonly string[]).includes(format)) {
    throw new Error(
      `Unsupported format: "${format}". Supported: ${SUPPORTED_FORMATS.join(', ')}`,
    );
  }

  console.log('  fetching bulk-data manifest...');
  const manifestRes = await fetch('https://api.scryfall.com/bulk-data', { headers: HEADERS });
  if (!manifestRes.ok) throw new Error(`Bulk manifest error: ${manifestRes.status}`);
  const manifest = await manifestRes.json() as { data: BulkData[] };

  const bulk = manifest.data.find(b => b.type === 'unique_artwork');
  if (!bulk) throw new Error('unique_artwork bulk not found in manifest');

  const sizeMB = (bulk.size / 1024 / 1024).toFixed(1);
  console.log(`  downloading unique_artwork bulk (${sizeMB} MB)...`);
  const bulkRes = await fetch(bulk.download_uri, { headers: HEADERS });
  if (!bulkRes.ok) throw new Error(`Bulk download error: ${bulkRes.status}`);
  const allCards = await bulkRes.json() as ScryfallCard[];

  const legal = allCards.filter(c => c.legalities?.[format] === 'legal');
  console.log(`  ${allCards.length} total printings, ${legal.length} ${format}-legal`);
  return legal;
}

/**
 * Returns one or two image entries per card.
 * - Single-faced cards: one entry with `card.name`.
 * - Double-faced cards (transform, MDFC, etc.): TWO entries — one for the
 *   front face image and one for the back face image. Both entries share the
 *   full "Front // Back" name, so showing either side resolves to the same
 *   canonical name.
 */
export function getImageUrls(card: ScryfallCard): { name: string; url: string }[] {
  // Single-faced card with top-level image
  if (card.image_uris?.normal) {
    return [{ name: card.name, url: card.image_uris.normal }];
  }

  // DFC / MDFC: card_faces[] each have their own image_uris
  const faces = card.card_faces ?? [];
  const facesWithImages = faces.filter(f => f.image_uris?.normal);
  if (facesWithImages.length === 0) return [];

  // Use the full card name (already "Front // Back" from Scryfall) for all faces
  return facesWithImages.map(f => ({
    name: card.name,
    url: f.image_uris!.normal,
  }));
}

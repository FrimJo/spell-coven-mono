import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { CardMetadata } from '@repo/card-detection';
import type { ScryfallCard } from './scryfall';
import { getImageUrl } from './scryfall';
import { embedImageUrl } from './embedder';

const DIMS = 512;
const OUT_DIR = join(process.cwd(), 'static', 'card-index');

export async function buildIndex(cards: ScryfallCard[]): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const metadata: CardMetadata[] = [];
  const embeddingsList: Float32Array[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card) continue;
    const imageUrl = getImageUrl(card);

    if (!imageUrl) {
      console.warn(`[${i + 1}/${cards.length}] Skipped (no image): ${card.name}`);
      continue;
    }

    const embedding = await embedImageUrl(imageUrl);
    if (!embedding) {
      console.warn(`[${i + 1}/${cards.length}] Skipped (embed failed): ${card.name}`);
      continue;
    }

    metadata.push({ name: card.name, scryfallId: card.id, set: card.set });
    embeddingsList.push(embedding);

    if ((i + 1) % 100 === 0) {
      console.log(`[${i + 1}/${cards.length}] Processed: ${card.name}`);
    }
  }

  // Pack all embeddings into a single Float32Array binary
  const packed = new Float32Array(embeddingsList.length * DIMS);
  embeddingsList.forEach((emb, idx) => packed.set(emb, idx * DIMS));

  writeFileSync(join(OUT_DIR, 'card-embeddings.bin'), Buffer.from(packed.buffer));
  writeFileSync(join(OUT_DIR, 'card-metadata.json'), JSON.stringify(metadata, null, 2));

  console.log(`\nDone. ${metadata.length} cards written to static/card-index/`);
}

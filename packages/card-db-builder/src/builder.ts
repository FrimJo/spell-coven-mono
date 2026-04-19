import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { createHash } from 'node:crypto';
import { join } from 'path';
import type { CardMetadata } from '@repo/card-detection';
import type { ScryfallCard } from './scryfall';
import { getImageUrls } from './scryfall';
import { embedImageUrl } from './embedder';

const DIMS = 512;
// Resolve to repo root regardless of where the script is invoked from.
// __dirname = packages/card-db-builder/src → up three to repo root.
const OUT_DIR = join(import.meta.dirname, '..', '..', '..', 'static', 'card-index');

export async function buildIndex(cards: ScryfallCard[], format = 'standard'): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const metadata: CardMetadata[] = [];
  const embeddingsList: Float32Array[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card) continue;
    const entries = getImageUrls(card);

    if (entries.length === 0) {
      console.warn(`[${i + 1}/${cards.length}] Skipped (no image): ${card.name}`);
      continue;
    }

    for (const entry of entries) {
      const embedding = await embedImageUrl(entry.url);
      if (!embedding) {
        console.warn(`[${i + 1}/${cards.length}] Skipped (embed failed): ${entry.name}`);
        continue;
      }

      metadata.push({ name: entry.name, scryfallId: card.id, set: card.set });
      embeddingsList.push(embedding);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`[${i + 1}/${cards.length}] Processed: ${card.name}`);
    }
  }

  // Pack all embeddings into a single Float32Array binary
  const packed = new Float32Array(embeddingsList.length * DIMS);
  embeddingsList.forEach((emb, idx) => packed.set(emb, idx * DIMS));

  const embeddingsPath = join(OUT_DIR, 'card-embeddings.bin');
  const metadataPath = join(OUT_DIR, 'card-metadata.json');
  const versionPath = join(OUT_DIR, 'card-index-version.json');

  writeFileSync(embeddingsPath, Buffer.from(packed.buffer));
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Hash the embeddings file for cache-busting. First 8 hex chars is plenty
  // (~4 billion possibilities) for differentiating successive builds.
  const hash = createHash('sha256').update(readFileSync(embeddingsPath)).digest('hex').slice(0, 8);
  const versionDoc = {
    version: hash,
    format,
    count: metadata.length,
    builtAt: new Date().toISOString(),
  };
  writeFileSync(versionPath, JSON.stringify(versionDoc, null, 2));

  console.log(
    `\nDone. ${metadata.length} entries (${cards.length} cards) written to static/card-index/ — version ${hash}`,
  );
}

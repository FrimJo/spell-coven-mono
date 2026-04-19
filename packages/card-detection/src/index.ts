import type { CardMatch } from './types';
import { encodeImage } from './encoder';
import { getIndex } from './loader';
import { topK } from './search';

export type { CardMatch, CardMetadata } from './types';

export async function identifyCard(imageData: ImageData): Promise<CardMatch[]> {
  const [queryEmbedding, index] = await Promise.all([
    encodeImage(imageData),
    getIndex(),
  ]);

  const results = topK(queryEmbedding, index.embeddings, index.dims, 3);

  return results.map(r => {
    const meta = index.metadata[r.index];
    if (!meta) throw new Error(`metadata missing for index ${r.index}`);
    return {
      name: meta.name,
      scryfallId: meta.scryfallId,
      confidence: Math.max(0, Math.min(1, r.similarity)),
    };
  });
}

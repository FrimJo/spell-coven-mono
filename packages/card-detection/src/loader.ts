import type { CardMetadata } from './types';

export interface CardIndex {
  embeddings: Float32Array;
  metadata: CardMetadata[];
  dims: number;
}

let cached: CardIndex | null = null;

export async function getIndex(): Promise<CardIndex> {
  if (cached) return cached;

  const [embeddingsResponse, metadataResponse] = await Promise.all([
    fetch('/card-index/card-embeddings.bin'),
    fetch('/card-index/card-metadata.json'),
  ]);

  if (!embeddingsResponse.ok || !metadataResponse.ok) {
    throw new Error('Failed to load card index');
  }

  const [embeddingsBuffer, metadata] = await Promise.all([
    embeddingsResponse.arrayBuffer(),
    metadataResponse.json() as Promise<CardMetadata[]>,
  ]);

  cached = {
    embeddings: new Float32Array(embeddingsBuffer),
    metadata,
    dims: 512,
  };

  return cached;
}

// Exported for tests only
export function __resetCache(): void {
  cached = null;
}

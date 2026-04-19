import type { CardIndexVersion, CardMetadata } from './types';

export interface CardIndex {
  embeddings: Float32Array;
  metadata: CardMetadata[];
  dims: number;
}

let cached: CardIndex | null = null;
let cachedVersion: string | null = null;

const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null &&
  typeof window === 'undefined';

async function loadFromFs(): Promise<CardIndex> {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), 'static', 'card-index');
  const [embeddingsBuffer, metadataText] = await Promise.all([
    readFile(join(dir, 'card-embeddings.bin')),
    readFile(join(dir, 'card-metadata.json'), 'utf-8'),
  ]);
  return {
    embeddings: new Float32Array(
      embeddingsBuffer.buffer,
      embeddingsBuffer.byteOffset,
      embeddingsBuffer.byteLength / 4,
    ),
    metadata: JSON.parse(metadataText) as CardMetadata[],
    dims: 512,
  };
}

async function loadFromFetch(): Promise<CardIndex> {
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
  return {
    embeddings: new Float32Array(embeddingsBuffer),
    metadata,
    dims: 512,
  };
}

async function loadVersionFromFs(): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const path = join(process.cwd(), 'static', 'card-index', 'card-index-version.json');
  const text = await readFile(path, 'utf-8');
  return (JSON.parse(text) as CardIndexVersion).version;
}

async function loadVersionFromFetch(): Promise<string> {
  const res = await fetch('/card-index/card-index-version.json');
  if (!res.ok) throw new Error(`Version fetch failed: ${res.status}`);
  const doc = await res.json() as CardIndexVersion;
  return doc.version;
}

export async function getIndex(): Promise<CardIndex> {
  if (cached) return cached;
  cached = isNode ? await loadFromFs() : await loadFromFetch();
  return cached;
}

export async function getIndexVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  cachedVersion = isNode ? await loadVersionFromFs() : await loadVersionFromFetch();
  return cachedVersion;
}

// Exported for tests only
export function __resetCache(): void {
  cached = null;
  cachedVersion = null;
}

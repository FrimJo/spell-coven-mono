export interface SearchResult {
  index: number;
  similarity: number;
}

export function topK(
  query: Float32Array,
  stored: Float32Array,
  dims: number,
  k: number,
): SearchResult[] {
  const numVectors = Math.floor(stored.length / dims);
  const results: SearchResult[] = new Array(numVectors);

  for (let i = 0; i < numVectors; i++) {
    let dot = 0;
    const offset = i * dims;
    for (let d = 0; d < dims; d++) {
      dot += query[d]! * stored[offset + d]!;
    }
    results[i] = { index: i, similarity: dot };
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, Math.min(k, numVectors));
}

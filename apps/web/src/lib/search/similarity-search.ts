/**
 * Similarity search module
 *
 * Performs dot product similarity search over L2-normalized embeddings.
 * Returns top-1 match with card metadata.
 *
 * @module search/similarity-search
 */

import type {
  CardRecord,
  MetadataFile,
} from '../validation/contract-validator.js'
import type { EmbeddingDatabase } from './embeddings-loader.js'

/**
 * Query embedding from CLIP model
 */
export interface QueryEmbedding {
  /** L2-normalized embedding vector */
  vector: Float32Array
}

export interface SearchResult {
  /** Matched card metadata */
  card: CardRecord
  /** Cosine similarity score (dot product for L2-normalized vectors) */
  score: number
  /** Time taken for search in milliseconds */
  inferenceTimeMs: number
  /** Index of matched card in database */
  index: number
}

/**
 * T041: Compute dot product similarity (FR-007)
 *
 * For L2-normalized vectors: cosine similarity = dot product
 * No additional normalization needed.
 *
 * @param queryVec - Query embedding vector (512-dim)
 * @param dbVec - Database embedding vector (512-dim)
 * @param embeddingDim - Dimension of embeddings (512)
 * @returns Dot product similarity score
 */
export function computeSimilarity(
  queryVec: Float32Array,
  dbVec: Float32Array,
  offset: number,
  embeddingDim: number,
): number {
  let score = 0
  for (let j = 0; j < embeddingDim; j++) {
    score += queryVec[j] * dbVec[offset + j]
  }
  return score
}

/**
 * T042: Return top-1 match (FR-012)
 *
 * Performs brute-force search over all database vectors.
 * Returns single best match with highest similarity score.
 *
 * @param query - Query embedding from CLIP
 * @param database - Loaded embedding database
 * @param metadata - Metadata with card records
 * @returns Top-1 search result
 * @throws Error if database is empty or query dimension mismatch
 */
export function top1(
  query: QueryEmbedding,
  database: EmbeddingDatabase,
  metadata: MetadataFile,
): SearchResult {
  const startTime = performance.now()

  // Validate inputs
  if (database.numCards === 0) {
    throw new Error('Empty embedding database')
  }

  if (query.vector.length !== database.embeddingDim) {
    throw new Error(
      `Query dimension mismatch: expected ${database.embeddingDim}, got ${query.vector.length}`,
    )
  }

  // Brute-force search
  let maxScore = -Infinity
  let bestIdx = -1

  for (let i = 0; i < database.numCards; i++) {
    const offset = i * database.embeddingDim
    const score = computeSimilarity(
      query.vector,
      database.vectors,
      offset,
      database.embeddingDim,
    )

    if (score > maxScore) {
      maxScore = score
      bestIdx = i
    }
  }

  const inferenceTimeMs = performance.now() - startTime

  // Validate result
  if (bestIdx === -1) {
    throw new Error('No valid match found in database')
  }

  if (bestIdx >= metadata.records.length) {
    throw new Error(
      `Best match index ${bestIdx} out of bounds (metadata has ${metadata.records.length} records)`,
    )
  }

  return {
    card: metadata.records[bestIdx],
    score: maxScore,
    inferenceTimeMs,
    index: bestIdx,
  }
}

/**
 * Search with multiple results (future enhancement)
 *
 * @param query - Query embedding
 * @param database - Embedding database
 * @param metadata - Metadata file
 * @param k - Number of results to return
 * @returns Top-k search results sorted by score
 */
export function topK(
  query: QueryEmbedding,
  database: EmbeddingDatabase,
  metadata: MetadataFile,
  k: number,
): SearchResult[] {
  const startTime = performance.now()

  // Validate inputs
  if (database.numCards === 0) {
    throw new Error('Empty embedding database')
  }

  if (query.vector.length !== database.embeddingDim) {
    throw new Error(
      `Query dimension mismatch: expected ${database.embeddingDim}, got ${query.vector.length}`,
    )
  }

  // Compute all similarities
  const scores: Array<{ score: number; index: number }> = []

  for (let i = 0; i < database.numCards; i++) {
    const offset = i * database.embeddingDim
    const score = computeSimilarity(
      query.vector,
      database.vectors,
      offset,
      database.embeddingDim,
    )
    scores.push({ score, index: i })
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score)

  // Take top-k
  const topKScores = scores.slice(0, Math.min(k, scores.length))

  const inferenceTimeMs = performance.now() - startTime

  // Build results
  return topKScores.map(({ score, index }) => ({
    card: metadata.records[index],
    score,
    inferenceTimeMs: inferenceTimeMs / topKScores.length, // Amortized time
    index,
  }))
}

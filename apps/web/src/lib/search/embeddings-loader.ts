import type { MetadataFile } from '../validation/contract-validator.js'
import {
  logValidationErrors,
  validateEmbeddings,
} from '../validation/contract-validator.js'

/**
 * Embeddings loader module
 *
 * Loads and dequantizes int8 embeddings from binary file.
 * Validates L2 normalization after dequantization.
 *
 * @module search/embeddings-loader
 */

export interface EmbeddingDatabase {
  /** Dequantized float32 embeddings in row-major layout */
  vectors: Float32Array
  /** Number of cards in database */
  numCards: number
  /** Embedding dimension (should be 512) */
  embeddingDim: number
  /** Whether database is loaded and validated */
  isLoaded: boolean
}

/**
 * Load binary embeddings file from URL
 *
 * @param url - URL to embeddings.i8bin file
 * @returns Int8Array containing quantized embeddings
 * @throws Error if fetch fails or response is not ok
 */
export async function loadBinaryEmbeddings(url: string): Promise<Int8Array> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch embeddings: ${response.status} ${response.statusText}`,
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    return new Int8Array(arrayBuffer)
  } catch (error) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      type: 'embedding',
      context: 'Binary embeddings loading',
      error: error instanceof Error ? error.message : String(error),
      url,
    }
    console.error('[EmbeddingsLoader]', JSON.stringify(errorLog, null, 2))
    throw error
  }
}

/**
 * Dequantize int8 embeddings to float32 (FR-005)
 *
 * Formula: float32_value = int8_value / scale_factor
 *
 * @param int8Data - Quantized embeddings
 * @param scaleFactor - Scale factor from metadata (should be 127)
 * @returns Dequantized float32 embeddings
 */
export function dequantizeEmbeddings(
  int8Data: Int8Array,
  scaleFactor: number,
): Float32Array {
  const float32Data = new Float32Array(int8Data.length)

  for (let i = 0; i < int8Data.length; i++) {
    float32Data[i] = int8Data[i] / scaleFactor
  }

  return float32Data
}

/**
 * Verify L2 normalization of embeddings (FR-006, SC-007)
 *
 * Checks that vectors are approximately L2-normalized (norm ≈ 1.0).
 * Allows tolerance of ±0.008 for quantization error.
 *
 * @param vectors - Dequantized embeddings
 * @param embeddingDim - Dimension of each embedding (512)
 * @param sampleSize - Number of vectors to check (default: 100)
 * @returns true if all sampled vectors are normalized within tolerance
 */
export function verifyL2Normalization(
  vectors: Float32Array,
  embeddingDim: number,
  sampleSize = 100,
): boolean {
  const numVectors = vectors.length / embeddingDim
  const checkCount = Math.min(sampleSize, numVectors)
  const tolerance = 0.008

  for (let i = 0; i < checkCount; i++) {
    // Sample evenly distributed vectors
    const vectorIdx = Math.floor((i * numVectors) / checkCount)
    const offset = vectorIdx * embeddingDim

    // Compute L2 norm
    let norm = 0
    for (let j = 0; j < embeddingDim; j++) {
      const val = vectors[offset + j]
      norm += val * val
    }
    norm = Math.sqrt(norm)

    // Check if within tolerance
    if (Math.abs(norm - 1.0) > tolerance) {
      const errorLog = {
        timestamp: new Date().toISOString(),
        type: 'embedding',
        context: 'L2 normalization verification',
        error: `Vector at index ${vectorIdx} has L2 norm ${norm.toFixed(4)}, expected ~1.0 ±${tolerance}`,
        vectorIdx,
        norm,
      }
      console.error('[EmbeddingsLoader]', JSON.stringify(errorLog, null, 2))
      return false
    }
  }

  return true
}

/**
 * Load and prepare embedding database
 *
 * Complete flow:
 * 1. Load binary file
 * 2. Validate data contract (FR-001 to FR-007, FR-014)
 * 3. Dequantize int8 → float32
 * 4. Verify L2 normalization
 *
 * @param binaryUrl - URL to embeddings.i8bin
 * @param metadata - Parsed metadata file
 * @returns Ready-to-use embedding database
 * @throws Error if loading, validation, dequantization, or normalization fails
 */
export async function loadEmbeddingDatabase(
  binaryUrl: string,
  metadata: MetadataFile,
): Promise<EmbeddingDatabase> {
  // Load binary data
  const int8Data = await loadBinaryEmbeddings(binaryUrl)

  // Validate data contract (T020 - Integration)
  const validationResult = validateEmbeddings(int8Data, metadata)
  if (!validationResult.valid) {
    logValidationErrors(validationResult.errors)
    throw new Error(
      `Data contract validation failed:\n${validationResult.errors.join('\n')}`,
    )
  }

  // Dequantize
  const vectors = dequantizeEmbeddings(
    int8Data,
    metadata.quantization.scale_factor,
  )

  // Verify normalization
  const [numCards, embeddingDim] = metadata.shape
  const isNormalized = verifyL2Normalization(vectors, embeddingDim)

  if (!isNormalized) {
    throw new Error(
      'Embedding normalization verification failed. ' +
        'Vectors are not L2-normalized within acceptable tolerance. ' +
        'Re-export embeddings with correct normalization.',
    )
  }

  return {
    vectors,
    numCards,
    embeddingDim,
    isLoaded: true,
  }
}

/**
 * Contract: Embeddings Data Format
 * 
 * Defines the data format for pre-computed card embeddings loaded from server.
 * This contract ensures compatibility between Python pipeline and browser.
 * 
 * Version: 0.3.0 (Breaking change: 512-dim → 768-dim)
 */

export interface CardRecord {
  /** Card name */
  name: string
  /** Scryfall UUID */
  scryfall_id: string
  /** Face identifier for multi-face cards */
  face_id: string
  /** Set code */
  set: string
  /** Collector number */
  collector_number: string
  /** Card frame style */
  frame: string
  /** Card layout type */
  layout: string
  /** Language code */
  lang: string
  /** Color identity */
  colors: string[]
  /** Scryfall image URL */
  image_url: string
  /** Scryfall card page URL */
  card_url: string
  /** Scryfall API URI */
  scryfall_uri: string
}

export interface EmbeddingMetadata {
  /** Data format version (semantic versioning) */
  version: string
  
  /** Embedding array shape [N, D] where N=cards, D=768 */
  shape: [number, number]
  
  /** Model used to generate embeddings */
  model: string
  
  /** Quantization method */
  quantization: 'int8'
  
  /** Card metadata for each embedding */
  records: CardRecord[]
}

export interface DatabaseEmbeddings {
  /** Quantized embeddings, int8 format, shape [N, 768] */
  embeddings: Int8Array
  
  /** Metadata describing embeddings format */
  metadata: EmbeddingMetadata
  
  /** Card information for each embedding (same as metadata.records) */
  cards: CardRecord[]
}

/**
 * Binary Format Specification
 * 
 * File: embeddings.bin
 * - Encoding: Signed int8 (range: -127 to 127)
 * - Byte order: Little-endian (native on x86/ARM)
 * - Layout: Row-major, shape [N, 768]
 * - Quantization: Maps float32 [-1.0, 1.0] to int8 [-127, 127]
 *   Formula: int8_value = clip(float32_value * 127, -127, 127)
 * - Total size: Exactly N * 768 bytes
 * 
 * File: meta.json
 * - Format: JSON
 * - Schema: EmbeddingMetadata (see above)
 * - Size: Variable (depends on number of cards)
 */

/**
 * Validation Rules
 */
export const DATA_CONTRACT_RULES = {
  /** Expected embedding dimension (CHANGED from 512) */
  EMBEDDING_DIM: 768,
  
  /** Expected model identifier (CHANGED from ViT-B/32) */
  MODEL_ID: 'ViT-L/14@336px',
  
  /** Expected quantization method */
  QUANTIZATION: 'int8' as const,
  
  /** Expected version (semantic versioning) */
  MIN_VERSION: '0.3.0',
  
  /** Int8 quantization scale factor */
  QUANTIZATION_SCALE: 127,
  
  /** Int8 value range */
  INT8_MIN: -127,
  INT8_MAX: 127,
} as const

/**
 * Validation Functions
 */
export interface IContractValidator {
  /**
   * Validate embeddings data contract
   * 
   * @param binaryData - Raw int8 embedding data
   * @param metadata - Embedding metadata from meta.json
   * @returns Validation errors (empty array if valid)
   * 
   * Checks:
   * - Binary file size matches expected dimensions (N * 768 bytes)
   * - Metadata shape[1] equals 768
   * - Model identifier is "ViT-L/14@336px"
   * - Quantization method is "int8"
   * - Record count matches embedding count
   * - Version is compatible (>= 0.3.0)
   */
  validateEmbeddingsContract(
    binaryData: Int8Array,
    metadata: EmbeddingMetadata
  ): string[]

  /**
   * Validate query embedding before search
   * 
   * @param embedding - Query embedding to validate
   * @param databaseDim - Expected dimension from database
   * @returns Validation errors (empty array if valid)
   * 
   * Checks:
   * - Embedding dimension matches database dimension
   * - Vector is L2-normalized (norm ~1.0 ±0.008)
   * - No NaN or Infinity values
   */
  validateQueryEmbedding(
    embedding: Float32Array,
    databaseDim: number
  ): string[]
}

/**
 * Error Messages
 */
export const DATA_CONTRACT_ERRORS = {
  SIZE_MISMATCH: (expected: number, actual: number, numCards: number, dim: number) =>
    `Embedding file size mismatch: expected ${expected} bytes ` +
    `(${numCards} cards × ${dim} dims), got ${actual} bytes. ` +
    `Re-export embeddings using export_for_browser.py`,
  
  DIMENSION_MISMATCH: (expected: number, actual: number) =>
    `Invalid embedding dimension: expected ${expected}, got ${actual}. ` +
    `CLIP model produces ${expected}-dimensional vectors.`,
  
  MODEL_MISMATCH: (expected: string, actual: string) =>
    `Model mismatch: expected ${expected}, got ${actual}. ` +
    `Database may have been generated with wrong model.`,
  
  RECORD_COUNT_MISMATCH: (embeddingCount: number, recordCount: number) =>
    `Metadata count mismatch: embeddings contain ${embeddingCount} cards, ` +
    `but meta.json has ${recordCount} records. ` +
    `Ensure export completed successfully.`,
  
  VERSION_INCOMPATIBLE: (required: string, actual: string) =>
    `Incompatible data version: requires ${required}+, got ${actual}. ` +
    `Please regenerate embeddings with updated Python pipeline.`,
  
  QUERY_DIMENSION_MISMATCH: (expected: number, actual: number) =>
    `Query dimension mismatch: expected ${expected}, got ${actual}. ` +
    `Ensure browser uses ViT-L/14@336px model. ` +
    `Database may need regeneration with updated Python pipeline.`,
  
  NOT_NORMALIZED: (norm: number) =>
    `Embedding not properly normalized: L2 norm = ${norm.toFixed(4)}, ` +
    `expected ~1.0 ±0.008`,
  
  INVALID_VALUES: 'Embedding contains NaN or Infinity values',
  
  DATABASE_OLD_FORMAT:
    'Database uses old 512-dim format. ' +
    'Please regenerate with ViT-L/14@336px model.',
} as const

/**
 * Migration Guide
 */
export const MIGRATION_GUIDE = {
  FROM_512_TO_768: `
# Migration: 512-dim (ViT-B/32) → 768-dim (ViT-L/14@336px)

This is a BREAKING CHANGE. Old embeddings are incompatible.

## Steps:

1. Navigate to packages/mtg-image-db/
2. Run: python build_embeddings.py --kind unique_artwork
   (Default model is already ViT-L/14@336px)
3. Run: python export_for_browser.py
4. Deploy updated embeddings to web app:
   - embeddings.bin (768-dim int8 format)
   - meta.json (shape [N, 768])
5. Browser will automatically validate and use new format

## Verification:

- Check meta.json: shape[1] should be 768
- Check embeddings.bin size: should be N * 768 bytes
- Browser console should show no dimension mismatch errors
`,
} as const

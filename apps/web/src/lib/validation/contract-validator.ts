/**
 * Data contract validation for mtg-image-db artifacts
 *
 * Validates binary embeddings and metadata against the v1.0 contract specification.
 * Ensures format compatibility between Python export and browser consumption.
 *
 * @module validation/contract-validator
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface QuantizationParams {
  dtype: string
  scale_factor: number
  original_dtype: string
  note: string
}

export interface CardRecord {
  name: string
  set: string
  image_url: string
  card_url: string
  scryfall_id?: string
  face_id?: string
  collector_number?: string
  frame?: string
  layout?: string
  lang?: string
  colors?: string[]
  scryfall_uri?: string
  [key: string]: unknown
}

export interface MetadataFile {
  version: string
  quantization: QuantizationParams
  shape: [number, number]
  records: CardRecord[]
}

/**
 * Validate embeddings binary data and metadata against contract requirements
 *
 * Checks:
 * - FR-001: File size matches shape
 * - FR-002: Version is "1.0"
 * - FR-003: Record count matches shape
 * - FR-004: Quantization parameters are correct
 * - FR-014: Required fields are present
 *
 * @param binaryData - Int8Array containing quantized embeddings
 * @param metadata - Parsed metadata file
 * @returns Validation result with errors if any
 */
export function validateEmbeddings(
  binaryData: Int8Array,
  metadata: MetadataFile,
): ValidationResult {
  const errors: string[] = []

  // FR-002: Version validation
  if (metadata.version !== '1.0') {
    errors.push(
      `Unsupported metadata version: expected "1.0", got "${metadata.version}". ` +
        `Update to latest export format or use compatible browser client version.`,
    )
  }

  // FR-001: File size validation
  const [numCards, embeddingDim] = metadata.shape
  const expectedSize = numCards * embeddingDim
  if (binaryData.length !== expectedSize) {
    errors.push(
      `Embedding file size mismatch: expected ${expectedSize} bytes ` +
        `(${numCards} cards × ${embeddingDim} dims), got ${binaryData.length} bytes. ` +
        `Re-export embeddings using export_for_browser.py`,
    )
  }

  // Validate embedding dimension
  if (embeddingDim !== 768) {
    errors.push(
      `Invalid embedding dimension: expected 768, got ${embeddingDim}. ` +
        `CLIP ViT-L/14@336px model produces 768-dimensional vectors.`,
    )
  }

  // FR-003: Record count validation
  if (metadata.records.length !== numCards) {
    errors.push(
      `Metadata count mismatch: embeddings contain ${numCards} cards, ` +
        `but meta.json has ${metadata.records.length} records. ` +
        `Ensure export completed successfully.`,
    )
  }

  // FR-004: Quantization dtype validation
  if (metadata.quantization.dtype !== 'int8') {
    errors.push(
      `Unsupported quantization dtype: expected "int8", got "${metadata.quantization.dtype}". ` +
        `Browser requires int8 quantized embeddings.`,
    )
  }

  // FR-004: Scale factor validation
  if (metadata.quantization.scale_factor !== 127) {
    errors.push(
      `Invalid scale factor: expected 127, got ${metadata.quantization.scale_factor}. ` +
        `Dequantization formula requires scale_factor=127.`,
    )
  }

  // FR-014: Required fields validation (sample first 10 records)
  const sampleSize = Math.min(metadata.records.length, 10)
  for (let i = 0; i < sampleSize; i++) {
    const record = metadata.records[i]
    if (!record) continue
    const requiredFields = ['name', 'set', 'image_url', 'card_url']
    for (const field of requiredFields) {
      if (!record[field as keyof typeof record]) {
        errors.push(
          `Missing required field "${field}" in card record at index ${i}. ` +
            `Check export_for_browser.py output for completeness.`,
        )
        break // Only report first missing field per record
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Log validation errors to console with structured format (FR-018)
 *
 * @param errors - Array of validation error messages
 */
export function logValidationErrors(errors: string[]): void {
  if (errors.length === 0) return

  const errorLog = {
    timestamp: new Date().toISOString(),
    type: 'validation' as const,
    context: 'Data contract validation',
    errors,
  }

  console.error('[ContractValidator]', JSON.stringify(errorLog, null, 2))
}

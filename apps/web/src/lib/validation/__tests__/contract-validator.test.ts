/**
 * Tests for data contract validation
 * 
 * Covers:
 * - T021: Validation with correct data (SC-001)
 * - T022: Validation with mismatched file size (SC-002)
 * - T023: Validation with wrong version (SC-002)
 * - T024: Validation with mismatched record count (SC-002)
 */

import { describe, it, expect } from 'vitest'
import { validateEmbeddings, type MetadataFile } from '../contract-validator'

describe('Contract Validator', () => {
  const createValidMetadata = (numCards = 50000): MetadataFile => ({
    version: '1.0',
    quantization: {
      dtype: 'int8',
      scale_factor: 127,
      original_dtype: 'float32',
      note: 'Test quantization'
    },
    shape: [numCards, 512],
    records: Array(numCards).fill(null).map((_, i) => ({
      name: `Test Card ${i}`,
      set: 'TST',
      image_url: 'https://example.com/image.jpg',
      card_url: 'https://example.com/card.jpg'
    }))
  })

  // T021: Test validation with correct data (SC-001)
  it('should pass validation for correct data', () => {
    const numCards = 50000
    const binaryData = new Int8Array(numCards * 512)
    const metadata = createValidMetadata(numCards)
    
    const result = validateEmbeddings(binaryData, metadata)
    
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // T022: Test validation with mismatched file size (SC-002)
  it('should fail validation for file size mismatch', () => {
    const binaryData = new Int8Array(1000) // Wrong size
    const metadata = createValidMetadata(50000)
    
    const result = validateEmbeddings(binaryData, metadata)
    
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some(e => e.includes('size mismatch'))).toBe(true)
    expect(result.errors.some(e => e.includes('Re-export embeddings'))).toBe(true)
  })

  // T023: Test validation with wrong version (SC-002)
  it('should fail validation for wrong version', () => {
    const numCards = 50000
    const binaryData = new Int8Array(numCards * 512)
    const metadata = createValidMetadata(numCards)
    metadata.version = '2.0' // Wrong version
    
    const result = validateEmbeddings(binaryData, metadata)
    
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some(e => e.includes('Unsupported metadata version'))).toBe(true)
    expect(result.errors.some(e => e.includes('expected "1.0"'))).toBe(true)
  })

  // T024: Test validation with mismatched record count (SC-002)
  it('should fail validation for record count mismatch', () => {
    const numCards = 50000
    const binaryData = new Int8Array(numCards * 512)
    const metadata = createValidMetadata(numCards)
    metadata.records = metadata.records.slice(0, 1000) // Wrong count
    
    const result = validateEmbeddings(binaryData, metadata)
    
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some(e => e.includes('count mismatch'))).toBe(true)
    expect(result.errors.some(e => e.includes('1000 records'))).toBe(true)
  })

  it('should fail validation for wrong dtype', () => {
    const numCards = 50000
    const binaryData = new Int8Array(numCards * 512)
    const metadata = createValidMetadata(numCards)
    metadata.quantization.dtype = 'float32' // Wrong dtype
    
    const result = validateEmbeddings(binaryData, metadata)
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Unsupported quantization dtype'))).toBe(true)
  })

  it('should fail validation for wrong scale factor', () => {
    const numCards = 50000
    const binaryData = new Int8Array(numCards * 512)
    const metadata = createValidMetadata(numCards)
    metadata.quantization.scale_factor = 255 // Wrong scale factor
    
    const result = validateEmbeddings(binaryData, metadata)
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Invalid scale factor'))).toBe(true)
  })

  it('should fail validation for missing required fields', () => {
    const numCards = 10
    const binaryData = new Int8Array(numCards * 512)
    const metadata = createValidMetadata(numCards)
    // Remove required field from first record
    delete (metadata.records[0] as Record<string, unknown>).name
    
    const result = validateEmbeddings(binaryData, metadata)
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Missing required field "name"'))).toBe(true)
  })

  it('should fail validation for wrong embedding dimension', () => {
    const numCards = 50000
    const binaryData = new Int8Array(numCards * 256) // Wrong dimension
    const metadata = createValidMetadata(numCards)
    metadata.shape = [numCards, 256] // Wrong dimension
    
    const result = validateEmbeddings(binaryData, metadata)
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Invalid embedding dimension'))).toBe(true)
    expect(result.errors.some(e => e.includes('expected 512'))).toBe(true)
  })
})

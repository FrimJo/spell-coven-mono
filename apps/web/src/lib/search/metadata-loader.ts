/**
 * Metadata loader module
 * 
 * Loads and parses metadata JSON file with card records and quantization parameters.
 * 
 * @module search/metadata-loader
 */

import type { MetadataFile } from '../validation/contract-validator'

/**
 * Load metadata JSON file from URL
 * 
 * @param url - URL to meta.json file
 * @returns Parsed metadata file
 * @throws Error if fetch fails, response is not ok, or JSON parsing fails
 */
export async function loadMetadata(url: string): Promise<MetadataFile> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`)
    }
    
    const metadata = await response.json() as MetadataFile
    
    // Basic structure validation
    if (!metadata.version || !metadata.quantization || !metadata.shape || !metadata.records) {
      throw new Error(
        'Invalid metadata structure: missing required fields (version, quantization, shape, or records)'
      )
    }
    
    return metadata
  } catch (error) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      type: 'embedding',
      context: 'Metadata loading',
      error: error instanceof Error ? error.message : String(error),
      url
    }
    console.error('[MetadataLoader]', JSON.stringify(errorLog, null, 2))
    throw error
  }
}

/**
 * Get card record by index
 * 
 * @param metadata - Loaded metadata file
 * @param index - Card index (0-based)
 * @returns Card record at specified index
 * @throws Error if index is out of bounds
 */
export function getCardRecord(metadata: MetadataFile, index: number) {
  if (index < 0 || index >= metadata.records.length) {
    throw new Error(
      `Card index ${index} out of bounds (0-${metadata.records.length - 1})`
    )
  }
  
  return metadata.records[index]
}

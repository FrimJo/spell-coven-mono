# Quickstart: MTG Image Database and Frontend Integration

**Feature**: 010-ensure-mtg-image  
**Date**: 2025-10-16  
**Estimated Time**: 30-45 minutes

## Overview

This guide walks through implementing the SlimSAM card detector with CLIP embedding integration. By the end, you'll have a working card identification system that validates data contracts and returns top-1 matches.

## Prerequisites

- Node.js 18+ and pnpm installed
- Python 3.11+ (for mtg-image-db export)
- Modern browser with WebGPU support (Chrome/Edge recommended)
- Existing mtg-image-db package with exported embeddings

## Step 1: Verify Data Contracts (5 minutes)

First, ensure the mtg-image-db package has exported artifacts in the correct format.

### Check Export Artifacts

```bash
cd packages/mtg-image-db
ls -lh index_out/

# Should see:
# embeddings.i8bin  (~25MB for 50k cards)
# meta.json         (~5-10MB)
```

### Validate Metadata Format

```bash
# Check version field
cat index_out/meta.json | jq '.version'
# Should output: "1.0"

# Check quantization parameters
cat index_out/meta.json | jq '.quantization'
# Should show: dtype="int8", scale_factor=127

# Check shape
cat index_out/meta.json | jq '.shape'
# Should show: [N, 512] where N is number of cards
```

### Re-export if Needed

If artifacts are missing or in old format:

```bash
python export_for_browser.py
# Generates embeddings.i8bin and meta.json in index_out/
```

## Step 2: Copy Artifacts to Web App (2 minutes)

```bash
# From repo root
mkdir -p apps/web/public/index_out
cp packages/mtg-image-db/index_out/embeddings.i8bin apps/web/public/index_out/
cp packages/mtg-image-db/index_out/meta.json apps/web/public/index_out/
```

## Step 3: Update Detector Types (3 minutes)

Add 'slimsam' to the detector type enum:

```typescript
// apps/web/src/lib/detectors/types.ts

export type DetectorType = 'opencv' | 'detr' | 'owl-vit' | 'slimsam'
```

Update the route configuration:

```typescript
// apps/web/src/routes/game.$gameId.tsx

const defaultValues = {
  detector: 'slimsam' as const, // Changed from 'detr'
}

const gameSearchSchema = z.object({
  detector: z.enum(['opencv', 'detr', 'owl-vit', 'slimsam']).default(defaultValues.detector),
})
```

## Step 4: Implement Contract Validator (10 minutes)

Create the data contract validation module:

```typescript
// apps/web/src/lib/validation/contract-validator.ts

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface MetadataFile {
  version: string
  quantization: {
    dtype: string
    scale_factor: number
    original_dtype: string
    note: string
  }
  shape: [number, number]
  records: Array<{
    name: string
    set: string
    image_url: string
    card_url: string
    [key: string]: unknown
  }>
}

export function validateEmbeddings(
  binaryData: Int8Array,
  metadata: MetadataFile
): ValidationResult {
  const errors: string[] = []
  
  // FR-002: Version validation
  if (metadata.version !== '1.0') {
    errors.push(
      `Unsupported metadata version: expected "1.0", got "${metadata.version}". ` +
      `Update to latest export format.`
    )
  }
  
  // FR-001: File size validation
  const [numCards, embeddingDim] = metadata.shape
  const expectedSize = numCards * embeddingDim
  if (binaryData.length !== expectedSize) {
    errors.push(
      `Embedding file size mismatch: expected ${expectedSize} bytes ` +
      `(${numCards} cards × ${embeddingDim} dims), got ${binaryData.length} bytes. ` +
      `Re-export embeddings using export_for_browser.py`
    )
  }
  
  // FR-003: Record count validation
  if (metadata.records.length !== numCards) {
    errors.push(
      `Metadata count mismatch: embeddings contain ${numCards} cards, ` +
      `but meta.json has ${metadata.records.length} records.`
    )
  }
  
  // Quantization validation
  if (metadata.quantization.dtype !== 'int8') {
    errors.push(
      `Unsupported quantization dtype: expected "int8", got "${metadata.quantization.dtype}"`
    )
  }
  
  if (metadata.quantization.scale_factor !== 127) {
    errors.push(
      `Invalid scale factor: expected 127, got ${metadata.quantization.scale_factor}`
    )
  }
  
  // FR-014: Required fields validation
  for (let i = 0; i < Math.min(metadata.records.length, 10); i++) {
    const record = metadata.records[i]
    const requiredFields = ['name', 'set', 'image_url', 'card_url']
    for (const field of requiredFields) {
      if (!record[field]) {
        errors.push(
          `Missing required field "${field}" in card record at index ${i}`
        )
        break
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}
```

## Step 5: Implement SlimSAM Detector (15 minutes)

Create the new detector implementation:

```typescript
// apps/web/src/lib/detectors/slimsam-detector.ts

import { pipeline, type ImageSegmentationPipeline } from '@xenova/transformers'
import type {
  CardDetector,
  DetectorConfig,
  DetectorStatus,
  DetectionOutput,
  DetectedCard,
  Point
} from './types'

export class SlimSAMDetector implements CardDetector {
  private status: DetectorStatus = 'uninitialized'
  private segmenter: ImageSegmentationPipeline | null = null
  private config: DetectorConfig
  
  constructor(config: DetectorConfig) {
    this.config = config
  }
  
  getStatus(): DetectorStatus {
    return this.status
  }
  
  async initialize(): Promise<void> {
    if (this.status === 'ready') return
    
    try {
      this.status = 'loading'
      this.config.onProgress?.('Loading SlimSAM model...')
      
      this.segmenter = await pipeline(
        'image-segmentation',
        this.config.modelId || 'Xenova/slimsam',
        {
          dtype: this.config.dtype || 'fp16',
          device: this.config.device || 'webgpu'
        }
      )
      
      this.status = 'ready'
      this.config.onProgress?.('SlimSAM model ready')
    } catch (error) {
      this.status = 'error'
      console.error('[SlimSAMDetector] Initialization failed:', {
        timestamp: new Date().toISOString(),
        type: 'detection',
        context: 'SlimSAM initialization',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
  
  async detect(
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<DetectionOutput> {
    if (this.status !== 'ready' || !this.segmenter) {
      throw new Error('Detector not initialized. Call initialize() first.')
    }
    
    const startTime = performance.now()
    
    try {
      // TODO: Get click point from user interaction
      // For now, use center of canvas as placeholder
      const clickPoint: Point = {
        x: canvasWidth / 2,
        y: canvasHeight / 2
      }
      
      // Run segmentation with point prompt
      const result = await this.segmenter(canvas, {
        points: [[clickPoint.x, clickPoint.y]],
        labels: [1] // 1 = foreground
      })
      
      // Extract mask and convert to polygon
      // TODO: Implement mask-to-polygon conversion
      // For now, return placeholder
      const cards: DetectedCard[] = []
      
      const inferenceTimeMs = performance.now() - startTime
      
      return {
        cards,
        inferenceTimeMs,
        rawDetectionCount: result.masks?.length || 0
      }
    } catch (error) {
      console.error('[SlimSAMDetector] Detection failed:', {
        timestamp: new Date().toISOString(),
        type: 'detection',
        context: 'SlimSAM segmentation',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
  
  dispose(): void {
    this.segmenter = null
    this.status = 'uninitialized'
  }
}
```

## Step 6: Test Data Contract Validation (5 minutes)

Create a simple test to verify validation works:

```typescript
// apps/web/src/lib/validation/__tests__/contract-validator.test.ts

import { describe, it, expect } from 'vitest'
import { validateEmbeddings } from '../contract-validator'

describe('Contract Validator', () => {
  it('should pass validation for correct data', () => {
    const binaryData = new Int8Array(50000 * 512) // 50k cards
    const metadata = {
      version: '1.0',
      quantization: {
        dtype: 'int8',
        scale_factor: 127,
        original_dtype: 'float32',
        note: 'Test'
      },
      shape: [50000, 512] as [number, number],
      records: Array(50000).fill({
        name: 'Test Card',
        set: 'TST',
        image_url: 'https://example.com/image.jpg',
        card_url: 'https://example.com/card.jpg'
      })
    }
    
    const result = validateEmbeddings(binaryData, metadata)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
  
  it('should fail validation for size mismatch', () => {
    const binaryData = new Int8Array(1000) // Wrong size
    const metadata = {
      version: '1.0',
      quantization: { dtype: 'int8', scale_factor: 127, original_dtype: 'float32', note: '' },
      shape: [50000, 512] as [number, number],
      records: []
    }
    
    const result = validateEmbeddings(binaryData, metadata)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(expect.stringContaining('size mismatch'))
  })
})
```

Run tests:

```bash
cd apps/web
pnpm test
```

## Step 7: Run Type Checking and Linting (3 minutes)

```bash
# From repo root
pnpm check-types
pnpm lint
```

Fix any type errors or linting issues that appear.

## Step 8: Test in Browser (5 minutes)

Start the development server:

```bash
cd apps/web
pnpm dev
```

Navigate to `http://localhost:5173/game/test?detector=slimsam`

Check browser console for:
- Model loading progress
- Validation success/failure messages
- Any error logs

## Next Steps

After completing this quickstart:

1. **Implement CLIP Embedding**: Add `clip-embedder.ts` module
2. **Implement Similarity Search**: Add `similarity-search.ts` module
3. **Complete SlimSAM Detection**: Implement mask-to-polygon conversion
4. **Add UI Components**: Create `CardIdentificationResult.tsx`
5. **Write E2E Tests**: Use mocked webcam stream for automated testing

## Troubleshooting

### Model fails to load

**Error**: `Failed to load model: 404 Not Found`

**Solution**: Check internet connection. Models are loaded from Hugging Face CDN.

### Validation errors

**Error**: `Embedding file size mismatch`

**Solution**: Re-export embeddings using `export_for_browser.py`

### WebGPU not available

**Warning**: `WebGPU not supported, falling back to WebGL`

**Solution**: Use Chrome/Edge with WebGPU enabled, or accept WebGL fallback (slower)

### Type errors

**Error**: `Property 'slimsam' does not exist on type DetectorType`

**Solution**: Ensure you updated both `types.ts` and `game.$gameId.tsx`

## References

- [Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Research Document](./research.md)
- [Data Model](./data-model.md)
- [Contracts](./contracts/)

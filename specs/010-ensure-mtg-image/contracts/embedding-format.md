# Embedding Binary Format Specification

**Version**: 1.0  
**Date**: 2025-10-16  
**Purpose**: Define the binary format for int8-quantized CLIP embeddings exported from mtg-image-db

## Overview

This document specifies the binary format for `embeddings.i8bin`, which contains int8-quantized CLIP embeddings for MTG cards. The format is designed for efficient browser delivery and consumption.

## File Format

### Basic Properties

- **File Extension**: `.i8bin`
- **MIME Type**: `application/octet-stream`
- **Encoding**: Binary (signed int8)
- **Byte Order**: Little-endian (native on x86/ARM)
- **Layout**: Row-major (C-style)

### Structure

```
[int8][int8][int8]...[int8]
 ↑                        ↑
 First embedding          Last embedding
 (512 values)             (512 values)
```

**Total Size**: `N × 512` bytes, where N is the number of cards

### Dimensions

- **Shape**: `[N, 512]`
  - N: Number of cards in the dataset
  - 512: CLIP ViT-B/32 embedding dimension (fixed)

- **Per-Card Size**: 512 bytes (one int8 value per dimension)

### Data Type

- **Type**: Signed 8-bit integer (`int8`)
- **Range**: -127 to 127
- **Zero Point**: 0 (symmetric quantization)

## Quantization

### Quantization Formula

```
int8_value = clip(float32_value × 127, -127, 127)
```

Where:
- `float32_value`: Original L2-normalized embedding value (range: approximately -1.0 to 1.0)
- `clip(x, min, max)`: Clamps x to [min, max]
- Result: int8 value in range [-127, 127]

### Dequantization Formula

```
float32_value = int8_value / 127.0
```

### Quantization Parameters

- **Scale Factor**: 127 (fixed)
- **Zero Point**: 0 (symmetric)
- **Original Data Type**: float32
- **Original Range**: [-1.0, 1.0] (L2-normalized vectors)

### Quantization Error

- **Maximum Error**: ±1/127 ≈ ±0.0079 per dimension
- **L2 Norm Deviation**: ±0.008 (typical)
- **Cosine Similarity Impact**: Negligible for practical purposes

## Invariants

### Pre-Quantization Invariants

1. **L2 Normalization**: Source embeddings in `mtg_embeddings.npy` MUST be L2-normalized before quantization
   ```
   ||embedding||₂ = 1.0 (within floating-point precision)
   ```

2. **Dimension**: All embeddings MUST have exactly 512 dimensions

### Post-Dequantization Invariants

1. **Approximate L2 Normalization**: After dequantization, vectors MUST have L2 norm ≈ 1.0
   ```
   0.992 ≤ ||dequantized_embedding||₂ ≤ 1.008
   ```

2. **No Re-Normalization Required**: Browser MUST NOT re-normalize after dequantization

3. **Cosine Similarity**: For L2-normalized vectors, cosine similarity equals dot product
   ```
   cosine_similarity(a, b) = dot_product(a, b)
   ```

## Validation Rules

### File Size Validation

```typescript
const expectedSize = shape[0] * shape[1] // N cards × 512 dimensions
const actualSize = file.byteLength

if (actualSize !== expectedSize) {
  throw new Error(
    `Embedding file size mismatch: expected ${expectedSize} bytes ` +
    `(${shape[0]} cards × ${shape[1]} dims), got ${actualSize} bytes. ` +
    `Re-export embeddings using export_for_browser.py`
  )
}
```

### Data Range Validation

```typescript
const int8Array = new Int8Array(buffer)

for (let i = 0; i < int8Array.length; i++) {
  const value = int8Array[i]
  if (value < -127 || value > 127) {
    throw new Error(
      `Invalid int8 value at index ${i}: ${value}. ` +
      `Values must be in range [-127, 127].`
    )
  }
}
```

### L2 Norm Validation (Post-Dequantization)

```typescript
function validateL2Norm(embedding: Float32Array): void {
  let sumSquares = 0
  for (let i = 0; i < embedding.length; i++) {
    sumSquares += embedding[i] * embedding[i]
  }
  const norm = Math.sqrt(sumSquares)
  
  if (norm < 0.992 || norm > 1.008) {
    throw new Error(
      `L2 norm out of expected range: ${norm}. ` +
      `Expected approximately 1.0 (within ±0.008). ` +
      `Check quantization parameters.`
    )
  }
}
```

## Loading in Browser

### TypeScript Example

```typescript
async function loadEmbeddings(url: string): Promise<Int8Array> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load embeddings: ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  return new Int8Array(buffer)
}

function dequantize(int8Data: Int8Array): Float32Array {
  const float32Data = new Float32Array(int8Data.length)
  for (let i = 0; i < int8Data.length; i++) {
    float32Data[i] = int8Data[i] / 127.0
  }
  return float32Data
}

// Usage
const int8Embeddings = await loadEmbeddings('/index_out/embeddings.i8bin')
const float32Embeddings = dequantize(int8Embeddings)
```

## Memory Layout

### Row-Major Layout

Embeddings are stored in row-major order (C-style):

```
Card 0: [dim0, dim1, dim2, ..., dim511]
Card 1: [dim0, dim1, dim2, ..., dim511]
Card 2: [dim0, dim1, dim2, ..., dim511]
...
Card N-1: [dim0, dim1, dim2, ..., dim511]
```

### Indexing

To access embedding for card `i`, dimension `j`:

```typescript
const index = i * 512 + j
const value = embeddings[index]
```

To extract full embedding for card `i`:

```typescript
const start = i * 512
const end = start + 512
const embedding = embeddings.slice(start, end)
```

## Compatibility

### Version Compatibility Matrix

| Export Version | Format | Browser Client | Status |
|----------------|--------|----------------|--------|
| v2.0+ (current) | int8 (this spec) | v2.0+ | ✅ Supported |
| v1.x (legacy) | float16 | v1.x | ❌ Deprecated |
| v1.x (legacy) | float16 | v2.0+ | ❌ Rejected with error |

### Backward Compatibility

**None**. Browser client v2.0+ explicitly rejects old float16 format and instructs users to re-export using `export_for_browser.py`.

### Migration Path

If old format detected:
1. Display error message with migration instructions
2. Point user to `export_for_browser.py` script
3. Provide link to documentation

## Performance Characteristics

### Size Comparison

| Format | Size per Card | Total Size (50k cards) | Reduction |
|--------|---------------|------------------------|-----------|
| float32 | 2048 bytes | ~100 MB | Baseline |
| float16 | 1024 bytes | ~50 MB | 50% |
| **int8** | **512 bytes** | **~25 MB** | **75%** |

### Load Time

- **Network**: ~1-2 seconds on typical broadband (25 MB)
- **Parse**: Instant (direct TypedArray view)
- **Dequantize**: ~50-100ms (50k cards × 512 dims)

### Memory Usage

- **Compressed (int8)**: ~25 MB
- **Decompressed (float32)**: ~100 MB
- **Total**: ~125 MB (both in memory during dequantization)

## Error Handling

### Common Errors

1. **File Not Found**
   ```
   Error: Failed to load embeddings: 404 Not Found
   → Check that embeddings.i8bin exists in public/index_out/
   ```

2. **Size Mismatch**
   ```
   Error: Embedding file size mismatch: expected 25600000 bytes, got 12800000 bytes
   → Re-export embeddings using export_for_browser.py
   ```

3. **Invalid Data Range**
   ```
   Error: Invalid int8 value at index 42: 200
   → File may be corrupted or not in int8 format
   ```

4. **L2 Norm Out of Range**
   ```
   Error: L2 norm out of expected range: 0.85
   → Check that source embeddings were L2-normalized before quantization
   ```

## References

- Python Export Script: `packages/mtg-image-db/export_for_browser.py`
- Metadata Specification: `contracts/metadata-schema.json`
- Package Specification: `packages/mtg-image-db/SPEC.md` (sections 6.2.1-6.2.2)
- Web Client Specification: `apps/web/SPEC.md` (section 5)

## Changelog

### Version 1.0 (2025-10-16)
- Initial specification
- int8 quantization with scale factor 127
- Row-major layout
- L2 normalization invariants
- Validation rules and error handling

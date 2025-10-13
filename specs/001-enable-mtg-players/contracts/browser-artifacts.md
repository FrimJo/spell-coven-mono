# Browser Artifacts Data Contract

**Version**: 1.0
**Last Updated**: 2025-10-13
**Source**: Exported by `packages/mtg-image-db/export_for_browser.py`
**Consumer**: `apps/web/src/lib/search.ts`

## Overview

Browser artifacts enable fully client-side card identification without backend dependencies. The pipeline exports two files optimized for browser consumption:

1. **`embeddings.i8bin`**: Quantized card embeddings (int8 format, 75% smaller than float32)
2. **`meta.json`**: Card metadata with quantization parameters and version info

## File: `embeddings.i8bin`

### Binary Format Specification

**Encoding**: Signed int8 (range: -127 to 127)
**Byte Order**: Native (little-endian on x86/ARM)
**Layout**: Row-major, shape `[N, 512]` where N = number of cards
**Total Size**: Exactly `N * 512` bytes

### Quantization Scheme

**Formula**: `int8_value = clip(float32_value * 127, -127, 127)`

**Dequantization**: `float32_value = int8_value / 127.0`

**Range Mapping**:
- float32 range: `[-1.0, 1.0]`
- int8 range: `[-127, 127]`

### Invariants

1. **Pre-quantization Normalization**: Source embeddings in `mtg_embeddings.npy` MUST be L2-normalized before quantization
2. **Post-dequantization Norm**: After dequantization, vectors will have `||v|| ≈ 1.0` (within quantization error ±0.008)
3. **No Re-normalization**: Browser MUST NOT re-normalize after dequantization
4. **Cosine Similarity**: Cosine similarity = dot product (valid for normalized vectors)

### Validation Rules

**File Size Check**:
```typescript
const expectedSize = shape[0] * shape[1]; // N * 512
if (binaryData.byteLength !== expectedSize) {
  throw new Error(`Embedding file size mismatch: expected ${expectedSize}, got ${binaryData.byteLength}`);
}
```

**Data Type Check**:
```typescript
const embeddings = new Int8Array(binaryData);
// Verify range: all values should be in [-127, 127]
```

### Example Usage

```typescript
// Load binary file
const response = await fetch('index_out/embeddings.i8bin');
const arrayBuffer = await response.arrayBuffer();
const int8Data = new Int8Array(arrayBuffer);

// Dequantize to float32
const float32Data = new Float32Array(int8Data.length);
for (let i = 0; i < int8Data.length; i++) {
  float32Data[i] = int8Data[i] / 127.0;
}

// Reshape to [N, 512] conceptually (stored flat)
const N = float32Data.length / 512;
```

## File: `meta.json`

### JSON Schema

```json
{
  "type": "object",
  "required": ["version", "quantization", "shape", "records"],
  "properties": {
    "version": {
      "type": "string",
      "const": "1.0",
      "description": "Format version for compatibility tracking"
    },
    "quantization": {
      "type": "object",
      "required": ["dtype", "scale_factor", "original_dtype", "note"],
      "properties": {
        "dtype": {
          "type": "string",
          "enum": ["int8"],
          "description": "Quantized data type"
        },
        "scale_factor": {
          "type": "number",
          "const": 127,
          "description": "Multiplier used for quantization"
        },
        "original_dtype": {
          "type": "string",
          "const": "float32",
          "description": "Original data type before quantization"
        },
        "note": {
          "type": "string",
          "description": "Human-readable quantization explanation"
        }
      }
    },
    "shape": {
      "type": "array",
      "items": {"type": "integer"},
      "minItems": 2,
      "maxItems": 2,
      "description": "[N, D] where N=number of cards, D=512"
    },
    "records": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "set", "image_url", "card_url"],
        "properties": {
          "name": {"type": "string", "description": "Card name"},
          "set": {"type": "string", "description": "Set code (e.g., 'MH2')"},
          "scryfall_id": {"type": "string", "description": "Scryfall UUID"},
          "face_id": {"type": "string", "description": "Face identifier for multi-face cards"},
          "collector_number": {"type": "string", "description": "Collector number"},
          "frame": {"type": "string", "description": "Frame style"},
          "layout": {"type": "string", "description": "Card layout type"},
          "lang": {"type": "string", "description": "Language code"},
          "colors": {"type": "array", "items": {"type": "string"}, "description": "Color identity"},
          "image_url": {"type": "string", "description": "URL for card image (REQUIRED for display)"},
          "card_url": {"type": "string", "description": "URL for card display (REQUIRED for display)"},
          "scryfall_uri": {"type": "string", "description": "Link to Scryfall page (OPTIONAL but recommended)"}
        }
      },
      "description": "Array of length N, same order as embeddings"
    }
  }
}
```

### Required Fields

**REQUIRED for browser functionality**:
- `name`: Card name for display
- `set`: Set code for display
- `image_url`: URL for card image thumbnail
- `card_url`: URL for full card display

**OPTIONAL but recommended**:
- `scryfall_uri`: Link to Scryfall page for additional info
- All other fields: Useful for filtering, sorting, advanced features

### Validation Rules

**Version Check**:
```typescript
if (meta.version !== "1.0") {
  throw new Error(`Unsupported meta.json version: ${meta.version}`);
}
```

**Quantization Check**:
```typescript
if (meta.quantization.dtype !== "int8") {
  throw new Error(`Unsupported quantization dtype: ${meta.quantization.dtype}`);
}
if (meta.quantization.scale_factor !== 127) {
  throw new Error(`Unexpected scale factor: ${meta.quantization.scale_factor}`);
}
```

**Shape Validation**:
```typescript
const [N, D] = meta.shape;
if (D !== 512) {
  throw new Error(`Expected embedding dimension 512, got ${D}`);
}
```

**Record Count Validation**:
```typescript
if (meta.records.length !== meta.shape[0]) {
  throw new Error(`Metadata count mismatch: expected ${meta.shape[0]}, got ${meta.records.length}`);
}
```

**Required Field Validation**:
```typescript
for (const record of meta.records) {
  if (!record.name || !record.set || !record.image_url || !record.card_url) {
    throw new Error(`Missing required fields in record: ${JSON.stringify(record)}`);
  }
}
```

### Example Structure

```json
{
  "version": "1.0",
  "quantization": {
    "dtype": "int8",
    "scale_factor": 127,
    "original_dtype": "float32",
    "note": "Embeddings quantized from float32 to int8 by multiplying by 127 and clipping to [-127, 127]"
  },
  "shape": [50000, 512],
  "records": [
    {
      "name": "Lightning Bolt",
      "set": "LEA",
      "scryfall_id": "abc123...",
      "face_id": "0",
      "collector_number": "161",
      "frame": "1993",
      "layout": "normal",
      "lang": "en",
      "colors": ["R"],
      "image_url": "https://cards.scryfall.io/normal/front/...",
      "card_url": "https://cards.scryfall.io/large/front/...",
      "scryfall_uri": "https://scryfall.com/card/lea/161/lightning-bolt"
    }
    // ... 49,999 more records
  ]
}
```

## Error Handling Contract

### Error Messages

All validation errors MUST include:
1. Clear description of what failed
2. Expected vs actual values (where applicable)
3. Migration instructions for version mismatches

### Error Types

**Size Mismatch**:
```
Error: Embedding file size mismatch: expected 25600000 bytes (50000 * 512), got 25599999 bytes
```

**Count Mismatch**:
```
Error: Metadata count mismatch: expected 50000 records, got 49999
```

**Unsupported Format**:
```
Error: Unsupported quantization dtype: float16. Please re-export using export_for_browser.py with int8 quantization.
```

**Version Mismatch**:
```
Error: Unsupported meta.json version: 0.9. This browser client requires version 1.0. Please re-export the card database using the latest export_for_browser.py script.
```

**Missing Required Field**:
```
Error: Missing required field 'image_url' in card record: {"name": "Lightning Bolt", "set": "LEA", ...}
```

## Compatibility Matrix

| Export Version | meta.json Format | Browser Client | Status |
|----------------|------------------|----------------|--------|
| v2.0+ (current) | v1.0 (int8 object) | v2.0+ | ✅ Supported |
| v1.x (legacy) | v0.x (float16 array) | v1.x | ❌ Deprecated |
| v1.x (legacy) | v0.x (float16 array) | v2.0+ | ❌ Rejected with error |

**Backward Compatibility**: None. Browser client v2.0+ explicitly rejects old float16 format and instructs users to re-export.

## Migration Guide

### From v0.x (float16) to v1.0 (int8)

If you encounter version errors:

1. Navigate to `packages/mtg-image-db/`
2. Run: `python export_for_browser.py`
3. Verify new files exist:
   - `index_out/embeddings.i8bin` (int8 format)
   - `index_out/meta.json` (version 1.0)
4. Reload browser application

**Benefits of migration**:
- 75% smaller download size
- Faster initial load
- Improved browser memory efficiency
- Better mobile device support

## Performance Characteristics

**File Sizes** (for 50,000 cards):
- `embeddings.i8bin`: ~25 MB (50,000 * 512 bytes)
- `meta.json`: ~5 MB (depends on metadata richness)
- **Total**: ~30 MB (vs ~100 MB for float32)

**Load Times** (typical broadband):
- Initial download: 5-10 seconds
- Dequantization: <1 second
- Validation: <100ms
- **Total**: <15 seconds

**Memory Usage**:
- int8 storage: 25 MB
- float32 after dequantization: 100 MB
- Metadata: 5 MB
- **Total**: ~130 MB

## References

- Source specification: `packages/mtg-image-db/SPEC.md` sections 6.2.1-6.2.2
- Export script: `packages/mtg-image-db/export_for_browser.py`
- Browser loader: `apps/web/src/lib/search.ts`

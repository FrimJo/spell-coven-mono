# Data Model: MTG Image Database and Frontend Integration

**Feature**: 010-ensure-mtg-image  
**Date**: 2025-10-16  
**Phase**: 1 (Design & Contracts)

## Overview

This document defines the data entities, their relationships, validation rules, and state transitions for the SlimSAM card detection and CLIP embedding integration feature.

## Core Entities

### 1. EmbeddingDatabase

**Description**: Binary file containing quantized card embeddings with accompanying metadata

**Fields**:
- `binaryData`: Int8Array - Quantized embeddings in row-major layout
- `metadata`: MetadataFile - Associated metadata with quantization parameters
- `shape`: [number, number] - [N cards, 512 dimensions]
- `isLoaded`: boolean - Loading state
- `isValidated`: boolean - Contract validation state

**Validation Rules**:
- `binaryData.length` MUST equal `shape[0] * shape[1]`
- `metadata.version` MUST equal `"1.0"`
- `metadata.records.length` MUST equal `shape[0]`
- `metadata.quantization.dtype` MUST equal `"int8"`
- `metadata.quantization.scale_factor` MUST equal `127`
- `shape[1]` MUST equal `512` (CLIP embedding dimension)

**State Transitions**:
```
unloaded → loading → loaded → validated
                   ↓
                 error (with specific error message)
```

**Relationships**:
- Contains N `CardRecord` entries (one per card)
- Consumed by `SimilaritySearch` for query matching

---

### 2. MetadataFile

**Description**: JSON file containing quantization parameters and per-card metadata

**Fields**:
- `version`: string - Format version (currently "1.0")
- `quantization`: QuantizationParams - Quantization configuration
- `shape`: [number, number] - Embedding array dimensions
- `records`: CardRecord[] - Per-card metadata array

**Validation Rules**:
- `version` MUST be present and equal `"1.0"`
- `quantization` MUST contain all required fields
- `shape` MUST be 2-element array with positive integers
- `records` MUST be non-empty array
- All `CardRecord` entries MUST have required fields

**JSON Schema**: See `contracts/metadata-schema.json`

---

### 3. QuantizationParams

**Description**: Parameters for int8 quantization and dequantization

**Fields**:
- `dtype`: "int8" - Quantization data type
- `scale_factor`: 127 - Scale factor for dequantization
- `original_dtype`: "float32" - Original data type before quantization
- `note`: string - Human-readable description

**Validation Rules**:
- `dtype` MUST equal `"int8"`
- `scale_factor` MUST equal `127`
- `original_dtype` MUST equal `"float32"`

**Dequantization Formula**:
```
float32_value = int8_value / scale_factor
```

---

### 4. CardRecord

**Description**: Metadata for a single MTG card

**Fields** (Required):
- `name`: string - Card name
- `set`: string - Set code
- `image_url`: string - URL to card image
- `card_url`: string - URL to card display page

**Fields** (Optional):
- `scryfall_id`: string - Scryfall unique identifier
- `face_id`: string - Face identifier for multi-face cards
- `collector_number`: string - Collector number
- `frame`: string - Frame type
- `layout`: string - Card layout
- `lang`: string - Language code
- `colors`: string[] - Color identity
- `scryfall_uri`: string - Link to Scryfall page

**Validation Rules**:
- `name` MUST be non-empty string
- `set` MUST be non-empty string
- `image_url` MUST be valid URL
- `card_url` MUST be valid URL

**Relationships**:
- One-to-one with embedding vector at same index in `EmbeddingDatabase`
- Returned in `SearchResult` after similarity matching

---

### 5. DetectorConfig

**Description**: Configuration for card detector initialization

**Fields**:
- `modelId`: string - Model identifier (e.g., "Xenova/slimsam")
- `confidenceThreshold`: number - Minimum confidence for detections
- `detectionIntervalMs`: number - Detection interval in milliseconds
- `onProgress`: (message: string) => void - Progress callback
- `device`: "auto" | "webgpu" | "webgl" | "wasm" - Device preference
- `dtype`: "fp32" | "fp16" - Data type for model weights

**Validation Rules**:
- `modelId` MUST be non-empty string
- `confidenceThreshold` MUST be in range [0, 1]
- `detectionIntervalMs` MUST be positive integer
- `device` MUST be one of allowed values
- `dtype` MUST be one of allowed values

**Relationships**:
- Used by `SlimSAMDetector` during initialization
- Passed to Transformers.js pipeline

---

### 6. DetectionOutput

**Description**: Result of card detection operation

**Fields**:
- `cards`: DetectedCard[] - Filtered and validated card detections
- `inferenceTimeMs`: number - Time taken for detection
- `rawDetectionCount`: number - Number of detections before filtering

**Validation Rules**:
- `inferenceTimeMs` MUST be non-negative
- `rawDetectionCount` MUST be non-negative integer
- `cards.length` MUST be <= `rawDetectionCount`

**Relationships**:
- Returned by `CardDetector.detect()` method
- Contains `DetectedCard` polygons for UI overlay

---

### 7. DetectedCard

**Description**: Single detected card with polygon boundary

**Fields**:
- `polygon`: Point[] - Card boundary as array of points
- `confidence`: number - Detection confidence score
- `boundingBox`: BoundingBox - Axis-aligned bounding box

**Validation Rules**:
- `polygon` MUST have at least 4 points (quadrilateral)
- `confidence` MUST be in range [0, 1]
- `boundingBox` coordinates MUST be within canvas dimensions

**Relationships**:
- Produced by `SlimSAMDetector.detect()`
- Used for perspective correction before embedding

---

### 8. QueryEmbedding

**Description**: CLIP embedding vector for query image

**Fields**:
- `vector`: Float32Array - 512-dimensional embedding
- `isNormalized`: boolean - Whether vector is L2-normalized
- `norm`: number - L2 norm of vector

**Validation Rules**:
- `vector.length` MUST equal `512`
- If `isNormalized === true`, `norm` MUST be ≈ 1.0 (within ±0.008)
- All values MUST be finite numbers

**Relationships**:
- Produced by `CLIPEmbedder` from canvas
- Consumed by `SimilaritySearch` for matching

---

### 9. SearchResult

**Description**: Result of similarity search with top-1 match

**Fields**:
- `card`: CardRecord - Matched card metadata
- `score`: number - Cosine similarity score
- `inferenceTimeMs`: number - Time taken for search

**Validation Rules**:
- `score` MUST be in range [-1, 1] (cosine similarity range)
- `inferenceTimeMs` MUST be non-negative
- `card` MUST contain all required fields

**Relationships**:
- Returned by `SimilaritySearch.top1()` method
- Displayed in UI via `CardIdentificationResult` component

---

### 10. DetectorStatus

**Description**: Current state of detector initialization

**Values**:
- `"uninitialized"` - Detector not yet initialized
- `"loading"` - Model loading in progress
- `"ready"` - Detector ready for use
- `"error"` - Initialization failed

**State Transitions**:
```
uninitialized → loading → ready
                       ↓
                     error
```

**Relationships**:
- Returned by `CardDetector.getStatus()` method
- Used for UI loading states and error handling

---

## Data Flow

### End-to-End Card Identification Flow

```
1. User clicks on webcam frame
   ↓
2. SlimSAMDetector.detect(canvas, clickPoint)
   → DetectionOutput with DetectedCard polygon
   ↓
3. Perspective correction (warp to canonical rectangle)
   → Rectified canvas
   ↓
4. CLIPEmbedder.embed(canvas)
   → QueryEmbedding (512-dim vector)
   ↓
5. SimilaritySearch.top1(queryEmbedding, embeddingDatabase)
   → SearchResult with CardRecord and score
   ↓
6. Display result in UI
   → Show card name, set, thumbnail, Scryfall link
```

### Data Contract Validation Flow

```
1. Load embeddings.i8bin and meta.json
   ↓
2. ContractValidator.validate(binaryData, metadata)
   → Check file size, version, record count, dtype, scale factor
   ↓
3. If valid: Proceed to dequantization
   If invalid: Throw error with specific violation message
   ↓
4. Dequantize int8 → float32 using scale factor
   → EmbeddingDatabase ready for search
```

### Detector Lifecycle

```
1. Create detector instance with DetectorConfig
   ↓
2. detector.initialize()
   → Load model, status: loading → ready
   ↓
3. detector.detect(canvas, width, height)
   → Run inference, return DetectionOutput
   ↓
4. detector.dispose()
   → Clean up resources
```

## Validation Error Messages

All validation errors MUST include:
1. Clear description of what failed
2. Expected vs actual values
3. Remediation guidance

**Examples**:

```typescript
// File size mismatch
throw new Error(
  `Embedding file size mismatch: expected ${expected} bytes (${shape[0]} cards × ${shape[1]} dims), ` +
  `got ${actual} bytes. Re-export embeddings using export_for_browser.py`
)

// Version mismatch
throw new Error(
  `Unsupported metadata version: expected "1.0", got "${version}". ` +
  `Update to latest export format or use compatible browser client version.`
)

// Record count mismatch
throw new Error(
  `Metadata count mismatch: embeddings contain ${shape[0]} cards, ` +
  `but meta.json has ${records.length} records. Ensure export completed successfully.`
)

// Missing required field
throw new Error(
  `Missing required field in card record at index ${idx}: "${field}". ` +
  `Check export_for_browser.py output for completeness.`
)
```

## Performance Characteristics

| Entity | Size | Load Time | Memory |
|--------|------|-----------|--------|
| EmbeddingDatabase (50k cards) | ~25MB (int8) | ~1-2s | ~100MB (after dequantization) |
| MetadataFile (50k cards) | ~5-10MB (JSON) | ~0.5-1s | ~20-30MB (parsed) |
| SlimSAM Model | ~30-40MB | ~2-3s (first load) | ~100-150MB |
| CLIP Model | ~147MB (fp16) | ~5-10s (first load) | ~300-400MB |
| QueryEmbedding | 2KB (512 × 4 bytes) | N/A | 2KB |
| SearchResult | <1KB | N/A | <1KB |

**Total Memory Budget**: ~600-800MB for full system (models + data)

## Next Steps

1. Generate TypeScript interfaces in `contracts/detector-interface.ts`
2. Generate JSON schema in `contracts/metadata-schema.json`
3. Document binary format in `contracts/embedding-format.md`
4. Create quickstart guide in `quickstart.md`

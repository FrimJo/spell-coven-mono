# Research: MTG Image Database and Frontend Integration

**Feature**: 010-ensure-mtg-image  
**Date**: 2025-10-16  
**Phase**: 0 (Outline & Research)

## Overview

This document consolidates research findings for implementing SlimSAM-based card detection with CLIP embedding integration. All technical unknowns from the planning phase have been resolved through investigation of existing implementations, library documentation, and best practices.

## Research Tasks

### 1. SlimSAM Integration via Transformers.js

**Decision**: Use `Xenova/slimsam` model via `@xenova/transformers` with `image-segmentation` pipeline

**Rationale**:
- SlimSAM is a lightweight variant of Segment Anything Model optimized for browser use (~30-40MB)
- Transformers.js provides unified API consistent with existing CLIP integration
- Supports WebGPU/WebGL/WASM fallback chain automatically
- Point-prompt segmentation ideal for click-based card extraction
- Community-maintained Xenova models are well-tested and actively supported

**Alternatives Considered**:
- **SAM-Base** (`facebook/sam-vit-base`): Rejected due to large model size (~350MB) and slower inference
- **Custom ONNX export**: Rejected due to maintenance burden and lack of automatic backend selection
- **OpenCV-only approach**: Rejected as it doesn't provide semantic segmentation, only edge detection

**Implementation Pattern**:
```typescript
import { pipeline } from '@xenova/transformers'

// Initialize once at detector startup
const segmenter = await pipeline('image-segmentation', 'Xenova/slimsam', {
  dtype: 'fp16',
  device: 'webgpu' // auto-fallback to webgl/wasm
})

// On click event
const result = await segmenter(canvas, {
  points: [[clickX, clickY]],
  labels: [1] // 1 = foreground
})
```

**References**:
- Transformers.js image-segmentation docs
- CLICK_CARD_EXTRACTION_SPEC.md (lines 21-88)
- Existing detector implementations in `apps/web/src/lib/detectors/`

---

### 2. CardDetector Interface Conformance

**Decision**: Implement SlimSAM detector following existing `CardDetector` interface pattern from `types.ts`

**Rationale**:
- Maintains consistency with OpenCV, DETR, and OWL-ViT implementations
- Enables seamless detector switching via query parameter
- Provides standard lifecycle methods (initialize, detect, dispose, getStatus)
- Ensures proper progress tracking and error handling

**Interface Requirements**:
```typescript
export interface CardDetector {
  getStatus(): DetectorStatus
  initialize(): Promise<void>
  detect(canvas: HTMLCanvasElement, width: number, height: number): Promise<DetectionOutput>
  dispose(): void
}
```

**Implementation Strategy**:
1. Load SlimSAM model in `initialize()` with progress callbacks
2. In `detect()`: Run segmentation → extract largest component → refine corners → return polygon
3. Handle WebGPU unavailability gracefully with fallback
4. Dispose model resources in `dispose()`

**References**:
- `apps/web/src/lib/detectors/types.ts` (lines 54-93)
- `apps/web/src/lib/detectors/detr-detector.ts` (reference implementation)

---

### 3. Data Contract Validation Strategy

**Decision**: Implement validation module that checks all contract requirements before allowing data use

**Rationale**:
- Prevents silent failures from format mismatches
- Provides actionable error messages for debugging
- Enforces version compatibility explicitly
- Validates quantization parameters match expected values

**Validation Checks** (per FR-001 to FR-007):
1. File size validation: `embeddings.i8bin` size === `shape[0] * shape[1]` bytes
2. Version validation: `meta.json.version === "1.0"`
3. Required fields: `version`, `quantization`, `shape`, `records` present
4. Record count: `records.length === shape[0]`
5. Quantization dtype: `quantization.dtype === "int8"`
6. Scale factor: `quantization.scale_factor === 127`
7. Shape validation: `shape[1] === 512` (embedding dimension)

**Error Message Format**:
```typescript
throw new Error(`Embedding file size mismatch: expected ${expected} bytes, got ${actual} bytes. Re-export embeddings using export_for_browser.py`)
```

**References**:
- `packages/mtg-image-db/SPEC.md` (sections 6.2.1-6.2.2, lines 108-200)
- `apps/web/SPEC.md` (section 5, lines 58-65)

---

### 4. CLIP Embedding Integration

**Decision**: Use existing `Xenova/clip-vit-base-patch32` model with `image-feature-extraction` pipeline

**Rationale**:
- Same model used in Python export ensures embedding compatibility
- Already integrated in codebase (referenced in specs)
- Produces 512-dimensional L2-normalized vectors
- Supports same WebGPU/WebGL/WASM fallback as SlimSAM

**Integration Points**:
1. **Input**: Canvas from SlimSAM perspective-corrected crop
2. **Processing**: Pass canvas directly to CLIP pipeline (no intermediate file I/O per FR-009a)
3. **Output**: Float32Array(512) L2-normalized embedding
4. **Validation**: Verify L2 norm ≈ 1.0 (within ±0.008 quantization error per SC-007)

**Pipeline Usage**:
```typescript
const extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32')
const embedding = await extractor(canvas, { pooling: 'mean', normalize: true })
```

**References**:
- `apps/web/SPEC.md` (FR-010, line 36)
- `packages/mtg-image-db/SPEC.md` (section 3, lines 47-48)

---

### 5. Similarity Search Implementation

**Decision**: Implement simple dot product search over dequantized embeddings (no ANN index in browser)

**Rationale**:
- L2-normalized vectors: cosine similarity = dot product (no additional normalization needed per FR-007)
- Dataset size (~50k cards) manageable for brute-force search in browser
- Simple implementation reduces complexity and potential bugs
- Meets performance target (<3s end-to-end including segmentation and embedding)

**Algorithm**:
```typescript
// Dequantize: int8 → float32
const dbVectors = new Float32Array(int8Data.length)
for (let i = 0; i < int8Data.length; i++) {
  dbVectors[i] = int8Data[i] / 127.0
}

// Search: dot product (vectors already L2-normalized)
let maxScore = -Infinity
let bestIdx = -1
for (let i = 0; i < numCards; i++) {
  let score = 0
  for (let j = 0; j < 512; j++) {
    score += queryVec[j] * dbVectors[i * 512 + j]
  }
  if (score > maxScore) {
    maxScore = score
    bestIdx = i
  }
}
```

**Optimization Opportunities** (future):
- SIMD operations via WebAssembly
- Web Workers for parallel search
- Incremental loading for very large datasets

**References**:
- `apps/web/SPEC.md` (FR-QE, FR-SS, lines 38-43)
- `packages/mtg-image-db/SPEC.md` (section 6.2.1, lines 108-122)

---

### 6. Error Handling and Logging

**Decision**: Structured console logging with error type, context, and timestamp per FR-018

**Rationale**:
- Provides debugging information without external dependencies
- Follows standard web application practices
- Enables developer troubleshooting in production
- Non-blocking for users (errors logged but don't halt execution)

**Log Format**:
```typescript
interface ErrorLog {
  timestamp: string // ISO 8601
  type: 'validation' | 'detection' | 'embedding' | 'search'
  context: string // e.g., "SlimSAM segmentation", "metadata loading"
  error: string // error message
  details?: Record<string, unknown> // additional context
}

console.error('[CardIdentification]', JSON.stringify(errorLog))
```

**User-Facing Errors** (per FR-016):
- Non-blocking toast notification
- Retry guidance ("Try clicking closer to the card center")
- No dismissal required (auto-fade after 3-5 seconds)

**References**:
- Clarification Q5 (session 2025-10-16)
- FR-016, FR-018 in spec.md

---

### 7. Performance Optimization Strategy

**Decision**: Target performance through model selection and data format, not architectural complexity

**Rationale**:
- SlimSAM chosen for speed (<500ms target per SC-003a)
- int8 quantization reduces download and memory footprint
- Simple dot product search sufficient for dataset size
- WebGPU acceleration when available

**Performance Budget**:
- SlimSAM segmentation: <500ms (SC-003a)
- CLIP embedding: ~1-1.5s (typical for ViT-B/32)
- Similarity search: ~0.5s (50k dot products)
- Total: <3s end-to-end (SC-003)

**Monitoring**:
- Log inference times for each stage
- Track WebGPU vs WebGL vs WASM usage
- Monitor memory usage during search

**References**:
- Constitution VI: Performance Through Optimization
- Technical Context performance goals in plan.md

---

### 8. Default Detector Configuration

**Decision**: Set `'slimsam'` as default detector in `game.$gameId.tsx`, update `DetectorType` enum

**Rationale**:
- SlimSAM provides better semantic segmentation than OpenCV edge detection
- Maintains backward compatibility (users can still select other detectors)
- Aligns with feature goal of improving card extraction quality

**Implementation**:
```typescript
// types.ts
export type DetectorType = 'opencv' | 'detr' | 'owl-vit' | 'slimsam'

// game.$gameId.tsx
const defaultValues = {
  detector: 'slimsam' as const, // changed from 'detr'
}

const gameSearchSchema = z.object({
  detector: z.enum(['opencv', 'detr', 'owl-vit', 'slimsam']).default(defaultValues.detector),
})
```

**References**:
- FR-015, FR-016 in spec.md
- `apps/web/src/routes/game.$gameId.tsx` (lines 10-16)
- `apps/web/src/lib/detectors/types.ts` (line 98)

---

## Summary of Decisions

| Area | Decision | Key Rationale |
|------|----------|---------------|
| Segmentation Model | `Xenova/slimsam` via Transformers.js | Lightweight (~30MB), browser-optimized, point-prompt support |
| Interface Pattern | Implement `CardDetector` interface | Consistency with existing detectors, seamless switching |
| Data Validation | Explicit contract validation module | Prevent silent failures, actionable error messages |
| Embedding Model | `Xenova/clip-vit-base-patch32` | Same as Python export, ensures compatibility |
| Similarity Search | Simple dot product (no ANN) | Dataset size manageable, meets performance targets |
| Error Handling | Structured console logging | Standard practice, enables debugging without complexity |
| Performance | Model selection + data format | Aligns with Constitution VI (optimization over complexity) |
| Default Detector | SlimSAM | Better semantic segmentation, backward compatible |

## Next Steps (Phase 1)

1. Generate `data-model.md` with entity definitions
2. Create contracts in `contracts/` directory:
   - `detector-interface.ts` (CardDetector TypeScript interface)
   - `embedding-format.md` (Binary format specification)
   - `metadata-schema.json` (JSON schema for meta.json)
3. Generate `quickstart.md` with setup instructions
4. Update agent context with new technologies

All research complete. No blocking unknowns remain.

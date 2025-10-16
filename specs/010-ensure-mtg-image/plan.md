# Implementation Plan: MTG Image Database and Frontend Integration

**Branch**: `010-ensure-mtg-image` | **Date**: 2025-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-ensure-mtg-image/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Ensure seamless integration between the mtg-image-db package and web frontend by implementing a new SlimSAM-based card detector that works alongside existing detectors (OpenCV, DETR, OWL-ViT). The implementation validates data contracts between Python export and browser consumption, integrates SlimSAM segmentation with CLIP embedding for end-to-end card identification, and ensures embedding format compatibility across environments. SlimSAM will be set as the default detector while maintaining backward compatibility with existing detector options.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Python 3.11+ (mtg-image-db pipeline)  
**Primary Dependencies**: 
- Frontend: React, Transformers.js (`@xenova/transformers`), Tanstack Router, OpenCV.js
- Models: `Xenova/slimsam` (segmentation), `Xenova/clip-vit-base-patch32` (embedding)
- Python: CLIP (ViT-B/32), FAISS, NumPy

**Storage**: 
- Browser: IndexedDB (model caching), static files (embeddings.i8bin, meta.json)
- Python: Local filesystem (image_cache/, index_out/)

**Testing**: Playwright (E2E with mocked webcam stream at `apps/web/tests/assets/card_demo.webm`)  
**Target Platform**: Modern browsers (Chrome/Firefox/Safari) with WebGPU/WebGL/WASM support  
**Project Type**: Web (monorepo with separate Python package and React app)  
**Performance Goals**: 
- SlimSAM segmentation: <500ms from click to extracted canvas
- End-to-end identification: <3 seconds from click to result display
- Embedding similarity: >0.99 cosine similarity between Python and browser
- Top-1 accuracy: >80% under varied conditions

**Constraints**: 
- Browser-first: All core functionality client-side (no backend for card identification)
- Offline-capable: Works after initial asset download
- Model size: Optimized for browser delivery (int8 quantization, 75% size reduction)
- Memory: Efficient handling of 50k+ card embeddings in browser

**Scale/Scope**: 
- Dataset: 50k+ MTG card images
- Embedding dimension: 512-dimensional vectors
- Detector options: 4 implementations (OpenCV, SlimSAM, DETR, OWL-ViT)
- Integration points: Python export → Browser consumption, SlimSAM → CLIP pipeline

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Browser-First Architecture ✅ PASS
- **Core functionality client-side**: SlimSAM and CLIP run entirely in browser via Transformers.js
- **WebGPU/WebGL/WASM support**: Models use browser-native APIs with automatic fallback chain
- **Optimized delivery**: int8 quantization reduces embedding size by 75%
- **No backend dependencies**: Card identification works offline after initial asset load

### II. Data Contract Discipline ✅ PASS
- **Versioned contracts**: `meta.json` includes `"version": "1.0"` field
- **Binary format specification**: int8 layout, byte order, quantization documented (FR-001 through FR-007)
- **Validation rules**: File size, record count, dtype validation with clear error messages (FR-004)
- **Compatibility matrix**: Explicit rejection of old formats with migration guidance

### III. User-Centric Prioritization ✅ PASS
- **User priorities**: Accuracy (>80% top-1), performance (<3s end-to-end, <500ms segmentation), resource efficiency (int8 quantization)
- **Independent user stories**: P1 (data contracts), P2 (end-to-end flow), P3 (embedding compatibility)
- **Measurable acceptance criteria**: 8 success criteria with specific thresholds (SC-001 through SC-008)
- **User-perceived metrics**: Response time, accuracy, graceful degradation

### IV. Specification-Driven Development ✅ PASS
- **Complete spec.md**: User scenarios, 18 functional requirements, 8 success criteria
- **Technology-agnostic**: Describes WHAT (validate contracts, segment cards, compute similarity) not HOW
- **Data contracts documented**: Binary format, JSON schema, quantization parameters, error handling
- **Testable criteria**: All success criteria measurable (percentages, latencies, boolean checks)

### V. Monorepo Package Isolation ✅ PASS
- **Clear boundaries**: `packages/mtg-image-db` (Python) exports artifacts, `apps/web` (TypeScript) consumes them
- **Independent versioning**: Each package has own SPEC.md with version tracking
- **No shared state**: Data flows via exported files (embeddings.i8bin, meta.json)
- **Explicit dependencies**: `@xenova/transformers` for models, no cross-package imports

### VI. Performance Through Optimization ✅ PASS
- **Simple, optimized**: Dot product on L2-normalized vectors (no complex ANN in browser)
- **Proven algorithms**: CLIP embeddings, SlimSAM segmentation, int8 quantization
- **Measured targets**: <500ms segmentation, <3s end-to-end, >0.99 embedding similarity
- **Data format optimization**: int8 for browser (75% smaller), FAISS for Python

### VII. Open Source and Community-Driven ✅ PASS
- **Extensible architecture**: CardDetector interface allows pluggable implementations
- **Self-hosting support**: No cloud dependencies for core functionality
- **Migration guidance**: Clear error messages for version mismatches
- **Documentation**: Comprehensive specs, data contracts, acceptance criteria

**Overall Status**: ✅ **ALL GATES PASS** - No constitution violations. Feature aligns with all core principles.

## Project Structure

### Documentation (this feature)

```
specs/010-ensure-mtg-image/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── detector-interface.ts    # CardDetector interface contract
│   ├── embedding-format.md      # Binary format specification
│   └── metadata-schema.json     # JSON schema for meta.json
├── checklists/
│   └── requirements.md  # Specification quality checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
apps/web/
├── src/
│   ├── lib/
│   │   ├── detectors/
│   │   │   ├── types.ts                    # CardDetector interface (existing)
│   │   │   ├── opencv-detector.ts          # Existing OpenCV implementation
│   │   │   ├── detr-detector.ts            # Existing DETR implementation
│   │   │   ├── owl-vit-detector.ts         # Existing OWL-ViT implementation
│   │   │   └── slimsam-detector.ts         # NEW: SlimSAM implementation
│   │   ├── search/
│   │   │   ├── embeddings-loader.ts        # Load and validate embeddings.i8bin
│   │   │   ├── metadata-loader.ts          # Load and validate meta.json
│   │   │   ├── clip-embedder.ts            # CLIP embedding via Transformers.js
│   │   │   └── similarity-search.ts        # Dot product similarity computation
│   │   └── validation/
│   │       └── contract-validator.ts       # Data contract validation (FR-001 to FR-007)
│   ├── routes/
│   │   └── game.$gameId.tsx                # UPDATE: Default detector to 'slimsam'
│   └── components/
│       └── CardIdentificationResult.tsx     # NEW: Display top-1 result with error handling
├── tests/
│   ├── e2e/
│   │   └── card-identification.spec.ts     # E2E test using mocked webcam
│   └── assets/
│       └── card_demo.webm                  # Mocked webcam stream (existing)
└── public/
    └── index_out/
        ├── embeddings.i8bin                # Exported from mtg-image-db
        └── meta.json                       # Exported from mtg-image-db

packages/mtg-image-db/
├── export_for_browser.py                   # Existing export script
├── index_out/                              # Export artifacts
│   ├── embeddings.i8bin
│   ├── meta.json
│   ├── mtg_embeddings.npy                  # Python artifacts
│   ├── mtg_cards.faiss
│   └── mtg_meta.jsonl
└── SPEC.md                                 # Existing package specification
```

**Structure Decision**: Monorepo web application structure. Frontend (`apps/web`) consumes artifacts exported by Python package (`packages/mtg-image-db`). New SlimSAM detector added alongside existing detectors using the established `CardDetector` interface pattern. Data validation and search logic organized into separate modules for clarity and testability.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - All constitution gates pass. No complexity justification required.

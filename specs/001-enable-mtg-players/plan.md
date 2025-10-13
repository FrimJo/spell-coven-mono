# Implementation Plan: Card Recognition via Webcam

**Branch**: `001-enable-mtg-players` | **Date**: 2025-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-enable-mtg-players/spec.md`

## Summary

Enable MTG players to identify physical cards via webcam using AI-powered visual search, running entirely in the browser for privacy and offline use. The system uses CLIP embeddings for visual similarity search, OpenCV.js for card detection and perspective correction, and Transformers.js for browser-based AI inference. All processing happens client-side with pre-computed card embeddings loaded from optimized binary formats.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Python 3.10+ (data pipeline)
**Primary Dependencies**: 
- Frontend: React 19, Vite, TanStack Router, Transformers.js, OpenCV.js, Tailwind CSS
- Pipeline: PyTorch, CLIP, FAISS, NumPy, Pillow, Scryfall API

**Storage**: 
- Browser: IndexedDB (model cache), Local Storage (preferences)
- Pipeline: File system (image cache, embeddings, FAISS index)

**Testing**: Vitest (frontend unit/integration), pytest (Python pipeline)

**Target Platform**: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)

**Project Type**: Web application (monorepo with frontend app + Python data pipeline package)

**Performance Goals**: 
- Card identification: <3 seconds (90th percentile)
- Initial load: <30 seconds on broadband
- Subsequent loads: <3 seconds (cached)
- Search latency: <1ms for 50k+ cards
- Card detection: 30+ FPS

**Constraints**: 
- Browser-first: No backend required for core functionality
- Offline-capable: Full functionality after initial load
- Privacy: No card data sent to external servers
- Download size: <200MB total (model + embeddings)
- Memory: <500MB browser memory usage

**Scale/Scope**: 
- 50,000+ card database (all MTG cards with unique artwork)
- Single-page application
- 2-4 player remote play sessions (future: multi-party video)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Browser-First Architecture
- **Status**: PASS
- **Evidence**: All card identification runs client-side using Transformers.js and pre-computed embeddings. No backend required.

### ✅ II. Data Contract Discipline
- **Status**: PASS
- **Evidence**: Explicit versioned contracts between Python pipeline and browser (embeddings.i8bin v1.0, meta.json with JSON Schema). See existing `packages/mtg-image-db/SPEC.md` sections 6.2.1-6.2.2.

### ✅ III. User-Centric Prioritization
- **Status**: PASS
- **Evidence**: Feature prioritizes accuracy (PNG images, 384px resolution), query speed (HNSW index, int8 quantization), and download size (75% reduction via quantization) over build time.

### ✅ IV. Specification-Driven Development
- **Status**: PASS
- **Evidence**: Feature has complete spec.md with user stories, acceptance criteria, and success metrics. Technical details being migrated to plan.md.

### ✅ V. Monorepo Package Isolation
- **Status**: PASS
- **Evidence**: Clear separation between `apps/web` (browser client) and `packages/mtg-image-db` (Python pipeline). Data flows via exported artifacts.

### ✅ VI. Performance Through Optimization, Not Complexity
- **Status**: PASS
- **Evidence**: Simple dot product search over quantized embeddings achieves <1ms latency. HNSW provides 10-100x speedup without distributed systems.

### ✅ VII. Open Source and Community-Driven
- **Status**: PASS
- **Evidence**: Open source project with self-hosting capability and extensible architecture.

**Overall**: ✅ All constitution principles satisfied. No complexity justification required.

## Project Structure

### Documentation (this feature)

```
specs/001-enable-mtg-players/
├── spec.md              # User-focused specification (COMPLETE)
├── plan.md              # This file - technical approach
├── contracts/           # Data contracts (to be created)
│   ├── browser-artifacts.md
│   └── python-artifacts.md
├── data-model.md        # Entity relationships (to be created)
├── quickstart.md        # Developer onboarding (to be created)
├── checklists/
│   └── requirements.md  # Spec validation (COMPLETE)
└── tasks.md             # Implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```
apps/web/                           # Browser application
├── src/
│   ├── lib/
│   │   ├── search.ts              # CLIP embedding + similarity search
│   │   ├── webcam.ts              # Camera access + card detection
│   │   └── opencv-loader.ts       # OpenCV.js initialization
│   ├── components/
│   │   ├── WebcamView.tsx         # Camera feed + detection overlay
│   │   ├── CardResults.tsx        # Identification results display
│   │   └── LoadingProgress.tsx    # Model download progress
│   ├── routes/
│   │   └── index.tsx              # Main card recognition page
│   └── main.tsx
├── tests/
│   ├── integration/
│   │   └── card-recognition.test.ts
│   └── unit/
│       ├── search.test.ts
│       └── webcam.test.ts
├── public/
│   └── index_out/                 # Imported from @repo/mtg-image-db
│       ├── embeddings.i8bin       # Quantized embeddings
│       └── meta.json              # Card metadata + quantization info
├── SPEC.md                        # Technical specification (existing)
└── README.md

packages/mtg-image-db/             # Python data pipeline
├── scripts/
│   ├── download_images.py         # Step 1: Download from Scryfall
│   ├── build_embeddings.py        # Step 2: CLIP embedding + FAISS
│   ├── export_for_browser.py      # Export int8 + JSON for browser
│   └── query_index.py             # Python query tool
├── index_out/                     # Generated artifacts
│   ├── mtg_embeddings.npy         # Float32 embeddings (Python)
│   ├── mtg_cards.faiss            # HNSW index (Python)
│   ├── mtg_meta.jsonl             # Metadata (Python)
│   ├── embeddings.i8bin           # Quantized embeddings (Browser)
│   └── meta.json                  # Metadata + schema (Browser)
├── image_cache/                   # Downloaded card images
├── environment-cpu.yml            # Conda env (CPU)
├── environment-gpu.yml            # Conda env (CUDA)
├── environment-mps.yml            # Conda env (Apple Silicon)
├── SPEC.md                        # Technical specification (existing)
├── IMPROVEMENTS.md                # Priority roadmap (existing)
└── README.md

packages/eslint-config/            # Shared ESLint config
packages/typescript-config/        # Shared TypeScript config
packages/tailwind-config/          # Shared Tailwind config
packages/prettier-config/          # Shared Prettier config
```

**Structure Decision**: Web application structure with monorepo organization. Frontend (`apps/web`) and data pipeline (`packages/mtg-image-db`) are isolated packages with clear data contracts. Pipeline generates artifacts consumed by frontend via Vite asset imports.

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (apps/web)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Webcam     │  │   OpenCV.js  │  │ Transformers │     │
│  │   Stream     │─▶│   Detection  │─▶│     CLIP     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         │                  │                  ▼             │
│         │                  │          ┌──────────────┐     │
│         │                  │          │  Embedding   │     │
│         │                  │          │  (512-dim)   │     │
│         │                  │          └──────────────┘     │
│         │                  │                  │             │
│         │                  │                  ▼             │
│         │                  │          ┌──────────────┐     │
│         │                  │          │  Similarity  │     │
│         │                  │          │    Search    │     │
│         │                  │          │ (dot product)│     │
│         │                  │          └──────────────┘     │
│         │                  │                  │             │
│         │                  │                  ▼             │
│         │                  │          ┌──────────────┐     │
│         │                  └─────────▶│   Results    │     │
│         │                             │   Display    │     │
│         └────────────────────────────▶│              │     │
│                                        └──────────────┘     │
│                                                              │
│  Data Sources (loaded once, cached):                        │
│  • embeddings.i8bin (int8 quantized, ~25MB for 50k cards)  │
│  • meta.json (card metadata, ~5MB)                          │
│  • CLIP model (from Hugging Face CDN, ~150MB, cached)      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Python Pipeline (packages/mtg-image-db)         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Scryfall    │─▶│    Image     │─▶│     CLIP     │     │
│  │     API      │  │    Cache     │  │  Embedding   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                              │               │
│                                              ▼               │
│                                       ┌──────────────┐      │
│                                       │    FAISS     │      │
│                                       │     HNSW     │      │
│                                       │    Index     │      │
│                                       └──────────────┘      │
│                                              │               │
│                                              ▼               │
│                                       ┌──────────────┐      │
│                                       │   Export     │      │
│                                       │  (int8 +     │      │
│                                       │   JSON)      │      │
│                                       └──────────────┘      │
│                                              │               │
│                                              ▼               │
│                                    Browser Artifacts        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Pipeline Phase (Python - one-time setup)**:
   - Download card images from Scryfall API → `image_cache/`
   - Generate CLIP embeddings (512-dim float32) → `mtg_embeddings.npy`
   - Build FAISS HNSW index → `mtg_cards.faiss`
   - Export for browser: quantize to int8 → `embeddings.i8bin`, format metadata → `meta.json`

2. **Browser Load Phase (one-time per device)**:
   - Download CLIP model from Hugging Face CDN → IndexedDB cache (~150MB)
   - Load `embeddings.i8bin` + `meta.json` → Memory (~30MB total)
   - Dequantize int8 → float32 in-memory

3. **Runtime Phase (per card identification)**:
   - Webcam stream → OpenCV.js detects card boundaries
   - User clicks card → Perspective transform → Normalized canvas
   - Canvas → CLIP embedding (512-dim float32)
   - Dot product similarity search → Top-K results
   - Display card name, set, image, Scryfall link

### Technology Stack

**Frontend (apps/web)**:
- **Framework**: React 19 + TanStack Router
- **Build**: Vite + TypeScript
- **AI/ML**: Transformers.js (CLIP ViT-B/32)
- **Computer Vision**: OpenCV.js
- **Styling**: Tailwind CSS
- **State**: React hooks (no global state needed)

**Data Pipeline (packages/mtg-image-db)**:
- **Language**: Python 3.10+
- **ML**: PyTorch + CLIP (openai/CLIP)
- **Search**: FAISS (HNSW index, M=64, efConstruction=400)
- **Data**: NumPy, Pillow, requests
- **API**: Scryfall bulk data

**Monorepo**:
- **Manager**: pnpm workspaces + Turborepo
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode

## Data Contracts

### Browser Artifacts (from pipeline)

Detailed contracts exist in `packages/mtg-image-db/SPEC.md` sections 6.2.1-6.2.2. Summary:

**`embeddings.i8bin`**:
- Format: Signed int8, row-major, shape [N, 512]
- Quantization: float32 * 127 → int8 (range: -127 to 127)
- Size: N * 512 bytes (~25MB for 50k cards)
- Validation: File size MUST equal shape[0] * shape[1]

**`meta.json`**:
- Format: JSON object with version "1.0"
- Required fields: version, quantization, shape, records
- Quantization metadata: dtype="int8", scale_factor=127
- Records: Array of card metadata (name, set, image_url, card_url, etc.)
- Validation: records.length MUST equal shape[0]

**Error Handling**:
- Size mismatch → "Embedding file size mismatch"
- Count mismatch → "Metadata count mismatch"
- Wrong dtype → "Unsupported quantization dtype"
- Missing fields → Clear field name in error

### Python Artifacts (for local querying)

**`mtg_embeddings.npy`**:
- Format: NumPy array, float32, shape [N, 512]
- Normalization: L2-normalized (||v|| = 1.0)

**`mtg_cards.faiss`**:
- Format: FAISS IndexHNSWFlat
- Parameters: M=64, efConstruction=400
- Metric: Inner product (cosine similarity for normalized vectors)

**`mtg_meta.jsonl`**:
- Format: JSON Lines (one object per line)
- Fields: name, scryfall_id, face_id, set, collector_number, frame, layout, lang, colors, image_url, card_url, scryfall_uri

## Performance Optimizations

### Accuracy (User Priority #1)
- ✅ PNG image priority (better quality than JPG)
- ✅ 384px target resolution (vs 256px default)
- ✅ Perspective correction for angled cards
- ✅ CLIP ViT-B/32 model (proven accuracy)

### Query Speed (User Priority #2)
- ✅ HNSW index: 10-100x faster than brute force
- ✅ Simple dot product: <1ms for 50k cards
- ✅ Pre-computed embeddings (no runtime encoding of database)
- ✅ Browser-native operations (no WASM overhead for search)

### Download Size (User Priority #3)
- ✅ int8 quantization: 75% reduction (100MB → 25MB)
- ✅ Quantized CLIP model: 147MB vs 578MB
- ✅ CDN delivery with browser caching
- ✅ Incremental loading (model + embeddings separate)

## Complexity Tracking

*No violations - all constitution principles satisfied.*

## Migration Notes

### Existing Technical Specs → SpecKit Structure

**From `packages/mtg-image-db/SPEC.md`**:
- ✅ Section 1 (Summary) → Extracted user value to `spec.md` user stories
- ✅ Section 2 (Goals/Non-Goals) → Mapped to `spec.md` success criteria
- ✅ Section 3 (Functional Requirements) → Split between `spec.md` (user-facing) and `plan.md` (technical)
- ✅ Section 5 (Architecture) → Migrated to `plan.md` Architecture Overview
- ✅ Section 6 (Data Contracts) → Referenced in `plan.md`, will create `contracts/` directory
- ✅ Section 7 (Acceptance Criteria) → Split between `spec.md` (user scenarios) and technical validation

**From `apps/web/SPEC.md`**:
- ✅ Functional Requirements → Mapped to `spec.md` FR-001 through FR-015
- ✅ Data Contracts → Referenced in `plan.md`
- ✅ Acceptance Criteria → Mapped to `spec.md` acceptance scenarios

### Next Steps

1. Create `contracts/browser-artifacts.md` with full schema from SPEC.md section 6.2
2. Create `contracts/python-artifacts.md` with full schema from SPEC.md section 6.1
3. Create `data-model.md` with entity relationships
4. Create `quickstart.md` for developer onboarding
5. Run `/speckit.tasks` to generate implementation tasks
6. Consider deprecating old SPEC.md files in favor of SpecKit structure (or keep as technical reference)

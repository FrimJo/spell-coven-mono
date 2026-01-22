# Project Specification: MTG Card Visual Search

## Spec Version
- Version: v0.3.0
- Date: 2025-10-17

## Changelog
- v0.3.0
  - **BREAKING**: Standardized CLIP model on ViT-B/32@224px (512-dim) for browser alignment
  - Set image source to PNG (745×1040) for consistent card art fidelity
  - Changed preprocessing from center-crop to black padding to preserve full card information
  - Updated default image size from 384px to 224px to match model's native input
  - Updated all data contracts: embeddings shape [N, 768] → [N, 512]
  - Updated HNSW defaults: M=64, efConstruction=400 → M=32, efConstruction=200 (balanced defaults)
  - Browser artifacts now use 512-dim embeddings (~5MB for 100K cards)
  - **Migration required**: Old 768-dim indexes incompatible, must rebuild from scratch
- v0.2.1
  - Strengthened data contract specification with formal JSON schema for `meta.json`.
  - Added version field (`"version": "1.0"`) to `meta.json` for compatibility tracking.
  - Documented binary format details (byte order, layout, validation rules).
  - Specified embedding normalization invariants and error handling contract.
  - Added compatibility matrix showing version support.
  - Defined required vs optional metadata fields for browser dependencies.
- v0.2.0
  - Updated browser export format from float16 to int8 quantization for 75% size reduction.
  - Changed artifact filename: `embeddings.f16bin` → `embeddings.i8bin`.
  - Added quantization metadata to `meta.json` for browser-side dequantization.
  - Updated HNSW index implementation (M=64, efConstruction=400) for faster queries.
- v0.1.1
  - Split specification: package-level (pipelines, exports) remains here; browser client spec moved to `apps/web/SPEC.md`. This file now links to the web spec for browser-related requirements.
- v0.1.0
  - Introduced SPEC IDs across Functional Requirements and Acceptance Criteria.
  - Added Spec Version and Changelog sections. No functional behavior changes.

## 1. Summary
Build a Magic: The Gathering (MTG) visual search platform designed for online gameplay, where each player streams their board state via webcam (or similar). Users can click a card visible in any player's stream to identify it and retrieve detailed card information. To enable this, the system fetches MTG card images (PNG 745×1040), embeds full card images using CLIP (ViT-B/32@224px, 512-dim), and builds a searchable index that supports querying with a cropped image of the selected card. The index/database artifacts are shipped to the client so the entire search can run locally in the browser using Transformers.js; the match result is then used to fetch or display the full card details.

Technically, the system downloads and processes Scryfall bulk data, caches card images with black padding preprocessing, produces CLIP embeddings (512-dim, L2-normalized), and builds a FAISS index for fast similarity search. It supports two query paths: (1) local Python via FAISS, and (2) fully in-browser via Transformers.js using pre-exported embeddings.

## 2. Goals and Non-Goals
- Goals
  - Build reproducible pipelines for fetching data, embedding images, and saving indices/metadata.
  - Enable local FAISS-based search from Python.
  - Enable fully offline, backend-free browser search with pre-generated artifacts.
  - Provide ergonomic developer experience with simple CLI scripts and clear docs; a Makefile with common targets is provided for convenience.
- Non-Goals
  - Perfect OCR or real-time webcam recognition.
  - Multi-modal text+image search.
  - Cloud deployment or server-side ANN services.

## 3. Functional Requirements
- Data Acquisition [SPEC-FR-DA]
  - Fetch Scryfall bulk metadata for one of: `unique_artwork`, `default_cards`, `all_cards`. [SPEC-FR-DA-01]
  - Extract per-face image URLs (art and display URLs) robustly. [SPEC-FR-DA-02]
  - Cache images locally in `image_cache/`. [SPEC-FR-DA-03]
- Embedding & Indexing [SPEC-FR-EI]
  - Embed all available images using CLIP ViT-B/32@224px to 512-dim L2-normalized vectors. [SPEC-FR-EI-01]
  - Persist artifacts to `index_out/`: [SPEC-FR-EI-02]
    - `mtg_embeddings.npy` (float32, shape [N, 512]) [SPEC-FR-EI-02a]
    - `mtg_cards.faiss` (FAISS HNSW index with METRIC_INNER_PRODUCT over normalized vectors) [SPEC-FR-EI-02b]
    - `mtg_meta.jsonl` (per-vector JSON metadata lines) [SPEC-FR-EI-02c]
- Python Query [SPEC-FR-PY]
  - Load FAISS index and metadata. [SPEC-FR-PY-01]
  - Embed a given query image and return top-K results with names and URLs. [SPEC-FR-PY-02]
- Browser Query [SPEC-FR-BR]
  - Note: Canonical browser client requirements and acceptance criteria are defined in `apps/web/SPEC.md`. This section summarizes expected artifacts only.
  - Export artifacts for browser use: [SPEC-FR-BR-01]
    - `embeddings.i8bin` (int8 quantized binary, 75% smaller than float32) [SPEC-FR-BR-01a]
    - `meta.json` (JSON object with quantization metadata and records array) [SPEC-FR-BR-01b]
  - `index.html` uses modules in `lib/` to perform fully client-side search: [SPEC-FR-BR-02]
    - `lib/search.js` loads `index_out/meta.json` and `index_out/embeddings.i8bin`, dequantizes int8→float32 (divide by 127), initializes the CLIP vision pipeline via Transformers.js (`Xenova/clip-vit-base-patch32`) using the `image-feature-extraction` task, provides `loadEmbeddingsAndMeta()`, `loadModel()`, `embedFromCanvas()`, and computes cosine similarity (dot products on L2-normalized vectors) via `topK()` to return top-K matches. [SPEC-FR-BR-02a]
    - `lib/webcam.js` manages webcam devices, detects card-like quadrilateral contours on a live overlay using OpenCV.js, and performs a perspective-correct crop to a fixed-size canvas upon click. It awaits a global `window.cvReadyPromise` provided by the OpenCV loader. [SPEC-FR-BR-02b]
    - `lib/opencv-loader.js` is responsible for loading OpenCV.js and resolving `window.cvReadyPromise` when ready. [SPEC-FR-BR-02c]
    - `lib/main.js` orchestrates UI controls (start camera, camera selection, Search Cropped) and renders results including thumbnails and Scryfall links. [SPEC-FR-BR-02d]
  - Supported query sources in the browser: [SPEC-FR-BR-03]
    - Webcam crop: user starts webcam, clicks near a detected card polygon to crop; the cropped canvas is embedded and searched. [SPEC-FR-BR-03a]

## 4. Non-Functional Requirements
- Performance
  - Reasonable end-to-end build time for default mode on a modern laptop.
  - Browser search should complete under a few seconds for moderate dataset sizes.
- Portability
  - Python scripts run on macOS/Linux with CPU or GPU/MPS acceleration if available.
  - Browser demo runs on modern Chromium/Firefox/Safari.
- Reproducibility
  - Conda environment files (`environment-cpu.yml`, `environment-gpu.yml`, `environment-mps.yml`) are the single source of truth for dependency versions.
  - `requirements.txt` is informational only and points users to Conda envs.
  - Makefile tasks provide one-command flows.

## 5. Architecture Overview
- Offline (Python):
  - **Two-step process (recommended)**:
    - `download_images.py` → downloads/caches images from Scryfall.
    - `build_embeddings.py` → loads cached images → embeds via CLIP → saves FAISS + metadata.
  - **Single-step process (legacy)**: `build_mtg_faiss.py` → downloads/caches images → embeds via CLIP → saves FAISS + metadata.
  - `query_index.py` → embeds query image → FAISS nearest neighbors → prints results.
- Export for Browser:
  - `export_for_browser.py` → `.npy` → `.i8bin` (int8 quantized), `.jsonl` → `.json` (with quantization metadata).
- Browser:
  - `index.html` → loads `lib/search.js`, `lib/opencv-loader.js`, `lib/webcam.js`, `lib/main.js`:
    - `lib/search.js`: fetch `index_out/embeddings.i8bin` + `index_out/meta.json`, dequantize int8→float32 (divide by 127), initialize CLIP vision extractor via Transformers.js (`image-feature-extraction`), embed query from the cropped canvas, compute dot products for top-K. [SPEC-ARCH-BR-SEARCH]
    - `lib/opencv-loader.js`: load OpenCV.js and expose a readiness promise consumed by `webcam.js`. [SPEC-ARCH-BR-OPENCV]
    - `lib/webcam.js`: manage webcam devices, detect card-like contours on an overlay using OpenCV.js, allow click-to-crop, and perform perspective transform to a normalized canvas. [SPEC-ARCH-BR-WEBCAM]
    - `lib/main.js`: wire up UI controls: start camera, camera selection, “Search Cropped”, and render results with thumbnail (`card_url` or derived) and Scryfall link. [SPEC-ARCH-BR-MAIN]

## 6. Data Contracts

### 6.1 Python Artifacts (for FAISS querying)
- **`index_out/mtg_meta.jsonl`**: One JSON object per line with keys including:
  - `name`, `scryfall_id`, `face_id`, `set`, `collector_number`, `frame`, `layout`, `lang`, `colors`, `image_url`, `card_url`, `scryfall_uri`.
- **`index_out/mtg_embeddings.npy`**: NumPy array, float32, shape `[N, 512]`, L2-normalized (from ViT-B/32@224px).
- **`index_out/mtg_cards.faiss`**: FAISS HNSW index (default M=32, efConstruction=200) over `[N, 512]` vectors using METRIC_INNER_PRODUCT (cosine similarity for normalized vectors).

### 6.2 Browser Artifacts (exported by `export_for_browser.py`)

#### 6.2.1 `index_out/embeddings.i8bin`
**Binary Format**:
- **Encoding**: Signed int8 (range: -127 to 127)
- **Byte order**: Native (little-endian on x86/ARM)
- **Layout**: Row-major, shape `[N, 512]` (512-dim from ViT-B/32@224px)
- **Quantization**: Maps float32 range `[-1.0, 1.0]` to int8 range `[-127, 127]`
  - Formula: `int8_value = clip(float32_value * 127, -127, 127)`
- **Total size**: Exactly `N * 512` bytes
- **Validation**: File size MUST equal `shape[0] * shape[1]` bytes

**Invariants**:
- Source embeddings in `mtg_embeddings.npy` MUST be L2-normalized before quantization
- After dequantization (`float32_value = int8_value / 127.0`), vectors will have `||v|| ≈ 1.0` (within quantization error ±0.008)
- Browser MUST NOT re-normalize after dequantization
- Cosine similarity = dot product (valid for normalized vectors)

#### 6.2.2 `index_out/meta.json`
**JSON Schema**:
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
        "dtype": {"type": "string", "enum": ["int8"]},
        "scale_factor": {"type": "number", "const": 127},
        "original_dtype": {"type": "string", "const": "float32"},
        "note": {"type": "string"}
      }
    },
    "shape": {
      "type": "array",
      "items": {"type": "integer"},
      "minItems": 2,
      "maxItems": 2,
      "description": "[N, D] where N=number of cards, D=512 (ViT-B/32@224px)"
    },
    "records": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "set", "image_url", "card_url"],
        "properties": {
          "name": {"type": "string"},
          "set": {"type": "string"},
          "scryfall_id": {"type": "string"},
          "face_id": {"type": "string"},
          "collector_number": {"type": "string"},
          "frame": {"type": "string"},
          "layout": {"type": "string"},
          "lang": {"type": "string"},
          "colors": {"type": "array"},
          "image_url": {"type": "string"},
          "card_url": {"type": "string"},
          "scryfall_uri": {"type": "string"}
        }
      },
      "description": "Array of length N, same order as embeddings"
    }
  }
}
```

**Required Fields** (browser dependencies):
- `name`: Card name for display (REQUIRED)
- `set`: Set code for display (REQUIRED)
- `image_url`: URL for card image (REQUIRED for display)
- `card_url`: URL for card display (REQUIRED for display)
- `scryfall_uri`: Link to Scryfall page (OPTIONAL but recommended)

**Error Handling Contract**:
- `embeddings.i8bin` size ≠ `shape[0] * shape[1]`: Browser MUST throw with message "Embedding file size mismatch"
- `records.length` ≠ `shape[0]`: Browser MUST throw with message "Metadata count mismatch"
- `quantization.dtype` ≠ "int8": Browser MUST throw with message "Unsupported quantization dtype"
- Missing required fields: Browser MUST throw with clear field name
- Old format (array instead of object): Browser MUST throw with migration message

### 6.3 Compatibility Matrix
| Export Version | meta.json Format | Browser Client | Status |
|----------------|------------------|----------------|--------|
| v2.0+ (current) | v1.0 (int8 object) | v2.0+ | ✅ Supported |
| v1.x (legacy) | v0.x (float16 array) | v1.x | ❌ Deprecated |
| v1.x (legacy) | v0.x (float16 array) | v2.0+ | ❌ Rejected with error |

**Backward Compatibility**: None. Browser client v2.0+ explicitly rejects old float16 format and instructs users to re-export.

## 7. Acceptance Criteria
- Build [SPEC-AC-BUILD-01]
  - **Two-step process**: Running `python3 download_images.py` followed by `python3 build_embeddings.py` produces `index_out/mtg_embeddings.npy`, `index_out/mtg_cards.faiss`, `index_out/mtg_meta.jsonl` without errors. Alternatively, `make download && make embed` or `make build-all` performs the same. [SPEC-AC-BUILD-01.1]
  - **Single-step process**: Running `python3 build_mtg_faiss.py --kind unique_artwork --out index_out --cache image_cache` produces the same artifacts. Alternatively, `make build` performs the same. [SPEC-AC-BUILD-01.2]
- Export [SPEC-AC-EXP-01]
  - Running `python3 export_for_browser.py` produces `index_out/embeddings.i8bin` (int8 quantized) and `index_out/meta.json` (with quantization metadata and records) with matching counts. Alternatively, `make export` performs the same. [SPEC-AC-EXP-01.1]
- Python Query [SPEC-AC-PY-01]
  - Running `python3 query_index.py` prints top-K matches for a sample query image (edit `query_path` in `query_index.py`). Alternatively, `make query` performs the same. [SPEC-AC-PY-01.1]
- Browser Query [SPEC-AC-BR-01]
  - Serving the repository root with any static HTTP server (for example, `python3 -m http.server 8000` or `make serve`) and opening `index.html` supports: [SPEC-AC-BR-01.1]
    - Webcam crop: starting the webcam, clicking near a detected card polygon performs a perspective-correct crop; pressing “Search Cropped” embeds the canvas and displays top-K matches with thumbnail and link. [SPEC-AC-BR-01.1a]
  - All browser-side embedding and search occurs locally using pre-shipped artifacts (`embeddings.i8bin`, `meta.json`). [SPEC-AC-BR-01.2]

## 8. Webcam Crop & Click-to-Identify
- Purpose
  - Provide an integrated way to acquire a clean, perspective-correct crop of a physical MTG card using the on-device webcam. The cropped canvas serves as the query image for the browser search flow.
- Scope (What it does)
  - Use OpenCV.js to detect card-like quadrilateral contours on a live webcam overlay.
  - Allow the user to click on/near a detected card to select it.
  - Perform a perspective transform from the full-resolution frame to produce a rectified card image in a fixed-size canvas.
  - Enable a “Search Cropped” action that embeds the canvas with Transformers.js and searches locally against the preloaded embeddings.
- Out of Scope (Explicitly excluded)
  - OCR, rules text parsing, heuristic post-processing, or real-time, continuous recognition.
- Files
  - `lib/opencv-loader.js` (loads OpenCV.js and signals readiness), `lib/webcam.js` (detection + crop), `lib/search.js` (embedding + ANN), `lib/main.js` (UI orchestration).
- Rationale
  - Speeds up gameplay identification workflows by avoiding manual photo capture and yields consistent, aspect-correct query images for better search quality.


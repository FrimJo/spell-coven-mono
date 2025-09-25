# Project Specification: MTG Card Art Visual Search

## 1. Summary
Build a visual search system for Magic: The Gathering (MTG) cards. The system downloads Scryfall bulk data, caches card art, embeds images using CLIP (ViT-B/32), builds a FAISS index for fast similarity search, and provides two query paths: (1) local Python via FAISS, and (2) fully in-browser via Transformers.js using pre-exported embeddings.

## 2. Goals and Non-Goals
- Goals
  - Build reproducible pipelines for fetching data, embedding images, and saving indices/metadata.
  - Enable local FAISS-based search from Python.
  - Enable fully offline, backend-free browser search with pre-generated artifacts.
  - Provide ergonomic developer experience with Makefile tasks and clear docs.
- Non-Goals
  - Perfect OCR or real-time webcam recognition (an experimental prototype exists in `index_old.html`).
  - Multi-modal text+image search.
  - Cloud deployment or server-side ANN services.

## 3. Functional Requirements
- Data Acquisition
  - Fetch Scryfall bulk metadata for one of: `unique_artwork`, `default_cards`, `all_cards`.
  - Extract per-face image URLs (art and display URLs) robustly.
  - Cache images locally in `image_cache/`.
- Embedding & Indexing
  - Embed all available images using CLIP ViT-B/32 to 512-dim L2-normalized vectors.
  - Persist artifacts to `index_out/`:
    - `mtg_embeddings.npy` (float32)
    - `mtg_art.faiss` (FAISS IP index over normalized vectors)
    - `mtg_meta.jsonl` (per-vector JSON metadata lines)
- Python Query
  - Load FAISS index and metadata.
  - Embed a given query image and return top-K results with names and URLs.
- Browser Query
  - Export artifacts for browser use:
    - `embeddings.f16bin` (float16 binary concatenation of embeddings)
    - `meta.json` (JSON array of metadata)
  - `index.html` fetches artifacts, embeds user image using Transformers.js (`Xenova/clip-vit-base-patch32`), and shows top results.

## 4. Non-Functional Requirements
- Performance
  - Reasonable end-to-end build time for default mode on a modern laptop.
  - Browser search should complete under a few seconds for moderate dataset sizes.
- Portability
  - Python scripts run on macOS/Linux with CPU or GPU/MPS acceleration if available.
  - Browser demo runs on modern Chromium/Firefox/Safari.
- Reproducibility
  - `requirements.txt` pins core libraries to compatible ranges.
  - Makefile tasks provide one-command flows.

## 5. Architecture Overview
- Offline (Python):
  - `build_mtg_faiss.py` → downloads/caches images → embeds via CLIP → saves FAISS + metadata.
  - `query_index.py` → embeds query image → FAISS nearest neighbors → prints results.
- Export for Browser:
  - `export_for_browser.py` → `.npy` → `.f16bin`, `.jsonl` → `.json`.
- Browser:
  - `index.html` → loads `embeddings.f16bin` + `meta.json` → CLIP image embedder (Transformers.js) → cosine search in JS.

## 6. Data Contracts
- `index_out/mtg_meta.jsonl`: one JSON object per line with keys including:
  - `name`, `scryfall_id`, `face_id`, `set`, `collector_number`, `frame`, `layout`, `lang`, `colors`, `image_url`, `card_url`, `scryfall_uri`.
- `index_out/mtg_embeddings.npy`: float32 array of shape `[N, 512]`, L2-normalized.
- `index_out/mtg_art.faiss`: FAISS index over `[N, 512]` vectors using inner product.
- `index_out/embeddings.f16bin`: flat float16 buffer of length `N*512`.
- `index_out/meta.json`: JSON array of length `N`, same order as embeddings.

## 7. Acceptance Criteria
- Build
  - Running `make build` produces `index_out/mtg_embeddings.npy`, `index_out/mtg_art.faiss`, `index_out/mtg_meta.jsonl` without errors.
- Export
  - Running `make export` produces `index_out/embeddings.f16bin` and `index_out/meta.json` with matching counts.
- Python Query
  - Running `make query` prints top-K matches for a sample query image (path can be edited in `query_index.py`).
- Browser Query
  - Running `make serve` and opening `index.html` allows selecting a local image and returns top matches with thumbnails and links.

## 8. Risks & Mitigations
- Dependency installation (Torch, FAISS) may be platform-specific.
  - Provide guidance in README and allow CPU-only setups (faiss-cpu).
- Large dataset size → heavy memory/CPU in browser.
  - Browser path is intended for moderate N; note scaling strategies in README.

## 9. Future Work
- In-browser ANN (e.g., IVF/HNSW) or WebGPU-accelerated similarity search.
- Lightweight backend with FAISS for very large datasets.
- Better UI/UX in `index.html` (drag-and-drop, progress bars, error states).

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
  - Conda environment files (`environment-cpu.yml`, `environment-gpu.yml`, `environment-mps.yml`) are the single source of truth for dependency versions.
  - `requirements.txt` is informational only and points users to Conda envs.
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


## 8. Webcam Prototype Purpose
- Purpose
  - Provide a convenient way to acquire a clean, perspective-correct crop of a physical MTG card using the on-device webcam. The resulting crop is intended as the query image for the visual search system (either Python FAISS path or the in-browser demo).
- Scope (What the prototype does)
  - Use OpenCV.js to detect card-like quadrilateral contours on a live webcam preview.
  - Allow the user to click on/near a detected card to select it.
  - Perform a perspective transform on the corresponding area from the full-resolution frame to produce a rectified card image (displayed in a canvas).
- Out of Scope (Explicitly excluded)
  - Any functionality after cropping and displaying the selected card (e.g., OCR, fuzzy matching, card identification) is not part of this spec item and is not covered by acceptance criteria.
- File
  - `index_old.html` contains the prototype implementation. Only steps up to and including contour detection, user-assisted selection, and perspective-correct cropping are considered in scope.
- Rationale
  - Speeds up demo workflows by avoiding manual photo capture/upload steps and yields consistent, aspect-correct query images that can improve search quality.
- Acceptance & Status
  - This is an optional utility for acquiring query images and is not included in Section 7 acceptance criteria.

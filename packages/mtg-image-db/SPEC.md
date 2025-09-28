# Project Specification: MTG Card Art Visual Search

## Spec Version
- Version: v0.1.0
- Date: 2025-09-27T23:54:00+02:00

## Changelog
- v0.1.0
  - Introduced SPEC IDs across Functional Requirements and Acceptance Criteria.
  - Added Spec Version and Changelog sections. No functional behavior changes.

## 1. Summary
Build a Magic: The Gathering (MTG) visual search platform designed for online gameplay, where each player streams their board state via webcam (or similar). Users can click a card visible in any player’s stream to identify it and retrieve detailed card information. To enable this, the system fetches MTG card art (from Scryfall bulk data), embeds images using CLIP (ViT-B/32), and builds a searchable index that supports querying with a cropped image of the selected card. The index/database artifacts are shipped to the client so the entire search can run locally in the browser using Transformers.js; the match result is then used to fetch or display the full card details.

Technically, the system downloads and processes Scryfall bulk data, caches card art, produces CLIP embeddings, and builds a FAISS index for fast similarity search. It supports two query paths: (1) local Python via FAISS, and (2) fully in-browser via Transformers.js using pre-exported embeddings.

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
  - Embed all available images using CLIP ViT-B/32 to 512-dim L2-normalized vectors. [SPEC-FR-EI-01]
  - Persist artifacts to `index_out/`: [SPEC-FR-EI-02]
    - `mtg_embeddings.npy` (float32) [SPEC-FR-EI-02a]
    - `mtg_art.faiss` (FAISS IP index over normalized vectors) [SPEC-FR-EI-02b]
    - `mtg_meta.jsonl` (per-vector JSON metadata lines) [SPEC-FR-EI-02c]
- Python Query [SPEC-FR-PY]
  - Load FAISS index and metadata. [SPEC-FR-PY-01]
  - Embed a given query image and return top-K results with names and URLs. [SPEC-FR-PY-02]
- Browser Query [SPEC-FR-BR]
  - Export artifacts for browser use: [SPEC-FR-BR-01]
    - `embeddings.f16bin` (float16 binary concatenation of embeddings) [SPEC-FR-BR-01a]
    - `meta.json` (JSON array of metadata) [SPEC-FR-BR-01b]
  - `index.html` uses modules in `lib/` to perform fully client-side search: [SPEC-FR-BR-02]
    - `lib/search.js` loads `index_out/meta.json` and `index_out/embeddings.f16bin`, converts float16→float32, initializes the CLIP vision pipeline via Transformers.js (`Xenova/clip-vit-base-patch32`) using the `image-feature-extraction` task, provides `loadEmbeddingsAndMeta()`, `loadModel()`, `embedFromCanvas()`, and computes cosine similarity (dot products on L2-normalized vectors) via `topK()` to return top-K matches. [SPEC-FR-BR-02a]
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
  - `build_mtg_faiss.py` → downloads/caches images → embeds via CLIP → saves FAISS + metadata.
  - `query_index.py` → embeds query image → FAISS nearest neighbors → prints results.
- Export for Browser:
  - `export_for_browser.py` → `.npy` → `.f16bin`, `.jsonl` → `.json`.
- Browser:
  - `index.html` → loads `lib/search.js`, `lib/opencv-loader.js`, `lib/webcam.js`, `lib/main.js`:
    - `lib/search.js`: fetch `index_out/embeddings.f16bin` + `index_out/meta.json`, convert float16→float32, initialize CLIP vision extractor via Transformers.js (`image-feature-extraction`), embed query from the cropped canvas, compute dot products for top-K. [SPEC-ARCH-BR-SEARCH]
    - `lib/opencv-loader.js`: load OpenCV.js and expose a readiness promise consumed by `webcam.js`. [SPEC-ARCH-BR-OPENCV]
    - `lib/webcam.js`: manage webcam devices, detect card-like contours on an overlay using OpenCV.js, allow click-to-crop, and perform perspective transform to a normalized canvas. [SPEC-ARCH-BR-WEBCAM]
    - `lib/main.js`: wire up UI controls: start camera, camera selection, “Search Cropped”, and render results with thumbnail (`card_url` or derived) and Scryfall link. [SPEC-ARCH-BR-MAIN]

## 6. Data Contracts
- `index_out/mtg_meta.jsonl`: one JSON object per line with keys including:
  - `name`, `scryfall_id`, `face_id`, `set`, `collector_number`, `frame`, `layout`, `lang`, `colors`, `image_url`, `card_url`, `scryfall_uri`.
- `index_out/mtg_embeddings.npy`: float32 array of shape `[N, 512]`, L2-normalized.
- `index_out/mtg_art.faiss`: FAISS index over `[N, 512]` vectors using inner product.
- `index_out/embeddings.f16bin`: flat float16 buffer of length `N*512`.
- `index_out/meta.json`: JSON array of length `N`, same order as embeddings.

## 7. Acceptance Criteria
- Build [SPEC-AC-BUILD-01]
  - Running `python3 build_mtg_faiss.py --kind unique_artwork --out index_out --cache image_cache` produces `index_out/mtg_embeddings.npy`, `index_out/mtg_art.faiss`, `index_out/mtg_meta.jsonl` without errors. Alternatively, `make build` performs the same. [SPEC-AC-BUILD-01.1]
- Export [SPEC-AC-EXP-01]
  - Running `python3 export_for_browser.py` produces `index_out/embeddings.f16bin` and `index_out/meta.json` with matching counts. Alternatively, `make export` performs the same. [SPEC-AC-EXP-01.1]
- Python Query [SPEC-AC-PY-01]
  - Running `python3 query_index.py` prints top-K matches for a sample query image (edit `query_path` in `query_index.py`). Alternatively, `make query` performs the same. [SPEC-AC-PY-01.1]
- Browser Query [SPEC-AC-BR-01]
  - Serving the repository root with any static HTTP server (for example, `python3 -m http.server 8000` or `make serve`) and opening `index.html` supports: [SPEC-AC-BR-01.1]
    - Webcam crop: starting the webcam, clicking near a detected card polygon performs a perspective-correct crop; pressing “Search Cropped” embeds the canvas and displays top-K matches with thumbnail and link. [SPEC-AC-BR-01.1a]
  - All browser-side embedding and search occurs locally using pre-shipped artifacts (`embeddings.f16bin`, `meta.json`). [SPEC-AC-BR-01.2]

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


# Project Specification: MTG Web Client (Browser Search)

## Spec Version

- Version: v0.2.0
- Date: 2025-10-13T16:19:00+02:00

## Changelog

- v0.2.0
  - Updated data contracts to reflect int8 quantization (was float16). Updated file references from `embeddings.f16bin` to `embeddings.i8bin`.
  - Clarified that `meta.json` now includes quantization metadata wrapper (version 1.0 format).
- v0.1.0
  - Initial split from `packages/mtg-image-db/SPEC.md`. Defines browser-side requirements, data contracts, and acceptance criteria.

## 1. Summary

This spec defines the browser client that performs on-device visual search over pre-generated MTG card art embeddings. The client loads artifacts exported by `packages/mtg-image-db` and runs CLIP embedding via Transformers.js in the browser, returning top matches by cosine similarity.

## 2. Goals and Non-Goals

- Goals
  - Load and use exported artifacts (`embeddings.i8bin`, `meta.json`) fully client-side.
  - Provide functions to load the CLIP model, embed a query image/canvas, and compute top-K results.
  - Offer simple UI integration points for file-upload or webcam crop flows.
- Non-Goals
  - Generating or mutating the dataset; pipeline lives in `packages/mtg-image-db`.
  - Server-side search or hosted ANN.

## 3. Functional Requirements [WEB]

- Artifacts Loading [WEB-FR-AL]
  - Load `index_out/meta.json` (version 1.0 format with quantization metadata) containing an array of card records in the same order as the embeddings. [WEB-FR-AL-01]
  - Load `index_out/embeddings.i8bin` and dequantize int8 → float32 using the scale factor from `meta.json` to a contiguous `Float32Array` of shape `[N * 512]`. [WEB-FR-AL-02]
- Model Init [WEB-FR-MI]
  - Initialize Transformers.js pipeline: `image-feature-extraction` with `Xenova/clip-vit-base-patch32`. [WEB-FR-MI-01]
  - Provide a progress callback to surface model download/status. [WEB-FR-MI-02]
- Query/Embedding [WEB-FR-QE]
  - Support embedding from an `HTMLImageElement` and from a `HTMLCanvasElement`. [WEB-FR-QE-01]
  - L2-normalize all query vectors before similarity. [WEB-FR-QE-02]
- Similarity Search [WEB-FR-SS]
  - Compute cosine similarity via dot product on L2-normalized vectors against the database. [WEB-FR-SS-01]
  - Provide `topK(query, K)` and `top1(query)` utilities returning metadata merged with score. [WEB-FR-SS-02]
- Public API [WEB-FR-API]
  - Expose functions in `apps/web/src/lib/clip-search.ts`: `loadEmbeddingsAndMeta(basePath?)`, `loadModel(opts?)`, `embedFromCanvas(canvas)`, `embedFromImageElement(img)`, `topK(query, K)`, `top1(query)`. [WEB-FR-API-01]
- UI Hooks [WEB-FR-UI]
  - The application should be capable of wiring a file-upload flow and (optionally) a webcam crop to produce a canvas/image for querying. [WEB-FR-UI-01]

## 4. Non-Functional Requirements

- Performance
  - Load and first-query should complete in a few seconds on modern browsers/devices for moderate dataset sizes. [WEB-NFR-PERF-01]
- Portability
  - Works in Chromium/Firefox/Safari without native add-ons. [WEB-NFR-PORT-01]
- Offline
  - After assets are present in `public/index_out/`, should work without a backend. [WEB-NFR-OFF-01]

## 5. Data Contracts

- Inputs (from `packages/mtg-image-db` export):
  - `index_out/embeddings.i8bin`: flat int8 buffer of length `N*512`. [WEB-DC-IN-01]
  - `index_out/meta.json`: JSON object (version 1.0) with `{version, quantization: {dtype, scale_factor, ...}, shape: [N, 512], records: [...]}`. Each record has at minimum: `name`, `set`, and optionally `scryfall_uri`, `image_url`, `card_url`. [WEB-DC-IN-02]
- Derived in browser:
  - `Float32Array` database `db` of length `N*512`, dequantized from int8 and L2-normalized per vector. [WEB-DC-DRV-01]

## 6. Acceptance Criteria

- Assets Load [WEB-AC-ASSETS-01]
  - When `public/index_out/{embeddings.i8bin, meta.json}` are present, calling `loadEmbeddingsAndMeta()` resolves and keeps `meta.records.length === (embeddings.length / 512)`.
- Model Load [WEB-AC-MODEL-01]
  - Calling `loadModel()` resolves and subsequent embed calls succeed without throwing.
- Query [WEB-AC-QUERY-01]
  - Calling `embedFromCanvas()` with a valid canvas returns a `Float32Array(512)` normalized to ~unit length.
- Search [WEB-AC-SEARCH-01]
  - `top1(query)` returns an object with `score` and metadata fields; `topK(query, K)` returns `K` items sorted by descending score.
- UI Smoke [WEB-AC-UI-01]
  - A file upload path can be used to select an image and produce a non-empty top-5 result list displayed to the user.

## 7. Integration With Package

- `packages/mtg-image-db` is the canonical source for dataset generation and export. This web client must not change those artifacts.
- A helper script `pnpm --filter @repo/web prepare-assets` (or `pnpm -C apps/web run prepare-assets`) copies `index_out` artifacts into `apps/web/public/index_out/` for local dev and preview.

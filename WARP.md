# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a MTG (Magic: The Gathering) visual search platform built as a Turborepo monorepo. The system allows users to identify MTG cards by taking webcam photos during online gameplay streams. It uses CLIP embeddings and computer vision to match card art images.

## Architecture

### Monorepo Structure
- **Turborepo-based monorepo** using pnpm workspaces
- **apps/web**: React SPA with TanStack Router for the browser-based search client
- **packages/mtg-image-db**: Python pipeline for data processing and embedding generation
- **packages/eslint-config**: Shared ESLint configurations
- **packages/prettier**: Shared Prettier configuration

### Key Technologies
- **Frontend**: React 19, TanStack Router, Vite, Tailwind CSS v4
- **Backend/Data Pipeline**: Python, CLIP (ViT-B/32), FAISS, OpenCV.js
- **ML/AI**: Client-side inference with Transformers.js (@xenova/transformers)
- **Build System**: Turborepo with pnpm

### Data Flow Architecture
1. **Pipeline Stage** (`packages/mtg-image-db`): Downloads MTG card data from Scryfall, generates CLIP embeddings, builds FAISS index
2. **Export Stage**: Converts embeddings to browser-compatible formats (float16 binary + JSON metadata)
3. **Browser Stage** (`apps/web`): Loads embeddings client-side, uses webcam + OpenCV.js for card detection, performs similarity search locally

## Common Development Commands

### Root Level (Turborepo)
```bash
# Install dependencies
pnpm install

# Start development server for all apps
pnpm dev

# Build all packages and apps
pnpm build

# Run linting across all packages
pnpm lint

# Format code across all packages
pnpm format

# Type checking across all packages
pnpm check-types
```

### Web App Development (`apps/web`)
```bash
# Run web app in development mode (port 3000)
pnpm --filter @repo/web dev

# Build web app for production
pnpm --filter @repo/web build

# Run tests for web app
pnpm --filter @repo/web test

# Run Playwright end-to-end tests
pnpm --filter @repo/web test:e2e
```

### MTG Image Database Pipeline (`packages/mtg-image-db`)
```bash
# Navigate to the package directory for Python commands
cd packages/mtg-image-db

# Set up Python environment (choose based on your hardware)
make conda-cpu    # for CPU-only
make conda-gpu    # for NVIDIA CUDA
make conda-mps    # for Apple Silicon (MPS)

# Build the embedding database (two-step process recommended)
make download  # Step 1: Download and cache images
make embed     # Step 2: Build embeddings from cache
# Or combined: make build-all

# Legacy single-step build
make build

# Export embeddings for browser use
make export

# Query the index (for testing)
make query

# Serve the browser demo locally
make serve

# Clean all generated files
make clean
```

### Running Single Tests
```bash
# Run specific test file in web app
pnpm --filter @repo/web test -- path/to/test.spec.ts

# Run tests in watch mode
pnpm --filter @repo/web test -- --watch
```

## Key Files and Responsibilities

### Browser Search Implementation (`apps/web/src/lib/`)
- **`search.ts`**: Core search functionality - loads embeddings, CLIP model, performs similarity search
- **`webcam.ts`**: Webcam management and OpenCV.js card detection with perspective correction
- **`routes/index.tsx`**: Main scanner UI with webcam controls and result display

### Data Pipeline (`packages/mtg-image-db/`)
- **`download_images.py`**: Downloads and caches Scryfall card images (step 1)
- **`build_embeddings.py`**: Generates CLIP embeddings from cache, builds FAISS index (step 2)
- **`build_mtg_faiss.py`**: Legacy single-step pipeline (download + embed)
- **`export_for_browser.py`**: Converts embeddings to browser-compatible format (int8 quantized + JSON)
- **`query_index.py`**: Python-based search testing utility

### Configuration
- **`turbo.json`**: Defines build pipeline dependencies and caching rules
- **`pnpm-workspace.yaml`**: Defines monorepo packages and shared dependency catalog

## Development Workflow

### Setting up for Development
1. Clone repository and run `pnpm install`
2. Set up Python environment in `packages/mtg-image-db` using appropriate `make conda-*` command
3. Build initial dataset:
   ```bash
   cd packages/mtg-image-db
   make download  # Download and cache images (step 1)
   make embed     # Build embeddings (step 2)
   make export    # Export for browser
   # Or use: make build-all && make export
   ```
4. Start development: `pnpm dev` (runs web app on port 3000)

### Working with the Data Pipeline
- The Python pipeline must be run before the browser app can function
- Embeddings are exported to `packages/mtg-image-db/index_out/` and consumed by the web app
- Two-step build process allows resuming interrupted downloads and re-running embeddings without re-downloading
- Changes to the dataset require rebuilding: `make download && make embed && make export` (or `make build-all && make export`)

### Browser-side Search Flow
- All ML inference happens client-side using Transformers.js
- No server required - embeddings and metadata are served as static files
- OpenCV.js handles card detection and perspective correction from webcam
- CLIP model (~100MB) downloads automatically on first use

## Testing

### Web App Testing
- Uses Vitest for unit tests
- Playwright for end-to-end testing
- Tests focus on search functionality and webcam integration

### Pipeline Testing
- Python scripts have built-in query testing (`make query`)
- Makefile provides reproducible build/test commands

## Package Dependencies

### Critical Browser Dependencies
- `@xenova/transformers`: Client-side CLIP inference
- `@tanstack/react-router`: File-based routing
- OpenCV.js (loaded dynamically): Computer vision for card detection

### Python Pipeline Dependencies  
- Managed through Conda environments (`environment-*.yml` files)
- Key packages: transformers, faiss, opencv-python, requests

## Performance Considerations

- **Browser**: First load downloads ~100MB CLIP model, subsequent searches are instant
- **Pipeline**: Dataset build time varies by collection size (default: unique_artwork)
- **Memory**: Browser search requires ~50-100MB RAM for embeddings depending on dataset size

## Deployment Notes

- Web app builds to static files, can be deployed to any static host
- Embeddings and metadata must be available as static assets
- No server-side components required for the search functionality
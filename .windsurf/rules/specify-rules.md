# spell-coven-mono Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-13

## Active Technologies
- TypeScript 5.x (frontend), Node.js 20+ (build tooling) (004-integrate-figma-generated)
- Python 3.10+ (existing constraint from environment files) + requests, Pillow, numpy, torch, CLIP, faiss, tqdm (all existing) (005-implement-senior-developer)
- File system (image cache, FAISS index, JSONL metadata) (005-implement-senior-developer)
- TypeScript 5.9.2, React 19.0.0 + Vite 7.x, Tailwind CSS 4.0.6, Radix UI components, React 19 (006-integrate-figma-exported)
- N/A (client-side only application) (006-integrate-figma-exported)
- TypeScript 5.x / React 18.x (007-refactor-card-cropping)
- Browser-side only (IndexedDB for model caching via Transformers.js) (007-refactor-card-cropping)
- TypeScript 5.x (existing project standard) + @huggingface/transformers ^3.7.5 (already installed), React 19, Vite 7 (008-replace-opencv-card)
- Browser IndexedDB (for DETR model caching via Transformers.js), existing canvas-based video processing (008-replace-opencv-card)
- TypeScript 5.x (browser), Python 3.11 (embedding pipeline - reference only) (009-improve-cropped-card)
- N/A (client-side only, no persistence changes) (009-improve-cropped-card)
- TypeScript 5.x (frontend), Python 3.11+ (mtg-image-db pipeline) (010-ensure-mtg-image)
- TypeScript 5.x (React/Vite frontend) (011-advanced-card-extraction)
- Browser IndexedDB (model caching), in-memory frame buffer (011-advanced-card-extraction)
- TypeScript 5.x (ES2022 target), React 19 + @huggingface/transformers 3.7.5, Vite 7.x, TanStack Router, Tailwind CSS 4.x (012-fix-clip-model-alignment)
- Browser IndexedDB (model caching), CDN-served embeddings (int8 quantized binaries) (012-fix-clip-model-alignment)
- TypeScript 5.5+, Node.js 20+ (014-discord-gateway-service)
- N/A (stateless services, in-memory WebSocket registry) (014-discord-gateway-service)
- TypeScript 5.x (Bun runtime for scripts, Node.js 20 for Start server) + TanStack Start (`@tanstack/react-start`), `ws`, `crossws`, `discord-api-types`, `@repo/discord-gateway`, `zod` (016-realtime-plan)
- N/A (in-memory event bus and queues only) (016-realtime-plan)

## Project Structure
```
src/
tests/
```

## Commands
npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style
TypeScript 5.x (frontend), Node.js 20+ (build tooling): Follow standard conventions

## Recent Changes
- 016-realtime-plan: Added TypeScript 5.x (Bun runtime for scripts, Node.js 20 for Start server) + TanStack Start (`@tanstack/react-start`), `ws`, `crossws`, `discord-api-types`, `@repo/discord-gateway`, `zod`
- 014-discord-gateway-service: Added TypeScript 5.5+, Node.js 20+
- 012-fix-clip-model-alignment: Added TypeScript 5.x (ES2022 target), React 19 + @huggingface/transformers 3.7.5, Vite 7.x, TanStack Router, Tailwind CSS 4.x

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

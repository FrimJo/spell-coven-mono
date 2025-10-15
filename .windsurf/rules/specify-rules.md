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
- 007-refactor-card-cropping: Added TypeScript 5.x / React 18.x
- 006-integrate-figma-exported: Added TypeScript 5.9.2, React 19.0.0 + Vite 7.x, Tailwind CSS 4.0.6, Radix UI components, React 19
- 005-implement-senior-developer: Added Python 3.10+ (existing constraint from environment files) + requests, Pillow, numpy, torch, CLIP, faiss, tqdm (all existing)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

# MTG Web Client (Browser Search)

This app provides a browser-based visual search over pre-generated MTG card art embeddings. It uses your webcam to detect and identify Magic: The Gathering cards in real-time, running entirely in the browser with no server required.

## Features

- **Real-time Card Detection**: Uses OpenCV.js to detect card boundaries in webcam feed
- **Visual Search**: CLIP-based image embeddings for accurate card identification
- **Fully Client-Side**: All processing happens in your browser (CLIP model + OpenCV)
- **No Server Required**: Model files served locally, embeddings pre-computed

See the browser spec: `apps/web/SPEC.md`.

## Prerequisites

Ensure `@repo/mtg-image-db` has exported artifacts in its `index_out/` directory (run its build/export scripts). The web app imports these at runtime via Vite asset URLs, no copying required.

**CLIP Model**: The model downloads automatically to the browser's cache on first use (~150MB quantized). No manual setup required!

## Develop

```bash
pnpm --filter @repo/web dev
```

Open http://localhost:3000 and click "Start Webcam" to begin scanning cards.

### Troubleshooting

- **"Model failed to load"**: Check internet connection - model downloads from Hugging Face CDN on first use
- **"Webcam not starting"**: Check browser camera permissions
- **First load slow**: Model (~150MB) and OpenCV (~8MB) download on first use, then cached by browser

## Build & Preview

```bash
pnpm --filter @repo/web build
pnpm --filter @repo/web serve
```

## Programmatic API (from `src/lib/search.ts`)

```ts
import {
  loadEmbeddingsAndMetaFromPackage,
  loadModel,
  embedFromCanvas,
  embedFromImageElement,
  topK,
  top1,
} from './src/lib/search'

await loadEmbeddingsAndMetaFromPackage() // resolves @repo/mtg-image-db/index_out/* via Vite `?url` imports
await loadModel({ onProgress: (m) => console.log(m) })

const q = await embedFromCanvas(canvas) // or: await embedFromImageElement(img)
const best = top1(q)
const results = topK(q, 5)
```

Notes:
- Embedding dimension is 512 and cosine similarity is used via dot product on L2-normalized vectors.
- If you need to serve assets from a custom path, you can still use `loadEmbeddingsAndMeta(basePath)` instead of the package-based helper.

## Testing & Linting

```bash
pnpm --filter @repo/web test          # vitest
pnpm --filter @repo/web check-types   # TypeScript
pnpm --filter @repo/web format        # Prettier check
pnpm --filter @repo/web lint          # Lint
```

## Asset Paths

- Default: assets are bundled from `@repo/mtg-image-db/index_out/*` using Vite `?url` imports.
- Alternative: serve `index_out/embeddings.f16bin` and `index_out/meta.json` yourself and call `loadEmbeddingsAndMeta(basePath)`.

## Architecture

### Model Loading

Transformers.js downloads the CLIP model directly to the browser's cache from Hugging Face CDN:

```typescript
// Configured in src/lib/search.ts
env.useBrowserCache = true      // Cache in browser (IndexedDB)
env.allowRemoteModels = true    // Download from Hugging Face
env.allowLocalModels = false    // Don't serve from web server

// Model downloads to browser cache on first use
await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
  quantized: true // Uses 147MB quantized model instead of 578MB
})
```

**Benefits:**
- ✅ No server storage needed (model stays in browser cache)
- ✅ Automatic updates when model is updated on Hugging Face
- ✅ Works offline after first download
- ✅ Shared cache across all sites using same model

### Webcam Pipeline

1. **OpenCV.js** detects card boundaries in real-time
2. User clicks on detected card to crop it
3. **CLIP** generates 512-dimensional embedding from cropped image
4. **Cosine similarity** search against pre-computed card embeddings
5. Best match displayed with card details

### Performance

- **First load**: ~10-30 seconds (downloads 147MB model + 8MB OpenCV from CDN)
- **Subsequent loads**: ~2-3 seconds (uses cached files)
- **Card detection**: 30+ FPS (OpenCV.js)
- **Embedding generation**: ~100-200ms per card (CLIP)
- **Search**: <1ms (dot product over ~20k cards)


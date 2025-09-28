# MTG Web Client (Browser Search)

This app provides a browser-based visual search over pre-generated MTG card art embeddings. It consumes artifacts exported by `packages/mtg-image-db` and runs CLIP in-browser via Transformers.js.

See the browser spec: `apps/web/SPEC.md`.

## Prerequisites

- Ensure `@repo/mtg-image-db` has exported artifacts in its `index_out/` directory (run its build/export scripts). The web app imports these at runtime via Vite asset URLs, no copying required.

## Develop

```bash
pnpm --filter @repo/web dev
```

Open the printed local URL (default http://localhost:3000). Assets are resolved from the `@repo/mtg-image-db` package using Vite `?url` imports.

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


---
description: Release MTG embeddings data to the web app
---

## Prerequisites

- Active Python environment with required dependencies (see `packages/mtg-image-db/README.md`)
- Scryfall cache refreshed if new cards were added (`packages/mtg-image-db/image_cache_v2/`)
- Sufficient disk space (>500 MB free)

## Steps

1. **Prepare source data**
   1. Verify fresh images downloaded:
      ```bash
      cd packages/mtg-image-db
      python download_images.py --kind unique_artwork --cache image_cache_v2
      ```
      > Skip if the cache already contains the latest cards.
   2. Build embeddings + FAISS (two-step recommended):
      ```bash
      python build_embeddings.py --kind unique_artwork --cache image_cache_v2 --out index_out --batch 256 --size 336 --hnsw-m 32 --hnsw-ef-construction 200
      ```
      > Adjust parameters if needed. Expect ~26k vectors per 30 minutes on M2 Max.

2. **Export browser artifacts**
   1. Convert to int8 + metadata bundle:
      ```bash
      python export_for_browser.py --input-dir index_out --output-dir index_out
      ```
   2. Confirm outputs present:
      - `index_out/meta.json`
      - `index_out/embeddings.i8bin`
      - `index_out/build_manifest.json`

3. **Create new web version directory**
   1. Choose next semantic version (e.g., `v1.2`).
   2. Create destination folder:
      ```bash
      mkdir -p apps/web/public/data/mtg-embeddings/v1.2
      ```

4. **Copy release artifacts**
   ```bash
   cp packages/mtg-image-db/index_out/meta.json \
      packages/mtg-image-db/index_out/embeddings.i8bin \
      packages/mtg-image-db/index_out/build_manifest.json \
      apps/web/public/data/mtg-embeddings/v1.2/
   ```

5. **Update application configuration**
   ```bash
   echo "VITE_EMBEDDINGS_VERSION=v1.2" > apps/web/.env.development
   echo "VITE_EMBEDDINGS_VERSION=v1.2" > apps/web/.env.production
   ```

6. **Documentation & verification**
   1. Update `apps/web/public/data/mtg-embeddings/README.md`:
      - `Current Version`
      - `Build Date`
      - Copy instructions to target version (now `v1.3` placeholder)
   2. Record release notes (optional). Consider adding a changelog entry.
   3. (Optional) Validate payload size:
      ```bash
      ls -lh apps/web/public/data/mtg-embeddings/v1.2
      ```

7. **Testing**
   1. Run web app locally with new embeddings:
      ```bash
      cd apps/web
      pnpm install
      pnpm dev
      ```
      Confirm search UI loads and returns results.
   2. (Optional) Run automated tests:
      ```bash
      pnpm test --filter image
      ```

8. **Finalize release**
   1. Stage artifacts:
      ```bash
      git add apps/web/public/data/mtg-embeddings/v1.2/ \
              apps/web/.env.development \
              apps/web/.env.production \
              apps/web/public/data/mtg-embeddings/README.md
      ```
   2. Commit:
      ```bash
      git commit -m "chore: update MTG embeddings to v1.2"
      ```
   3. Push and deploy via your usual CI/CD pipeline.

9. **Post-release cleanup**
   - Optionally prune older versions after confirming no deployments depend on them.
   - Archive build logs or metrics in `packages/mtg-image-db/build_logs/` (if used).

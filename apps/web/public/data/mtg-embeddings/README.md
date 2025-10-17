# MTG Embeddings Data

This directory contains versioned MTG card embeddings data used by the image search feature.

## Current Version: v1.1

**Build Date:** 2025-10-17
**Total Cards:** 52,491 unique artworks
**Embedding Model:** CLIP ViT-B/32 (Xenova/clip-vit-base-patch32)
**Quantization:** int8 (scale factor: 127)

## Files

Each version directory contains:

- `meta.json` - Card metadata (names, sets, URLs) and quantization info (~27 MB)
- `embeddings.i8bin` - Quantized embeddings in int8 format (~26 MB)
- `build_manifest.json` - Build metadata and statistics

## Updating to a New Version

When the MTG card database is updated:

1. **Build new embeddings** in `packages/mtg-image-db`:

   ```bash
   cd packages/mtg-image-db
   python build_embeddings.py --kind unique_artwork --cache image_cache --out index_out --batch 256 --size 336 --hnsw-m 32 --hnsw-ef-construction 200
   python export_for_browser.py --input-dir index_out --output-dir index_out
   ```

   > Shortcut: `pnpm build` runs the legacy single-step pipeline targeting `index_out/`.

2. **Create new version directory**:

   ```bash
   mkdir -p apps/web/public/data/mtg-embeddings/v{MAJOR.MINOR}
   ```

3. **Copy the required files**:

   ```bash
   cp packages/mtg-image-db/index_out/meta.json \
      packages/mtg-image-db/index_out/embeddings.i8bin \
      packages/mtg-image-db/index_out/build_manifest.json \
      apps/web/public/data/mtg-embeddings/v{MAJOR.MINOR}/
   ```

4. **Update the version in environment files**:

   ```bash
   # Update both .env.development and .env.production
   echo "VITE_EMBEDDINGS_VERSION=v{MAJOR.MINOR}" > apps/web/.env.development
   echo "VITE_EMBEDDINGS_VERSION=v{MAJOR.MINOR}" > apps/web/.env.production
   ```

5. **Commit the new files**:
   ```bash
   git add apps/web/public/data/mtg-embeddings/v{MAJOR.MINOR}/
   git commit -m "chore: update MTG embeddings to v{MAJOR.MINOR}"
   ```

## Why Version These Files?

- **Deployment reliability**: GitHub Pages deployment doesn't have Python/ML dependencies
- **Build speed**: Avoids 1+ hour embedding generation on every deploy
- **Reproducibility**: Exact same data across all environments
- **Version control**: Track when card database was updated

## File Sizes

The files are large (~55 MB total per version) but necessary for the app to function. They are:

- Compressed in git (delta compression)
- Served as static assets (can be cached by CDN/browser)
- Only downloaded when users access the search feature

## Old Versions

Keep at least one previous version for rollback capability. Remove older versions when:

- Disk space is a concern
- The version is >6 months old
- No production deployments reference it

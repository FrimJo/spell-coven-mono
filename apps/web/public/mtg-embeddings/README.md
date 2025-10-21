# MTG Embeddings Data

This directory contains versioned MTG card embeddings data used by the image search feature.

## Current Version: v1.3

**Build Date:** 2025-10-20
**Total Cards:** 52,491 unique artworks
**Embedding Model:** CLIP ViT-B/32 (Xenova/clip-vit-base-patch32)
**Format:** float32
**Contrast Enhancement:** 1.5x

## Files

Each version directory contains:

- `meta.json` - Card metadata (names, sets, URLs) (~28 MB)
- `embeddings.f32bin` - Embeddings in float32 format (~108 MB)
- `build_manifest.json` - Build metadata and statistics

## Releasing a New Version

Once `make download`, `make embed`, and `make export` have been run in `packages/mtg-image-db`:

1. **Determine the new version number** based on the build manifest:

   ```bash
   cat packages/mtg-image-db/index_out/build_manifest.json | grep -E '"total_cards"|"build_date"'
   ```

2. **Create new version directory**:

   ```bash
   mkdir -p apps/web/public/data/mtg-embeddings/v{MAJOR.MINOR}
   ```

3. **Copy the required files from `index_out/`**:

   ```bash
   cp packages/mtg-image-db/index_out/meta.json \
      packages/mtg-image-db/index_out/embeddings.f32bin \
      packages/mtg-image-db/index_out/build_manifest.json \
      apps/web/public/data/mtg-embeddings/v{MAJOR.MINOR}/
   ```

4. **Update this README** with new build info:
   - Update `## Current Version: v{MAJOR.MINOR}`
   - Update `**Build Date:**` from build_manifest.json
   - Update `**Total Cards:**` from build_manifest.json

5. **Update environment files** to use the new version:

   ```bash
   # Update both .env.development and .env.production
   echo "VITE_EMBEDDINGS_VERSION=v{MAJOR.MINOR}" > apps/web/.env.development
   echo "VITE_EMBEDDINGS_VERSION=v{MAJOR.MINOR}" > apps/web/.env.production
   echo "VITE_EMBEDDINGS_FORMAT=float32" >> apps/web/.env.development
   echo "VITE_EMBEDDINGS_FORMAT=float32" >> apps/web/.env.production
   ```

6. **Commit the new files**:
   ```bash
   git add apps/web/public/data/mtg-embeddings/v{MAJOR.MINOR}/ apps/web/.env.development apps/web/.env.production apps/web/public/data/mtg-embeddings/README.md
   git commit -m "chore: release MTG embeddings v{MAJOR.MINOR}"
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

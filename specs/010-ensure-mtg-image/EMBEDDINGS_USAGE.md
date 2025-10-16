# Embeddings Usage Guide

## Overview

The MTG card embeddings are stored in a **versioned structure** at `apps/web/public/data/mtg-embeddings/`. This approach provides version control, deployment reliability, and easy rollback capability.

## Directory Structure

```
apps/web/public/data/mtg-embeddings/
├── README.md                    # Documentation
└── v1.0/                        # Current version
    ├── embeddings.i8bin         # 26 MB - Quantized embeddings
    ├── meta.json                # 27 MB - Card metadata
    └── build_manifest.json      # Build info
```

## Configuration

### Environment Variables

The version is controlled via environment variables:

**Development** (`.env.development`):
```bash
VITE_EMBEDDINGS_VERSION=v1.0
```

**Production** (`.env.production`):
```bash
VITE_EMBEDDINGS_VERSION=v1.0
```

### Code Usage

Use the configuration module to get version-aware paths:

```typescript
import {
  getEmbeddingsVersion,
  getEmbeddingsBinaryUrl,
  getMetadataUrl,
  getBuildManifestUrl
} from '@/lib/search/embeddings-config'

// Get current version
const version = getEmbeddingsVersion() // 'v1.0'

// Get URLs for loading
const binaryUrl = getEmbeddingsBinaryUrl()   // '/data/mtg-embeddings/v1.0/embeddings.i8bin'
const metadataUrl = getMetadataUrl()         // '/data/mtg-embeddings/v1.0/meta.json'
const manifestUrl = getBuildManifestUrl()    // '/data/mtg-embeddings/v1.0/build_manifest.json'
```

## Loading Embeddings

### Example: Load and Validate

```typescript
import { loadMetadata } from '@/lib/search/metadata-loader'
import { loadEmbeddingDatabase } from '@/lib/search/embeddings-loader'
import { getEmbeddingsBinaryUrl, getMetadataUrl } from '@/lib/search/embeddings-config'

async function initializeEmbeddings() {
  // Load metadata
  const metadata = await loadMetadata(getMetadataUrl())
  
  // Load and validate embeddings
  const database = await loadEmbeddingDatabase(
    getEmbeddingsBinaryUrl(),
    metadata
  )
  
  console.log(`Loaded ${database.numCards} cards`)
  console.log(`Embedding dimension: ${database.embeddingDim}`)
  
  return { metadata, database }
}
```

## Updating Embeddings

When the card database is updated:

### 1. Build New Embeddings

```bash
cd packages/mtg-image-db
pnpm build
```

### 2. Create New Version Directory

```bash
mkdir -p apps/web/public/data/mtg-embeddings/v1.1
```

### 3. Copy Files

```bash
cp packages/mtg-image-db/index_out/meta.json \
   packages/mtg-image-db/index_out/embeddings.i8bin \
   packages/mtg-image-db/index_out/build_manifest.json \
   apps/web/public/data/mtg-embeddings/v1.1/
```

### 4. Update Environment Variables

```bash
# Update both files
echo "VITE_EMBEDDINGS_VERSION=v1.1" > apps/web/.env.development
echo "VITE_EMBEDDINGS_VERSION=v1.1" > apps/web/.env.production
```

### 5. Commit Changes

```bash
git add apps/web/public/data/mtg-embeddings/v1.1/
git add apps/web/.env.development apps/web/.env.production
git commit -m "chore: update MTG embeddings to v1.1"
```

## Current Version Details

**Version**: v1.0  
**Build Date**: 2025-10-14  
**Total Cards**: 52,491 unique artworks  
**Embedding Model**: CLIP ViT-B/32 (Xenova/clip-vit-base-patch32)  
**Quantization**: int8 (scale factor: 127)

### File Sizes
- `embeddings.i8bin`: ~26 MB
- `meta.json`: ~27 MB
- `build_manifest.json`: <1 KB
- **Total**: ~53 MB per version

## Benefits of Versioned Structure

1. **Deployment Reliability**: No Python/ML dependencies needed during deployment
2. **Build Speed**: Avoids 1+ hour embedding generation on every deploy
3. **Reproducibility**: Exact same data across all environments
4. **Version Control**: Track when card database was updated
5. **Rollback Capability**: Keep previous versions for easy rollback
6. **CDN/Browser Caching**: Static assets can be cached efficiently

## Integration with Implementation

The implementation uses these paths automatically:

- **Contract Validator**: Validates format matches v1.0 specification
- **Embeddings Loader**: Loads from versioned path via config
- **Metadata Loader**: Loads from versioned path via config
- **CLIP Embedder**: Works with loaded embeddings
- **Similarity Search**: Searches over loaded database

All modules are version-agnostic and work with any v1.0-compatible data.

## Troubleshooting

### Wrong Version Loaded

Check environment variable:
```bash
cat apps/web/.env.development | grep VITE_EMBEDDINGS_VERSION
```

### Files Not Found

Verify files exist:
```bash
ls -lh apps/web/public/data/mtg-embeddings/v1.0/
```

### Version Mismatch Errors

The contract validator will throw clear errors if:
- Version in `meta.json` doesn't match expected "1.0"
- File sizes don't match shape
- Quantization parameters are incorrect

See error logs for specific remediation steps.

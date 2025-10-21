# Deployment to Vercel Blob Storage

This guide explains how to deploy embeddings to Vercel Blob Storage.

## Prerequisites

1. **Environment Variables** must be configured:
   - `VITE_BLOB_STORAGE_URL` in root `.env.development`
   - `BLOB_READ_WRITE_TOKEN` in root `.env.development.local`

2. **Exported Files** must exist in `index_out/`:
   - `embeddings.f32bin` (or `embeddings.i8bin`)
   - `meta.json`
   - `build_manifest.json`

3. **Python Dependencies**:
   - `requests` library (install with: `pip install requests`)

## Quick Start

### 1. Build and Export Embeddings

```bash
cd packages/mtg-image-db

# Download images
make download

# Build embeddings (uses VITE_QUERY_CONTRAST from .env.development)
make embed

# Export for browser
make export
```

### 2. Deploy to Vercel Blob

```bash
# Deploy to v1.3 folder
make deploy MAJOR=1 MINOR=3

# Or use the Python script directly
python deploy_to_blob.py --major 1 --minor 3
```

### 3. Verify Deployment

Files will be uploaded to:
```
https://na5tsrppklbhqyyg.public.blob.vercel-storage.com/v1.3/
├── embeddings.f32bin
├── embeddings.i8bin (if generated)
├── meta.json
└── build_manifest.json
```

## Usage

### Using Make

```bash
# Basic deployment
make deploy MAJOR=1 MINOR=3

# Dry run (show what would be uploaded)
python deploy_to_blob.py --major 1 --minor 3 --dry-run
```

### Using Python Script Directly

```bash
# Deploy to v1.3
python deploy_to_blob.py --major 1 --minor 3

# Deploy with custom input directory
python deploy_to_blob.py --major 1 --minor 3 --input-dir /path/to/exports

# Dry run
python deploy_to_blob.py --major 1 --minor 3 --dry-run
```

## Configuration

### Environment Variables

**Root `.env.development`:**
```
VITE_BLOB_STORAGE_URL=https://na5tsrppklbhqyyg.public.blob.vercel-storage.com/
```

**Root `.env.development.local`:**
```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_na5TSRpPkLbHqYyG_Mc2AZI5UxUJaTazG5kxylJ4Dybxfmt
```

### Version Naming

Versions are named as `v{MAJOR}.{MINOR}`:
- `v1.0` - First release
- `v1.1` - Minor update
- `v1.3` - Current version
- `v2.0` - Major version bump

## Files Uploaded

| File | Purpose | Size |
|------|---------|------|
| `embeddings.f32bin` | Float32 embeddings (full precision) | ~500 MB |
| `embeddings.i8bin` | Int8 quantized embeddings (75% smaller) | ~125 MB |
| `meta.json` | Metadata with card information | ~50 MB |
| `build_manifest.json` | Build configuration and statistics | ~1 KB |

## Troubleshooting

### "VITE_BLOB_STORAGE_URL not found"
- Ensure `.env.development` exists in repository root
- Check that `VITE_BLOB_STORAGE_URL` is set

### "BLOB_READ_WRITE_TOKEN not found"
- Ensure `.env.development.local` exists in repository root
- Check that `BLOB_READ_WRITE_TOKEN` is set
- **Never commit `.env.development.local` to git**

### "Input directory not found"
- Ensure you've run `make export` first
- Check that `index_out/` directory exists

### Upload timeout
- Large files (>500 MB) may timeout on slow connections
- The script has a 5-minute timeout per file
- Try uploading during off-peak hours

### 401 Unauthorized
- Token may be expired or invalid
- Regenerate token from Vercel dashboard
- Update `.env.development.local`

## Integration with Web App

The web app loads embeddings from the deployed version:

```typescript
// apps/web/src/lib/clip-search.ts
const EMBEDDINGS_VERSION = import.meta.env.VITE_EMBEDDINGS_VERSION // "v1.3"
const BLOB_URL = import.meta.env.VITE_BLOB_STORAGE_URL
const embeddingsUrl = `${BLOB_URL}${EMBEDDINGS_VERSION}/embeddings.f32bin`
```

Update `VITE_EMBEDDINGS_VERSION` in `.env.development` to point to the newly deployed version.

## Full Workflow Example

```bash
cd packages/mtg-image-db

# 1. Download latest cards
make download

# 2. Build embeddings with 1.5x contrast enhancement
make embed

# 3. Export for browser
make export

# 4. Deploy to v1.4
make deploy MAJOR=1 MINOR=4

# 5. Update web app to use new version
# Edit root .env.development:
# VITE_EMBEDDINGS_VERSION=v1.4

# 6. Restart web app
cd ../../apps/web
pnpm dev
```

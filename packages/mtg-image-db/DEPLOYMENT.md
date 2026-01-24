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

# Build embeddings (contrast factor set via --contrast flag, default 1.5)
make embed

# Export for browser
make export
```

### 2. Deploy to Vercel Blob

```bash
# Deploy to latest-dev channel with automatic snapshot version
make deploy-dev

# Deploy to latest-prod channel with automatic snapshot version
make deploy-prod

# Or use the Python script directly
python deploy_to_blob.py --channel latest-dev --snapshot
python deploy_to_blob.py --channel latest-prod --snapshot --version v2026-01-20-ab12cd3
```

### 3. Verify Deployment

Files will be uploaded to:
```
https://na5tsrppklbhqyyg.public.blob.vercel-storage.com/latest-dev/
├── embeddings.f32bin
├── embeddings.i8bin (if generated)
├── meta.json
└── build_manifest.json

# And also to snapshot version folder:
https://na5tsrppklbhqyyg.public.blob.vercel-storage.com/v2026-01-20-ab12cd3/
├── embeddings.f32bin
├── embeddings.i8bin (if generated)
├── meta.json
└── build_manifest.json
```

## Usage

### Using Make

```bash
# Deploy to latest-dev channel
make deploy-dev

# Deploy to latest-prod channel
make deploy-prod
```

### Using Python Script Directly

```bash
# Deploy to latest-dev channel with auto-generated snapshot version
python deploy_to_blob.py --channel latest-dev --snapshot

# Deploy to latest-prod channel with specific snapshot version
python deploy_to_blob.py --channel latest-prod --snapshot --version v2026-01-20-ab12cd3

# Deploy with custom input directory
python deploy_to_blob.py --channel latest-dev --snapshot --input-dir /path/to/exports

# Dry run
python deploy_to_blob.py --channel latest-dev --snapshot --dry-run
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

Versions use date-based snapshot format: `v{YYYYMMDD}-{git-sha}`
- `v2026-01-20-ab12cd3` - Snapshot version (immutable)
- `latest-dev` - Development channel (mutable, points to latest dev snapshot)
- `latest-prod` - Production channel (mutable, points to latest production snapshot)

Snapshot versions are automatically generated from the current date and git commit SHA.
Channels are mutable pointers that can be updated to point to different snapshots.

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
const EMBEDDINGS_VERSION = import.meta.env.VITE_EMBEDDINGS_VERSION // "latest-dev" or "v2026-01-20-ab12cd3"
const BLOB_URL = import.meta.env.VITE_BLOB_STORAGE_URL
const embeddingsUrl = `${BLOB_URL}${EMBEDDINGS_VERSION}/embeddings.f32bin`
```

Update `VITE_EMBEDDINGS_VERSION` in `.env.development` to point to the channel or snapshot version.
For channels (latest-dev, latest-prod), cache-busting hash is automatically appended to URLs.

## Full Workflow Example

```bash
cd packages/mtg-image-db

# 1. Download latest cards
make download

# 2. Build embeddings with 1.5x contrast enhancement
make embed

# 3. Export for browser
make export

# 4. Deploy to latest-dev channel (with auto-generated snapshot)
make deploy-dev

# 5. Update web app to use new version (if needed)
# Edit root .env.development:
# VITE_EMBEDDINGS_VERSION=latest-dev
# Or use a specific snapshot:
# VITE_EMBEDDINGS_VERSION=v2026-01-20-ab12cd3

# 6. Restart web app
cd ../../apps/web
bun dev
```

# Environment Configuration

This package has been updated to use `build_manifest.json` as the single source of truth for configuration, eliminating environment variable dependencies.

## Configuration via build_manifest.json

All configuration is now stored in `build_manifest.json` which is generated during the embedding build process and deployed alongside the embeddings. This ensures perfect consistency between build-time and query-time settings.

### Why build_manifest.json?

**Problem**: Previously, embedding format and contrast settings were split across environment variables, requiring manual synchronization between Python (build) and JavaScript (query).

**Solution**: The build manifest acts as the single source of truth:
1. Python writes settings to `build_manifest.json` during build
2. JavaScript reads settings from `build_manifest.json` during query
3. Impossible to have mismatched settings between build and query

### Manifest Structure

```json
{
  "version": "1.0",
  "timestamp": "2026-01-24T10:30:00Z",
  "parameters": {
    "enhance_contrast": 1.5,
    "format": "int8",
    "embeddings_filename": "embeddings.i8bin"
  },
  "artifacts": {
    "embeddings": "mtg_embeddings.npy",
    "faiss_index": "mtg_cards.faiss",
    "metadata": "mtg_meta.jsonl"
  },
  "file_hash": "a1b2c3d4e5f6g7h8"
}
```

### Key Fields

- **`parameters.enhance_contrast`** (required): Contrast enhancement factor applied during embedding
  - `1.0` = no enhancement
  - `1.2` = 20% boost (recommended for blurry cards)
  - `1.5` = 50% boost (aggressive)
- **`parameters.format`** (required): Embedding export format (for transparency/documentation)
  - `int8` = 75% smaller than float32, slight accuracy loss (default)
  - `float32` = full precision, no quantization
- **`parameters.embeddings_filename`** (required): Full filename of embeddings file (e.g., `embeddings.i8bin`)
  - Browser uses this to construct the correct URL without inferring extensions
- **`file_hash`** (optional): SHA-256 hash for cache-busting in channel deployments
- **`version`**: Manifest format version
- **`timestamp`**: Build timestamp
- **`artifacts`**: Output file names

## Usage

### Building Embeddings

```bash
# Build with contrast enhancement
python build_embeddings.py --kind unique_artwork --contrast 1.5
```

The `--contrast` parameter is written to `build_manifest.json` automatically.

### Browser Client

The browser client (`apps/web`) automatically reads contrast from the manifest:
- Fetches `build_manifest.json` during initialization
- Validates structure using Zod schema
- Applies the same contrast factor from `parameters.enhance_contrast`
- **No environment variables needed** - everything comes from the manifest

# Environment Configuration

This package now reads configuration from the root `.env.development` file in the monorepo.

## Supported Environment Variables

### `VITE_EMBEDDINGS_FORMAT`
- **Type**: string
- **Default**: `float32`
- **Description**: Format for embeddings (currently used for documentation/manifest)
- **Usage**: Loaded via `get_embeddings_format()` in `config.py`

### `VITE_QUERY_CONTRAST`
- **Type**: float
- **Default**: `1.0` (no enhancement)
- **Description**: Contrast enhancement factor for images during embedding
- **Usage**: Automatically used as default for `--contrast` CLI argument in `build_embeddings.py`
- **Examples**:
  - `1.0` = no enhancement
  - `1.2` = 20% contrast boost (recommended for blurry cards)
  - `1.5` = 50% contrast boost

## How It Works

1. **Root `.env.development`** contains shared configuration:
   ```
   VITE_EMBEDDINGS_FORMAT=float32
   VITE_QUERY_CONTRAST=1.5
   ```

2. **`config.py`** loads these variables:
   - Reads from root `.env.development`
   - Falls back to OS environment variables
   - Provides helper functions: `get_embeddings_format()`, `get_query_contrast()`

3. **`build_embeddings.py`** uses the config:
   - Default `--contrast` value comes from `VITE_QUERY_CONTRAST`
   - Can still be overridden via CLI: `python build_embeddings.py --contrast 1.2`

## Usage Examples

### Use default contrast from `.env.development`
```bash
python build_embeddings.py --kind unique_artwork
```
This will use `VITE_QUERY_CONTRAST=1.5` from the root `.env.development`

### Override contrast via CLI
```bash
python build_embeddings.py --kind unique_artwork --contrast 1.2
```
This overrides the environment variable value

### Set contrast via environment variable
```bash
VITE_QUERY_CONTRAST=1.3 python build_embeddings.py --kind unique_artwork
```
This sets the environment variable before running the script

## Consistency with Web App

The web app (`apps/web`) uses the same environment variables:
- Frontend: `import.meta.env.VITE_QUERY_CONTRAST`
- Backend: `process.env.VITE_QUERY_CONTRAST` (with dotenv)

**Important**: Keep the contrast values in sync between backend and frontend for consistent results:
- Backend builds embeddings with `VITE_QUERY_CONTRAST=1.5`
- Frontend queries with `VITE_QUERY_CONTRAST=1.5`

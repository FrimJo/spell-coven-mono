# Makefile Reference

## Quick Commands

### Standard Build (No Enhancement)

```bash
# Download images only
make download

# Build embeddings only (requires images already cached)
make embed

# Full build (download + embed)
make build-all
```

### Contrast-Enhanced Build (Recommended for Blurry Cards)

```bash
# Build embeddings with 20% contrast boost
make embed-contrast

# Full build with 20% contrast boost (download + embed-contrast)
make build-all-contrast
```

### Aggressive Contrast Enhancement

```bash
# Build embeddings with 50% contrast boost
make embed-contrast-aggressive

# Full build with 50% contrast boost (download + embed-contrast-aggressive)
make build-all-contrast-aggressive
```

### Other Commands

```bash
# Export embeddings for browser (int8 quantized)
make export

# Query the index with an image
make query

# Serve embeddings locally
make serve

# Clean up (remove cache and index)
make clean
```

## Conda Environment Setup

```bash
# Create/update CPU environment
make conda-cpu
# or: make install-cpu

# Create/update GPU environment (NVIDIA CUDA)
make conda-gpu
# or: make install-gpu

# Create/update Apple MPS environment
make conda-mps
# or: make install-mps
```

## Common Workflows

### First-Time Setup with Contrast Enhancement

```bash
# 1. Create environment (choose one)
make conda-mps  # or conda-cpu or conda-gpu

# 2. Activate environment
conda activate mtg-faiss-mps

# 3. Download images
make download

# 4. Build with contrast enhancement
make embed-contrast

# 5. Export for browser
make export
```

### Quick Rebuild with Different Contrast

```bash
# Clean previous build
make clean

# Download again
make download

# Try different contrast level
make embed-contrast-aggressive

# Export
make export
```

### Just Update Embeddings (Keep Images)

```bash
# Rebuild embeddings with new contrast setting
make embed-contrast

# Export
make export
```

## Makefile Targets

| Target | Description | Contrast |
|--------|-------------|----------|
| `download` | Download images from Scryfall | N/A |
| `embed` | Build embeddings from cached images | 1.0 (none) |
| `embed-contrast` | Build embeddings with 20% boost | 1.2 |
| `embed-contrast-aggressive` | Build embeddings with 50% boost | 1.5 |
| `build-all` | Download + embed | 1.0 |
| `build-all-contrast` | Download + embed-contrast | 1.2 |
| `build-all-contrast-aggressive` | Download + embed-contrast-aggressive | 1.5 |
| `build` | Legacy single-step build | 1.0 |
| `export` | Export embeddings for browser | N/A |
| `query` | Query index with image | N/A |
| `serve` | Serve embeddings locally | N/A |
| `clean` | Remove cache and index | N/A |

## Environment Variables

```bash
# Use different Python interpreter
PYTHON=python3 make build-all-contrast

# Use different port for serving
PORT=9000 make serve
```

## Tips

1. **First build takes time**: Images download in parallel (~10-30 min), embedding takes 30-60 min depending on hardware
2. **Resume interrupted downloads**: Just run `make download` again - already cached images are skipped
3. **Try contrast enhancement**: Start with `make build-all-contrast` for typical webcam blur
4. **Check build manifest**: After build, check `index_out/build_manifest.json` to verify contrast setting
5. **Frontend must match**: If you build with `--contrast 1.2`, set `VITE_QUERY_CONTRAST=1.2` in frontend

## Troubleshooting

### "make: command not found"
- Install make: `brew install make` (macOS) or `apt install make` (Linux)

### "python: command not found"
- Use `PYTHON=python3 make build-all-contrast`
- Or activate conda environment first: `conda activate mtg-faiss-mps`

### Build is very slow
- Check if you're using GPU: `PYTHON=python make embed-contrast` (should show GPU in logs)
- Try CPU-only if GPU is causing issues: `conda activate mtg-faiss-cpu`

### Out of memory
- Reduce batch size: `$(PYTHON) build_embeddings.py --batch 64 --contrast 1.2`
- Or use CPU-only environment

## Related Documentation

- Full README: `README.md`
- Contrast enhancement: `CONTRAST_ENHANCEMENT.md`
- Build manifest: `index_out/build_manifest.json` (after build)

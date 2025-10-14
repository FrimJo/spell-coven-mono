# MTG Card Visual Search

This project builds a visual search engine for Magic: The Gathering (MTG) cards.
It downloads Scryfall bulk data, caches full card images, embeds them with CLIP, builds a FAISS index for Python querying, and exports artifacts for a fully in-browser search experience using Transformers.js.

## Documentation

- **Feature Specifications**: See [`/specs/`](../../specs/) for complete requirements and technical details
  - [001: Card Recognition](../../specs/001-enable-mtg-players/) - User requirements, technical plan, data contracts
  - [003: Quality Improvements](../../specs/003-improve-mtg-image/) - Observability, testing, code quality, configuration

## Get Started

- Python 3.10+
- macOS or Linux recommended
- For Python-only search: CPU works, GPU/MPS accelerates embedding.
- For browser search: any modern browser (Chrome/Firefox/Safari). Serve the repo via HTTP.

### 1) Install dependencies (Conda – single source of truth)

This project uses Conda environment files as the single source of truth for dependency versions. Pick one:

```bash
# CPU-only (portable)
conda env create -f environment-cpu.yml  # or: conda env update -f environment-cpu.yml
conda activate mtg-faiss-cpu

# NVIDIA GPU (uses CUDA 12.1 build from pytorch/nvidia channels)
conda env create -f environment-gpu.yml  # or: conda env update -f environment-gpu.yml
conda activate mtg-faiss-gpu

# Apple Silicon (MPS acceleration)
conda env create -f environment-mps.yml  # or: conda env update -f environment-mps.yml
conda activate mtg-faiss-mps
```

#### Choosing CPU vs GPU vs MPS

- **CPU (mtg-faiss-cpu)**
  - Best portability; works on most machines.
  - Slower embedding; acceptable for small/medium subsets or first runs.
- **GPU/CUDA (mtg-faiss-gpu)**
  - Best throughput on NVIDIA GPUs.
  - Requires compatible CUDA drivers and toolkit; follow PyTorch’s install matrix.
- **Apple MPS (mtg-faiss-mps)**
  - Good acceleration on Apple Silicon (M1/M2/M3).
  - Uses Metal Performance Shaders via PyTorch.

## Optional: pip-only setup (not recommended)

You can still use a classic virtualenv and pip, but GPU/MPS setups are more reliable with Conda. You will need to install platform-appropriate PyTorch and FAISS manually.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
# Manually install PyTorch for your platform: https://pytorch.org/get-started/locally/
# Example (CPU only): pip install torch==2.4.1
# Example (CPU FAISS): pip install faiss-cpu==1.7.4
# Then install the rest:
pip install requests==2.32.3 Pillow==10.4.0 numpy==1.26.4 tqdm==4.66.5 git+https://github.com/openai/CLIP.git@a1d4862
```

If you prefer pip-only (not recommended), see the optional section below. The `requirements.txt` file is just a pointer and does not contain pinned packages anymore.

### 2) Build the index

**Two-step process (recommended):**

Step 1: Download and cache images (can be resumed if interrupted):
```bash
python download_images.py --kind unique_artwork --cache image_cache
# Or: make download
```

**New: Parallel download options** (10x+ speedup):
```bash
# Use 16 parallel workers (default)
python download_images.py --kind unique_artwork --workers 16

# Adjust timeouts and retries for unreliable networks
python download_images.py --kind unique_artwork --timeout-connect 10 --timeout-read 60 --max-retries 10

# Conservative mode (slower but more reliable)
python download_images.py --kind unique_artwork --workers 4 --max-retries 10
```

Step 2: Build embeddings and FAISS index from cached images:
```bash
python build_embeddings.py --kind unique_artwork --out index_out --cache image_cache
# Or: make embed
```

**New: HNSW parameter tuning**:
```bash
# Fast build, lower quality (good for testing)
python build_embeddings.py --kind unique_artwork --hnsw-m 16 --hnsw-ef-construction 100

# High quality, slower build (production)
python build_embeddings.py --kind unique_artwork --hnsw-m 64 --hnsw-ef-construction 400

# Default balanced settings
python build_embeddings.py --kind unique_artwork --hnsw-m 32 --hnsw-ef-construction 200
```

**Single-step process (legacy):**
```bash
python build_mtg_faiss.py --kind unique_artwork --out index_out --cache image_cache
# Or: make build
```

**Combined two-step:**
```bash
make build-all  # Runs both download and embed steps
```

Artifacts written:
- `index_out/mtg_embeddings.npy`
- `index_out/mtg_cards.faiss`
- `index_out/mtg_meta.jsonl`

You can limit for quick tests, e.g. `--limit 2000`.

**Benefits of two-step process:**
- Resume downloads if interrupted (images are cached)
- Re-run embedding with different parameters without re-downloading
- Better progress visibility and error handling

### 3) Export for the browser

Converts the `.npy` embeddings to an int8 quantized binary for the browser (75% smaller than float32) and the JSONL to a JSON array with quantization metadata.

```bash
python export_for_browser.py
# Or with custom directories:
python export_for_browser.py --input-dir index_in --output-dir index_out
```

Artifacts written:
- `index_out/embeddings.i8bin` (int8 quantized, ~75% smaller than float32)
- `index_out/meta.json` (includes quantization metadata for browser dequantization)

### 4) Python query example

Query the index with any image:

```bash
python query_index.py image_cache/your_image.jpg
# Or get top-10 results:
python query_index.py image_cache/your_image.jpg --k 10
```

It prints the top-k nearest images by cosine similarity, along with names and URLs.

### 5) Browser UI (moved)

The browser UI and client-side search have moved to the web app documentation.
See `apps/web/README.md` for setup and usage.

## Development Tips

- **Start with a small subset**: add `--limit 2000` to `build_mtg_faiss.py` for faster iterations.
- **Query any image**: pass the image path as an argument to `query_index.py`.
- **Static server**: any static HTTP server works (Node, Python, etc.). Ensure paths like `index_out/meta.json` resolve from project root.
- **Model cache**: the first browser load downloads the CLIP model; subsequent loads are faster due to caching.
- **Troubleshooting devices**: if webcams aren’t listed, grant camera permissions and try `Start Webcam` again; change camera from the dropdown.

## Makefile (optional convenience)

Common tasks are available if you prefer `make` (note: `make install` is deprecated in favor of Conda targets):

```bash
# Two-step build (recommended)
make download   # download and cache images (step 1)
make embed      # build embeddings from cache (step 2)
make build-all  # run both download and embed steps

# Legacy single-step build
make build      # run the index builder (single step)

# Other tasks
make export     # export browser artifacts
make query      # run sample query (edit path in query_index.py)
make serve      # start a static web server
make clean      # remove caches and outputs

# Conda helpers
make conda-cpu  # create/update mtg-faiss-cpu
make conda-gpu  # create/update mtg-faiss-gpu
make conda-mps  # create/update mtg-faiss-mps

# Aliases
make install-cpu  # same as make conda-cpu
make install-gpu  # same as make conda-gpu
make install-mps  # same as make conda-mps
```

## Troubleshooting

### Installation Issues
- **Torch install issues**: Follow the official selector at https://pytorch.org/get-started/locally/
- **FAISS install issues**: Try `faiss-cpu` via conda or consult FAISS docs
- **Large datasets in browser**: `index.html` performs brute-force cosine search; performance may degrade with very large N. Consider smaller subsets or future enhancements like WebGPU or ANN
- **Model download time in browser**: First load may take a bit; subsequent runs are faster due to caching

### Download Issues

**Rate Limiting (HTTP 429)**:
- The system automatically retries with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Default: 5 retries with polite User-Agent header
- If you still hit rate limits, reduce workers: `--workers 4` or `--workers 1`
- Increase retry count: `--max-retries 10`

**Network Timeouts**:
- Default timeouts: 5s connect, 30s read
- For slow networks: `--timeout-connect 10 --timeout-read 60`
- For fast networks: `--timeout-connect 3 --timeout-read 15`

**Interrupted Downloads**:
- Downloads use atomic writes - partial files are automatically cleaned up
- Simply re-run the same command to resume
- Already-cached images are skipped automatically

**API Etiquette**:
- The system includes a polite User-Agent header identifying the tool
- Automatic retry logic respects Scryfall's rate limits
- Default 16 workers is safe for Scryfall's infrastructure
- If unsure, use `--workers 8` for more conservative usage

### Validation Issues

**Corrupted Images**:
```bash
# Validate your cache
python scripts/validate_cache.py --cache image_cache

# Remove corrupted files automatically
python scripts/validate_cache.py --cache image_cache --fix

# Generate validation report
python scripts/validate_cache.py --cache image_cache --report validation_report.json
```

**Validation Failures During Build**:
- By default, corrupted images are detected and excluded automatically
- Check build output for validation failure count
- To skip validation (faster but risky): `--no-validate-cache`
- Validation uses PIL to detect truncated files, HTML error pages, and corrupted data

### Performance Tuning

**Parallel Downloads**:
- Default 16 workers provides ~10x speedup vs sequential
- Adjust based on your network and CPU: `--workers 8` or `--workers 32`
- More workers = faster downloads but more memory and network usage
- Recommended range: 4-32 workers

**HNSW Index Quality vs Speed**:
- **M parameter** (connectivity): Higher = better recall, larger index, slower build
  - Fast: `--hnsw-m 16` (smaller index, faster build, lower recall)
  - Balanced: `--hnsw-m 32` (default, good trade-off)
  - Quality: `--hnsw-m 64` (best recall, slower build)
  - Range: 4-128

- **efConstruction parameter** (build accuracy): Higher = better quality, slower build
  - Fast: `--hnsw-ef-construction 100`
  - Balanced: `--hnsw-ef-construction 200` (default)
  - Quality: `--hnsw-ef-construction 400`
  - Must be >= M parameter

- **Query-time tuning** (without rebuilding):
  - FAISS allows adjusting `efSearch` at query time
  - Higher efSearch = better recall, slower queries
  - See `query_index.py` for examples

**Build Time Optimization**:
- Use parallel downloads: `--workers 16` (default)
- Use appropriate HNSW parameters for your use case
- For testing: `--limit 2000 --hnsw-m 16 --hnsw-ef-construction 100`
- For production: `--hnsw-m 32 --hnsw-ef-construction 200` (default)

### Checkpoint Issues

**Resuming Interrupted Builds**:
- Checkpointing CLI is available but full implementation is pending
- For now, re-run the build command - validation ensures correctness
- Future: Automatic checkpoint every 500 images with `--checkpoint-frequency 500`

### Edge Cases

**Empty Cache**:
- System detects empty cache and exits with clear error message
- Run `download_images.py` first to populate the cache

**Zero Valid Images**:
- System detects when all images fail validation
- Check validation failures in build output
- Run `scripts/validate_cache.py --cache image_cache --fix` to clean cache

**Invalid CLI Arguments**:
- System validates all arguments at startup
- Common issues:
  - `--limit` must be >= 0
  - `--batch` must be >= 1
  - `--size` must be >= 64
  - `--workers` must be between 1 and 128
  - `--hnsw-m` must be between 4 and 128
  - `--hnsw-ef-construction` must be >= `--hnsw-m`

## Project Layout

- `download_images.py` – Step 1: Download and cache images from Scryfall
- `build_embeddings.py` – Step 2: Build embeddings and FAISS index from cache
- `build_mtg_faiss.py` – Legacy single-step build pipeline (download + embed)
- `query_index.py` – Python query using FAISS
- `export_for_browser.py` – Export embeddings/metadata for browser
- `image_cache/` – Cached images
- `index_out/` – Generated artifacts
- `Makefile` – Convenience tasks: `download`, `embed`, `build-all`, `export`, `query`, `serve`, `clean`, and Conda helpers

## License

This repository consumes data and images from Scryfall. Follow Scryfall’s policies when using their API and assets. CLIP model license applies to the chosen implementation. Consult respective licenses for redistribution or commercial use.

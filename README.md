# MTG Card Art Visual Search

This project builds a visual search engine for Magic: The Gathering (MTG) card art.
It downloads Scryfall bulk data, caches images, embeds them with CLIP, builds a FAISS index for Python querying, and exports artifacts for a fully in-browser search experience using Transformers.js.

See the full specification in `SPEC.md`.

## Quick Start

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

Downloads Scryfall bulk data, caches images to `image_cache/`, computes CLIP embeddings, and writes artifacts to `index_out/`.

```bash
python build_mtg_faiss.py --kind unique_artwork --out index_out --cache image_cache
```

Artifacts written:
- `index_out/mtg_embeddings.npy`
- `index_out/mtg_art.faiss`
- `index_out/mtg_meta.jsonl`

You can limit for quick tests, e.g. `--limit 2000`.

### 3) Export for the browser

Converts the `.npy` embeddings to a float16 binary for the browser and the JSONL to a JSON array.

```bash
python export_for_browser.py
```

Artifacts written:
- `index_out/embeddings.f16bin`
- `index_out/meta.json`

### 4) Python query example

Edit `query_index.py` to point `query_path` to an image (e.g. from `image_cache/`), then run:

```bash
python query_index.py
```

It prints the top-5 nearest images by cosine similarity, along with names and URLs.

### 5) Browser UI

Serve the repository over HTTP (so `fetch()` can read the exported files) and open `index.html`:

```bash
# from project root
python -m http.server 8000
# open http://localhost:8000/index.html
```

- Click “Choose file” to select a card or cropped art.
- The CLIP model (`Xenova/clip-vit-base-patch32`) runs fully in your browser.
- Top matches are shown with thumbnails and Scryfall links.

## Makefile (optional convenience)

Common tasks are available if you prefer `make` (note: `make install` is deprecated in favor of Conda targets):

```bash
make build     # run the index builder
make export    # export browser artifacts
make query     # run sample query (edit path in query_index.py)
make serve     # start a static web server
make clean     # remove caches and outputs

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

- Torch install issues: follow the official selector at https://pytorch.org/get-started/locally/
- FAISS install issues: try `faiss-cpu` via conda or consult FAISS docs.
- Large datasets in browser: `index.html` performs a brute-force cosine search; performance may degrade with very large N. Consider smaller subsets, or future enhancements like WebGPU or ANN.
- Model download time in browser: first load may take a bit; subsequent runs are faster due to caching.

## Project Layout

- `build_mtg_faiss.py` – Build pipeline (download, cache, embed, FAISS, metadata)
- `query_index.py` – Python query using FAISS
- `export_for_browser.py` – Export embeddings/metadata for browser
- `index.html` – Browser-only search UI (Transformers.js)
- `index_old.html` – Experimental webcam + OpenCV.js + OCR prototype
- `image_cache/` – Cached images
- `index_out/` – Generated artifacts
- `SPEC.md` – Specification, requirements, acceptance criteria

## License

This repository consumes data and images from Scryfall. Follow Scryfall’s policies when using their API and assets. CLIP model license applies to the chosen implementation. Consult respective licenses for redistribution or commercial use.

.PHONY: install build build-all download embed embed-contrast embed-contrast-aggressive build-all-contrast build-all-contrast-aggressive export test query serve clean conda-cpu conda-gpu conda-mps install-cpu install-gpu install-mps

PYTHON ?= python
PORT ?= 8000

install:
	@echo "[DEPRECATED] Use Conda environments instead:" && \
	echo "  make conda-cpu   # create/update CPU env (mtg-faiss-cpu)" && \
	echo "  make conda-gpu   # create/update NVIDIA CUDA env (mtg-faiss-gpu)" && \
	echo "  make conda-mps   # create/update Apple MPS env (mtg-faiss-mps)" && \
	echo "See README.md for details." && \
	false

# Two-step build process (recommended)
download:
	$(PYTHON) download_images.py --kind unique_artwork --cache image_cache

embed:
	$(PYTHON) build_embeddings.py --kind unique_artwork --out index_out --cache image_cache --contrast 1.5

export:
	$(PYTHON) export_for_browser.py --input-dir index_out --output-dir index_out

test:
	conda run -n mtg-faiss-mps $(PYTHON) test_perfect_match.py

query:
	@echo "Usage: $(PYTHON) query_index.py <image_path> [--k N]"
	@echo "Example: $(PYTHON) query_index.py image_cache/your_image.jpg --k 5"

serve:
	@echo "Serving on http://localhost:$(PORT)"
	$(PYTHON) -m http.server $(PORT)

clean:
	rm -rf image_cache
	rm -rf index_out

# Conda helpers
conda-cpu:
	conda env update -f environment-cpu.yml || conda env create -f environment-cpu.yml

conda-gpu:
	conda env update -f environment-gpu.yml || conda env create -f environment-gpu.yml

conda-mps:
	conda env update -f environment-mps.yml || conda env create -f environment-mps.yml

# Aliases
install-cpu: conda-cpu
install-gpu: conda-gpu
install-mps: conda-mps

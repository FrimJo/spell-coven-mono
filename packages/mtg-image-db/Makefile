.PHONY: install build export query serve clean conda-cpu conda-gpu conda-mps install-cpu install-gpu install-mps

PYTHON ?= python
PORT ?= 8000

install:
	@echo "[DEPRECATED] Use Conda environments instead:" && \
	echo "  make conda-cpu   # create/update CPU env (mtg-faiss-cpu)" && \
	echo "  make conda-gpu   # create/update NVIDIA CUDA env (mtg-faiss-gpu)" && \
	echo "  make conda-mps   # create/update Apple MPS env (mtg-faiss-mps)" && \
	echo "See README.md for details." && \
	false

build:
	$(PYTHON) build_mtg_faiss.py --kind unique_artwork --out index_out --cache image_cache

export:
	$(PYTHON) export_for_browser.py

query:
	$(PYTHON) query_index.py

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

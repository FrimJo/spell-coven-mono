.PHONY: install build export query serve clean

PYTHON ?= python3
PORT ?= 8000

install:
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -r requirements.txt

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
	rm -rf image_cache/*
	rm -rf index_out/*

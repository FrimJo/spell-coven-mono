#!/usr/bin/env python3
"""
Build FAISS index from cached images.
This is step 2 of the build process - run after download_images.py
"""
import argparse, io, json, gzip, glob
from pathlib import Path
from typing import List, Dict, Optional
import numpy as np
from tqdm import tqdm
import faiss

# Import helpers from build script
import sys
sys.path.insert(0, str(Path(__file__).parent))
from build_mtg_faiss import (
    load_bulk,
    face_image_urls,
    safe_filename,
    load_image_rgb,
    Embedder
)


def build_embeddings_from_cache(
    kind: str,
    out_dir: Path,
    cache_dir: Path,
    limit: int = None,
    batch_size: int = 64,
    target_size: int = 384
):
    """Build FAISS index from already-cached images."""
    out_dir.mkdir(parents=True, exist_ok=True)
    
    if not cache_dir.exists():
        raise SystemExit(
            f"Cache directory {cache_dir} does not exist.\n"
            f"Run download_images.py first to cache images."
        )
    
    print(f"Loading Scryfall bulk '{kind}' for metadata...")
    cards = load_bulk(kind)
    print(f"Cards in bulk file: {len(cards):,}")
    
    # Gather metadata (same as download step)
    records: List[Dict] = []
    for c in cards:
        for name, card_img_url, display_url, face_id in face_image_urls(c):
            records.append({
                "name": name,
                "scryfall_id": c.get("id"),
                "face_id": face_id,
                "set": c.get("set"),
                "collector_number": c.get("collector_number"),
                "frame": c.get("frame"),
                "layout": c.get("layout"),
                "lang": c.get("lang"),
                "colors": c.get("colors"),
                "image_url": card_img_url,
                "card_url": display_url,
                "scryfall_uri": c.get("scryfall_uri"),
            })
    
    if limit:
        records = records[:limit]
        print(f"Limited to {limit} faces")
    
    print(f"Total faces to embed: {len(records):,}")
    
    # Check which images are cached
    paths: List[Optional[Path]] = []
    missing = 0
    for rec in records:
        cache_file = cache_dir / safe_filename(rec["image_url"])
        if cache_file.exists() and cache_file.stat().st_size > 0:
            paths.append(cache_file)
        else:
            paths.append(None)
            missing += 1
    
    if missing > 0:
        print(f"⚠️  Warning: {missing} images not found in cache")
        print(f"   Run download_images.py again to cache missing images")
    
    # Load + embed
    print(f"Initializing CLIP model...")
    embedder = Embedder()
    vecs = np.zeros((len(records), 512), dtype="float32")
    good = np.zeros((len(records),), dtype=bool)
    
    batch_imgs, batch_idx = [], []
    for i, p in enumerate(tqdm(paths, desc="Embedding")):
        if p is None:
            continue
        img = load_image_rgb(p, target_size=target_size)
        batch_imgs.append(img)
        batch_idx.append(i)
        if len(batch_imgs) == batch_size:
            Z = embedder.encode_images(batch_imgs)
            for local, global_i in enumerate(batch_idx):
                if batch_imgs[local] is not None and Z.shape[0] > local:
                    vecs[global_i] = Z[local]
                    good[global_i] = True
            batch_imgs, batch_idx = [], []
    
    # flush
    if batch_imgs:
        Z = embedder.encode_images(batch_imgs)
        for local, global_i in enumerate(batch_idx):
            if batch_imgs[local] is not None and Z.shape[0] > local:
                vecs[global_i] = Z[local]
                good[global_i] = True
    
    kept = np.where(good)[0]
    X = vecs[kept]
    meta = [records[i] for i in kept]
    print(f"Embedded {X.shape[0]:,} / {len(records):,} faces")
    
    # Save embeddings for browser export / fallback searchers
    np.save(out_dir / "mtg_embeddings.npy", X)
    print(f"Saved raw embeddings to {out_dir/'mtg_embeddings.npy'}")
    
    # Build FAISS index with HNSW for speed (vectors already L2-normalized)
    d = X.shape[1]
    # M=64 for better recall, efConstruction=400 for high accuracy
    hnsw_index = faiss.IndexHNSWFlat(d, 64)
    hnsw_index.hnsw.efConstruction = 400
    index = faiss.IndexIDMap(hnsw_index)
    index.add_with_ids(X, np.arange(X.shape[0]).astype("int64"))
    faiss.write_index(index, str(out_dir / "mtg_cards.faiss"))
    print(f"Saved HNSW index (M=64, efConstruction=400) to {out_dir/'mtg_cards.faiss'}")
    
    # Save metadata line-by-line (easy to stream later)
    meta_path = out_dir / "mtg_meta.jsonl"
    with open(meta_path, "w", encoding="utf-8") as f:
        for m in meta:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")
    print(f"Saved metadata for {len(meta)} vectors to {meta_path}")
    
    print(f"\n=== Build Summary ===")
    print(f"Total records: {len(records):,}")
    print(f"Missing from cache: {missing:,} ({missing/len(records)*100:.1f}%)")
    print(f"Successfully indexed: {X.shape[0]:,} ({X.shape[0]/len(records)*100:.1f}%)")
    print(f"\nNext step: Run export_for_browser.py to create browser assets")


def main():
    ap = argparse.ArgumentParser(
        description="Build FAISS index from cached images (Step 2 of 2)"
    )
    ap.add_argument("--kind", default="unique_artwork",
                    choices=["unique_artwork", "default_cards", "all_cards"],
                    help="Which Scryfall bulk to use.")
    ap.add_argument("--out", default="index_out", 
                    help="Directory to write index + metadata.")
    ap.add_argument("--cache", default="image_cache", 
                    help="Directory with cached images.")
    ap.add_argument("--limit", type=int, default=None, 
                    help="Limit number of faces (for testing).")
    ap.add_argument("--batch", type=int, default=64, 
                    help="Embedding batch size.")
    ap.add_argument("--size", type=int, default=384, 
                    help="Square resize for images before CLIP preprocess.")
    args = ap.parse_args()
    
    build_embeddings_from_cache(
        kind=args.kind,
        out_dir=Path(args.out),
        cache_dir=Path(args.cache),
        limit=args.limit,
        batch_size=args.batch,
        target_size=args.size
    )


if __name__ == "__main__":
    main()

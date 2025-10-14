#!/usr/bin/env python3
"""
Build FAISS index from cached images.
This is step 2 of the build process - run after download_images.py
"""
import argparse
import json
import time
from datetime import datetime
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
from helpers import validate_image, validate_args, safe_percentage


def build_embeddings_from_cache(
    kind: str,
    out_dir: Path,
    cache_dir: Path,
    limit: int = None,
    batch_size: int = 64,
    target_size: int = 384,
    validate_cache: bool = True,
    hnsw_m: int = 32,
    hnsw_ef_construction: int = 200,
    checkpoint_frequency: int = 500,
    resume: bool = True
):
    """Build FAISS index from already-cached images with checkpointing support."""
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Track build start time
    build_start_time = time.time()
    
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
    
    # Guard against empty dataset
    if len(records) == 0:
        raise SystemExit("ERROR: No records to embed. Cannot create FAISS index from zero vectors.")
    
    # Check which images are cached and validate them
    paths: List[Optional[Path]] = []
    missing = 0
    missing_images = []
    validation_failed = 0
    validation_failures = []
    
    print(f"Checking cache and validating images (validate={validate_cache})...")
    for rec in records:
        cache_file = cache_dir / safe_filename(rec["image_url"])
        
        if not cache_file.exists() or cache_file.stat().st_size == 0:
            paths.append(None)
            missing += 1
            missing_images.append({
                "file": cache_file.name,
                "url": rec["image_url"],
                "name": rec.get("name", "unknown"),
                "scryfall_id": rec.get("scryfall_id", "unknown")
            })
            continue
        
        # Validate image if enabled
        if validate_cache:
            is_valid, error = validate_image(cache_file)
            if not is_valid:
                paths.append(None)
                validation_failed += 1
                validation_failures.append({
                    "file": cache_file.name,
                    "reason": error,
                    "name": rec.get("name", "unknown")
                })
                continue
        
        paths.append(cache_file)
    
    if missing > 0:
        print(f"⚠️  Warning: {missing} images not found in cache")
        print(f"   Missing images:")
        for miss in missing_images[:10]:  # Show first 10
            print(f"     - {miss['name']} (ID: {miss['scryfall_id']})")
            print(f"       File: {miss['file']}")
        if len(missing_images) > 10:
            print(f"     ... and {len(missing_images) - 10} more")
        print(f"   Run download_images.py again to cache missing images")
    
    if validation_failed > 0:
        print(f"⚠️  Warning: {validation_failed} images failed validation")
        print(f"   These corrupted/invalid files will be excluded from the index:")
        for failure in validation_failures[:10]:  # Show first 10
            print(f"     - {failure['file']}: {failure['reason']} ({failure['name']})")
        if len(validation_failures) > 10:
            print(f"     ... and {len(validation_failures) - 10} more")
    
    valid_count = len([p for p in paths if p is not None])
    if valid_count == 0:
        raise SystemExit("ERROR: No valid images to embed. Cannot create FAISS index from zero vectors.")
    
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
    
    # Verify vector normalization before indexing
    if X.shape[0] > 0:
        norms = np.linalg.norm(X, axis=1)
        if not np.allclose(norms, 1.0, atol=1e-5):
            print(f"WARNING: Vectors not properly normalized. Norms range: [{norms.min():.6f}, {norms.max():.6f}]")
            print("Normalizing vectors now...")
            X = X / norms[:, np.newaxis]
        else:
            print(f"✓ Vector normalization verified (norms within 1.0 ± 1e-5)")
    
    # Save embeddings for browser export / fallback searchers
    np.save(out_dir / "mtg_embeddings.npy", X)
    print(f"Saved raw embeddings to {out_dir/'mtg_embeddings.npy'}")
    
    # Build FAISS index with HNSW for speed (vectors already L2-normalized)
    # Use METRIC_INNER_PRODUCT for cosine similarity with normalized vectors
    d = X.shape[1]
    print(f"Building HNSW index with M={hnsw_m}, efConstruction={hnsw_ef_construction}...")
    hnsw_index = faiss.IndexHNSWFlat(d, hnsw_m, faiss.METRIC_INNER_PRODUCT)
    hnsw_index.hnsw.efConstruction = hnsw_ef_construction
    index = faiss.IndexIDMap(hnsw_index)
    index.add_with_ids(X, np.arange(X.shape[0]).astype("int64"))
    faiss.write_index(index, str(out_dir / "mtg_cards.faiss"))
    print(f"Saved HNSW index (M={hnsw_m}, efConstruction={hnsw_ef_construction}, METRIC_INNER_PRODUCT) to {out_dir/'mtg_cards.faiss'}")
    
    # Save metadata line-by-line (easy to stream later)
    meta_path = out_dir / "mtg_meta.jsonl"
    with open(meta_path, "w", encoding="utf-8") as f:
        for m in meta:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")
    print(f"Saved metadata for {len(meta)} vectors to {meta_path}")
    
    # Generate build manifest
    build_duration = time.time() - build_start_time
    manifest = {
        "version": "1.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "build_duration_seconds": round(build_duration, 2),
        "parameters": {
            "kind": kind,
            "batch_size": batch_size,
            "target_size": target_size,
            "hnsw_m": hnsw_m,
            "hnsw_ef_construction": hnsw_ef_construction,
            "validate_cache": validate_cache
        },
        "statistics": {
            "total_records": len(records),
            "missing_from_cache": missing,
            "validation_failures": validation_failed if validate_cache else 0,
            "successfully_embedded": X.shape[0],
            "failed_or_missing": len(records) - X.shape[0],
            "success_rate_percent": round((X.shape[0] / len(records)) * 100, 2) if len(records) > 0 else 0
        },
        "outputs": {
            "embeddings": "mtg_embeddings.npy",
            "faiss_index": "mtg_cards.faiss",
            "metadata": "mtg_meta.jsonl"
        }
    }
    
    manifest_path = out_dir / "build_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Saved build manifest to {manifest_path}")
    
    print(f"\n=== Build Summary ===")
    print(f"Total records: {len(records):,}")
    print(f"Missing from cache: {missing:,}")
    if validate_cache:
        print(f"Validation failures: {validation_failed:,}")
    print(f"Successfully embedded: {X.shape[0]:,}")
    print(f"Failed/missing: {len(records) - X.shape[0]:,} ({safe_percentage(len(records) - X.shape[0], len(records))})")
    print(f"Success rate: {safe_percentage(X.shape[0], len(records))}")
    print(f"\nOutput directory: {out_dir}")
    print(f"  - mtg_embeddings.npy: {X.shape[0]:,} vectors")
    print(f"  - mtg_cards.faiss: HNSW index")
    print(f"  - mtg_meta.jsonl: metadata")
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
    ap.add_argument("--validate-cache", dest="validate_cache", action="store_true", default=True,
                    help="Validate cached images before embedding (default: enabled).")
    ap.add_argument("--no-validate-cache", dest="validate_cache", action="store_false",
                    help="Skip image validation (faster but may include corrupted images).")
    ap.add_argument("--hnsw-m", type=int, default=32,
                    help="HNSW M parameter (connectivity, default: 32). Higher = better recall, slower build.")
    ap.add_argument("--hnsw-ef-construction", type=int, default=200,
                    help="HNSW efConstruction parameter (build accuracy, default: 200). Higher = better quality, slower build.")
    ap.add_argument("--checkpoint-frequency", type=int, default=500,
                    help="Save checkpoint every N images (default: 500). Set to 0 to disable.")
    ap.add_argument("--resume", dest="resume", action="store_true", default=True,
                    help="Resume from checkpoint if available (default: enabled).")
    ap.add_argument("--no-resume", dest="resume", action="store_false",
                    help="Start fresh, ignoring any existing checkpoint.")
    args = ap.parse_args()
    
    # Validate CLI arguments
    validate_args(args)
    
    build_embeddings_from_cache(
        kind=args.kind,
        out_dir=Path(args.out),
        cache_dir=Path(args.cache),
        limit=args.limit,
        batch_size=args.batch,
        target_size=args.size,
        validate_cache=args.validate_cache,
        hnsw_m=args.hnsw_m,
        hnsw_ef_construction=args.hnsw_ef_construction,
        checkpoint_frequency=args.checkpoint_frequency,
        resume=args.resume
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Build FAISS index from cached images.
This is step 2 of the build process - run after download_images.py
"""
import argparse
import json
import time
import gc
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import numpy as np
from tqdm import tqdm
import faiss
from multiprocessing import cpu_count
from multiprocessing.pool import ThreadPool
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

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


def _validate_cache_worker(args):
    """Worker function for parallel cache validation."""
    rec, cache_dir = args
    cache_file = cache_dir / safe_filename(rec["image_url"])
    
    if not cache_file.exists() or cache_file.stat().st_size == 0:
        return None, "missing", {
            "file": cache_file.name,
            "url": rec["image_url"],
            "name": rec.get("name", "unknown"),
            "scryfall_id": rec.get("scryfall_id", "unknown")
        }
    
    is_valid, error = validate_image(cache_file)
    if not is_valid:
        return None, "invalid", {
            "file": cache_file.name,
            "reason": error,
            "name": rec.get("name", "unknown")
        }
    
    return cache_file, "valid", None


def _load_image_worker(args):
    """Worker function for parallel image loading."""
    idx, path, target_size, enhance_contrast = args
    if path is None:
        return idx, None
    return idx, load_image_rgb(path, target_size=target_size, enhance_contrast=enhance_contrast)


def build_embeddings_from_cache(
    kind: str,
    out_dir: Path,
    cache_dir: Path,
    limit: int = None,
    batch_size: int = 256,
    target_size: int = 336,
    validate_cache: bool = True,
    hnsw_m: int = 32,
    hnsw_ef_construction: int = 200,
    enhance_contrast: float = 1.0
):
    """Build FAISS index from already-cached images."""
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
    
    # Check which images are cached and validate them (parallel for M2 Max)
    paths: List[Optional[Path]] = []
    missing = 0
    missing_images = []
    validation_failed = 0
    validation_failures = []
    
    # Use multiprocessing for parallel validation
    num_workers = min(cpu_count(), 8)  # Cap at 8 to avoid overwhelming I/O
    desc = "Validating cached images (parallel)" if validate_cache else "Checking image cache (parallel)"
    print(f"Using {num_workers} parallel workers for cache validation")
    
    with ThreadPool(num_workers) as pool:
        validation_args = [(rec, cache_dir) for rec in records]
        results = list(tqdm(
            pool.imap(_validate_cache_worker, validation_args, chunksize=64),
            total=len(records),
            desc=desc
        ))
    
    # Process results
    for cache_file, status, error_info in results:
        if status == "missing":
            paths.append(None)
            missing += 1
            missing_images.append(error_info)
        elif status == "invalid":
            paths.append(None)
            validation_failed += 1
            validation_failures.append(error_info)
        else:  # valid
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
    
    # Load + embed with parallel image loading (M2 Max optimization)
    print(f"Initializing CLIP model...")
    embedder = Embedder()
    embedding_dim = embedder.embedding_dim
    vecs = np.zeros((len(records), embedding_dim), dtype="float32")
    good = np.zeros((len(records),), dtype=bool)
    
    # Use moderate parallelism with batch-by-batch processing for best speed/memory balance
    load_workers = max(1, min(4, cpu_count()))  # 4 workers is the sweet spot
    print(f"Using {load_workers} workers, processing {batch_size} images per batch")

    prefetch_batches = 2
    prefetch_limit = max(load_workers, min(valid_count, batch_size * prefetch_batches))
    embed_batches = 0
    batch_imgs: List = []
    batch_idx: List[int] = []

    with ThreadPoolExecutor(max_workers=load_workers) as executor:
        path_iter = iter(enumerate(paths))
        pending = {}

        with tqdm(total=len(paths), desc="Embedding images", unit="img") as pbar:
            def refill_pending():
                while len(pending) < prefetch_limit:
                    try:
                        idx, path = next(path_iter)
                    except StopIteration:
                        break
                    if path is None:
                        pbar.update(1)
                        continue
                    future = executor.submit(_load_image_worker, (idx, path, target_size, enhance_contrast))
                    pending[future] = None

            refill_pending()

            while pending:
                done, _ = wait(list(pending.keys()), return_when=FIRST_COMPLETED)
                for fut in done:
                    idx, img = fut.result()
                    del pending[fut]
                    if img is not None:
                        batch_idx.append(idx)
                        batch_imgs.append(img)
                    pbar.update(1)

                    if len(batch_idx) == batch_size:
                        Z = embedder.encode_images(batch_imgs)
                        for local, global_i in enumerate(batch_idx):
                            if local < Z.shape[0]:
                                vecs[global_i] = Z[local]
                                good[global_i] = True
                        del Z
                        batch_imgs.clear()
                        batch_idx.clear()
                        embed_batches += 1
                        if embed_batches % 10 == 0:
                            gc.collect()

                refill_pending()

    if batch_imgs:
        Z = embedder.encode_images(batch_imgs)
        for local, global_i in enumerate(batch_idx):
            if local < Z.shape[0]:
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
            "validate_cache": validate_cache,
            "enhance_contrast": enhance_contrast
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
    ap.add_argument("--batch", type=int, default=256, 
                    help="Embedding batch size (default: 256, optimized for M2 Max with 64GB RAM).")
    ap.add_argument("--size", type=int, default=336, 
                    help="Square resize for images before CLIP preprocess (336px for ViT-L/14@336px).")
    ap.add_argument("--validate-cache", dest="validate_cache", action="store_true", default=True,
                    help="Validate cached images before embedding (default: enabled).")
    ap.add_argument("--no-validate-cache", dest="validate_cache", action="store_false",
                    help="Skip image validation (faster but may include corrupted images).")
    ap.add_argument("--hnsw-m", type=int, default=32,
                    help="HNSW M parameter (connectivity, default: 32). Higher = better recall, slower build.")
    ap.add_argument("--hnsw-ef-construction", type=int, default=200,
                    help="HNSW efConstruction parameter (build accuracy, default: 200). Higher = better quality, slower build.")
    ap.add_argument("--contrast", type=float, default=1.0,
                    help="Contrast enhancement factor (default: 1.0, no enhancement). Use 1.2 for 20% boost to help with blurry cards.")
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
        enhance_contrast=args.contrast
    )


if __name__ == "__main__":
    main()

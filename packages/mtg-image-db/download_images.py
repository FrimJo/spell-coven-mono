#!/usr/bin/env python3
"""
Download and cache MTG card images from Scryfall.
This is step 1 of the build process - run before build_embeddings.py
"""
import argparse, io, json, gzip
from pathlib import Path
from typing import List, Dict
import requests
from tqdm import tqdm

# Import helpers from build script
import sys
sys.path.insert(0, str(Path(__file__).parent))
from build_mtg_faiss import (
    get_bulk_download_uri,
    load_bulk,
    face_image_urls,
    download_image
)


def download_all_images(
    kind: str,
    cache_dir: Path,
    limit: int = None
):
    """Download all card images and save metadata for later embedding."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Loading Scryfall bulk '{kind}' ...")
    cards = load_bulk(kind)
    print(f"Cards in bulk file: {len(cards):,}")
    
    # Gather metadata
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
    
    print(f"Total faces to download: {len(records):,}")
    
    # Download images
    failed = 0
    for rec in tqdm(records, desc="Downloading images"):
        p = download_image(rec["image_url"], cache_dir)
        if p is None:
            failed += 1
    
    print(f"\n=== Download Summary ===")
    print(f"Total faces: {len(records):,}")
    print(f"Successfully cached: {len(records) - failed:,}")
    print(f"Failed downloads: {failed:,} ({failed/len(records)*100:.1f}%)")
    print(f"\nImages cached in: {cache_dir}")
    print(f"Next step: Run build_embeddings.py to create the index")


def main():
    ap = argparse.ArgumentParser(
        description="Download and cache MTG card images from Scryfall (Step 1 of 2)"
    )
    ap.add_argument("--kind", default="unique_artwork",
                    choices=["unique_artwork", "default_cards", "all_cards"],
                    help="Which Scryfall bulk to use.")
    ap.add_argument("--cache", default="image_cache", 
                    help="Directory to cache downloaded images.")
    ap.add_argument("--limit", type=int, default=None, 
                    help="Limit number of faces (for testing).")
    args = ap.parse_args()
    
    download_all_images(
        kind=args.kind,
        cache_dir=Path(args.cache),
        limit=args.limit
    )


if __name__ == "__main__":
    main()

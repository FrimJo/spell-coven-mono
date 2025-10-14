#!/usr/bin/env python3
"""
Download and cache MTG card images from Scryfall.
This is step 1 of the build process - run before build_embeddings.py
"""
import argparse
from pathlib import Path
from typing import List, Dict, Optional
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import helpers from build script
import sys
sys.path.insert(0, str(Path(__file__).parent))
from build_mtg_faiss import (
    get_bulk_download_uri,
    load_bulk,
    face_image_urls,
    safe_filename
)
from helpers import DownloadSession, atomic_write_stream, validate_args, safe_percentage


def download_single_image(
    url: str,
    cache_dir: Path,
    session: DownloadSession
) -> tuple[Optional[Path], Optional[str]]:
    """
    Download a single image using the shared session with retry logic.
    
    Args:
        url: Image URL to download
        cache_dir: Directory to cache the image
        session: Shared DownloadSession with retry logic
    
    Returns:
        Tuple of (Path to cached file if successful, error message if failed)
    """
    fp = cache_dir / safe_filename(url)
    
    # Skip if already cached with valid size
    if fp.exists() and fp.stat().st_size > 0:
        return (fp, None)
    
    # Clean up empty/corrupted files from previous failed attempts
    if fp.exists() and fp.stat().st_size == 0:
        fp.unlink()
    
    try:
        response = session.get(url, stream=True)
        response.raise_for_status()
        
        # Write atomically to prevent partial files
        if atomic_write_stream(fp, response.iter_content(16384)):
            return (fp, None)
        else:
            return (None, "Failed to write file")
    
    except Exception as e:
        return (None, str(e))


def download_all_images(
    kind: str,
    cache_dir: Path,
    limit: int = None,
    workers: int = 16,
    timeout_connect: int = 5,
    timeout_read: int = 30,
    max_retries: int = 5
):
    """Download all card images with parallel workers and retry logic."""
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
    
    # Guard against empty dataset
    if len(records) == 0:
        print("No records to download.")
        return
    
    # Create shared session with retry logic
    print(f"Initializing download session (workers={workers}, max_retries={max_retries})")
    with DownloadSession(
        max_retries=max_retries,
        timeout_connect=timeout_connect,
        timeout_read=timeout_read
    ) as session:
        # Download images in parallel
        failed = 0
        succeeded = 0
        failed_downloads = []
        
        with ThreadPoolExecutor(max_workers=workers) as executor:
            # Submit all download tasks
            futures = {
                executor.submit(download_single_image, rec["image_url"], cache_dir, session): rec
                for rec in records
            }
            
            # Process results with progress bar
            with tqdm(total=len(records), desc="Downloading images") as pbar:
                for future in as_completed(futures):
                    rec = futures[future]
                    result_path, error = future.result()
                    if result_path is None:
                        failed += 1
                        failed_downloads.append({
                            "name": rec.get("name", "unknown"),
                            "scryfall_id": rec.get("scryfall_id", "unknown"),
                            "url": rec["image_url"],
                            "error": error or "Unknown error"
                        })
                    else:
                        succeeded += 1
                    pbar.update(1)
    
    print(f"\n=== Download Summary ===")
    print(f"Total faces: {len(records):,}")
    print(f"Successfully cached: {succeeded:,}")
    print(f"Failed downloads: {failed:,} ({safe_percentage(failed, len(records))})")
    if failed > 0:
        print(f"\nFailed downloads:")
        for fail in failed_downloads[:10]:  # Show first 10
            print(f"  - {fail['name']} (ID: {fail['scryfall_id']})")
            print(f"    Error: {fail['error']}")
        if len(failed_downloads) > 10:
            print(f"  ... and {len(failed_downloads) - 10} more failures")
    print(f"Success rate: {safe_percentage(succeeded, len(records))}")
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
    ap.add_argument("--workers", type=int, default=16,
                    help="Number of parallel download workers (default: 16).")
    ap.add_argument("--timeout-connect", type=int, default=5,
                    help="Connection timeout in seconds (default: 5).")
    ap.add_argument("--timeout-read", type=int, default=30,
                    help="Read timeout in seconds (default: 30).")
    ap.add_argument("--max-retries", type=int, default=5,
                    help="Maximum retry attempts for failed downloads (default: 5).")
    args = ap.parse_args()
    
    # Validate CLI arguments
    validate_args(args)
    
    download_all_images(
        kind=args.kind,
        cache_dir=Path(args.cache),
        limit=args.limit,
        workers=args.workers,
        timeout_connect=args.timeout_connect,
        timeout_read=args.timeout_read,
        max_retries=args.max_retries
    )


if __name__ == "__main__":
    main()

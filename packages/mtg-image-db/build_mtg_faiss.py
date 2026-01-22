#!/usr/bin/env python3
import argparse, io, json, os, sys, time, gzip, hashlib, threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import requests
from PIL import Image, UnidentifiedImageError
import numpy as np
from tqdm import tqdm

import torch
import clip  # from openai/CLIP
import faiss

# Import validation helpers
sys.path.insert(0, str(Path(__file__).parent))
from helpers import validate_image, validate_args, safe_percentage


# ------------------------- Helpers -------------------------

def get_bulk_download_uri(kind: str) -> str:
    """kind in {"unique_artwork", "default_cards", "all_cards"}"""
    r = requests.get("https://api.scryfall.com/bulk-data", timeout=30)
    r.raise_for_status()
    data = r.json()["data"]
    for item in data:
        if item["type"] == kind:
            return item["download_uri"]
    raise ValueError(f"Bulk type '{kind}' not found. Available: {[d['type'] for d in data]}")

def load_bulk(kind: str) -> List[dict]:
    url = get_bulk_download_uri(kind)
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    raw = r.content
    if url.endswith(".gz"):
        raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
    cards = json.loads(raw)
    return cards

def face_image_urls(card: dict):
    out = []
    def pick_card_image(uris):
        # Prefer higher-res sources for better embedding accuracy.
        # "normal" is a good balance; fall back to larger sizes if needed.
        return uris.get("png") or uris.get("large") or uris.get("normal") or uris.get("small") or uris.get("border_crop")

    if "image_uris" in card:
        card_url = pick_card_image(card["image_uris"])
        if card_url:
            out.append((card["name"], card_url, card_url, card.get("id")))

    for i, f in enumerate(card.get("card_faces", [])):
        if "image_uris" in f:
            card_url = pick_card_image(f["image_uris"])
            if card_url:
                name = f.get("name") or card["name"]
                face_id = (card.get("id") or "") + f":face:" + str(i)
                out.append((name, card_url, card_url, face_id))
    return out

def safe_filename(url: str) -> str:
    # stable cache name independent of query params
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()
    ext = ".jpg"
    if ".png" in url.lower():
        ext = ".png"
    return f"{h}{ext}"

def download_image(url: str, cache_dir: Path, retries: int = 3, timeout: int = 20, session: Optional['DownloadSession'] = None) -> Optional[Path]:
    """
    Download image with retry logic and atomic writes.

    Args:
        url: Image URL to download
        cache_dir: Directory to cache the image
        retries: Number of retry attempts (deprecated, use session)
        timeout: Timeout in seconds (deprecated, use session)
        session: Optional DownloadSession with configured retry logic

    Returns:
        Path to cached file if successful, None otherwise
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    fp = cache_dir / safe_filename(url)

    # Skip if already cached
    if fp.exists() and fp.stat().st_size > 0:
        return fp

    # Use session if provided (new robust path)
    if session is not None:
        try:
            from helpers import atomic_write_stream
            response = session.get(url, stream=True)
            response.raise_for_status()

            if atomic_write_stream(fp, response.iter_content(16384)):
                return fp
            else:
                return None
        except Exception:
            return None

    # Legacy fallback path (for compatibility)
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, timeout=timeout, stream=True)
            r.raise_for_status()
            with open(fp, "wb") as f:
                for chunk in r.iter_content(1 << 14):
                    if chunk:
                        f.write(chunk)
            return fp
        except Exception:
            if attempt == retries:
                return None
            time.sleep(0.8 * attempt)
    return None

def load_image_rgb(path: Path, target_size: int = 224, enhance_contrast: float = 1.0) -> Optional[Image.Image]:
    try:
        img = Image.open(path).convert("RGB")

        # Enhance contrast if requested (helps with blurry cards)
        if enhance_contrast > 1.0:
            from PIL import ImageEnhance
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(enhance_contrast)

        # Pad to square with black borders to preserve all card information
        # (card name, mana cost, text box, P/T are important for detection)
        w, h = img.size
        s = max(w, h)

        # Create black canvas and center the card
        padded = Image.new("RGB", (s, s), (0, 0, 0))
        paste_x = (s - w) // 2
        paste_y = (s - h) // 2
        padded.paste(img, (paste_x, paste_y))

        # Resize to target size
        if s != target_size:
            padded = padded.resize((target_size, target_size), Image.BICUBIC)
        return padded
    except (UnidentifiedImageError, OSError):
        return None

# ------------------------- Embeddings -------------------------

class Embedder:
    def __init__(self, device: str = None):
        if torch.backends.mps.is_available():
          self.device = "mps"
        elif torch.cuda.is_available():
          self.device = "cuda"
        else:
          self.device = "cpu"
        self.model, self.preprocess = clip.load("ViT-B/32", device=self.device)  # 512-dim, 32px patch size - faster inference
        self.lock = threading.Lock()  # CLIP is thread-safe with a lock for transform
        # Get embedding dimension from model (ViT-B/32 = 512)
        self.embedding_dim = self.model.visual.output_dim

    def encode_images(self, pil_images: List[Image.Image]) -> np.ndarray:
        tensors = []
        with torch.no_grad():
            for im in pil_images:
                if im is None:
                    tensors.append(None)
                else:
                    with self.lock:
                        t = self.preprocess(im).unsqueeze(0)
                    tensors.append(t)
            batch = [t for t in tensors if t is not None]
            if not batch:
                return np.zeros((0, self.embedding_dim), dtype="float32")
            x = torch.cat(batch, dim=0).to(self.device)
            z = self.model.encode_image(x)
            z = z / z.norm(dim=-1, keepdim=True)
            arr = z.detach().cpu().numpy().astype("float32")
        # Reinsert blanks for failed images
        out = np.zeros((len(pil_images), self.embedding_dim), dtype="float32")
        j = 0
        for i, t in enumerate(tensors):
            if t is None:
                continue
            out[i] = arr[j]
            j += 1
        return out

# ------------------------- Main build -------------------------

def build_index(
    kind: str,
    out_dir: Path,
    cache_dir: Path,
    limit: Optional[int] = None,
    batch_size: int = 64,
    target_size: int = 256,
    validate_cache: bool = True,
    hnsw_m: int = 32,
    hnsw_ef_construction: int = 200
):
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Track build start time
    build_start_time = time.time()

    print(f"Loading Scryfall bulk '{kind}' ...")
    cards = load_bulk(kind)
    print(f"Cards in bulk file: {len(cards):,}")

    # Gather (name, url, id, set, collector_number, frame, colors)
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
                "image_url": card_img_url,     # used for embedding (full card)
                "card_url": display_url,       # used for display
                "scryfall_uri": c.get("scryfall_uri"),
            })
    if limit:
        records = records[:limit]

    print(f"Total faces to index: {len(records):,}")

    # Guard against empty dataset
    if len(records) == 0:
        raise SystemExit("ERROR: No records to index. Cannot create FAISS index from zero vectors.")

    # Download and validate
    paths: List[Optional[Path]] = []
    validation_failed = 0
    validation_failures = []

    print(f"Downloading and validating images (validate={validate_cache})...")
    for rec in tqdm(records, desc="Downloading images"):
        p = download_image(rec["image_url"], cache_dir)

        # Validate if enabled and file was downloaded
        if p is not None and validate_cache:
            is_valid, error = validate_image(p)
            if not is_valid:
                validation_failed += 1
                validation_failures.append({
                    "file": p.name,
                    "reason": error,
                    "name": rec.get("name", "unknown")
                })
                paths.append(None)
                continue

        paths.append(p)

    if validation_failed > 0:
        print(f"\n⚠️  Warning: {validation_failed} images failed validation")
        print(f"   These corrupted/invalid files will be excluded from the index:")
        for failure in validation_failures[:10]:
            print(f"     - {failure['file']}: {failure['reason']} ({failure['name']})")
        if len(validation_failures) > 10:
            print(f"     ... and {len(validation_failures) - 10} more")

    valid_count = len([p for p in paths if p is not None])
    if valid_count == 0:
        raise SystemExit("ERROR: No valid images to embed. Cannot create FAISS index from zero vectors.")

    # Load + embed
    embedder = Embedder()
    embedding_dim = embedder.embedding_dim
    vecs = np.zeros((len(records), embedding_dim), dtype="float32")
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

def main():
    ap = argparse.ArgumentParser(description="Build a FAISS index of MTG cards from Scryfall bulk.")
    ap.add_argument("--kind", default="unique_artwork",
                    choices=["unique_artwork", "default_cards", "all_cards"],
                    help="Which Scryfall bulk to use.")
    ap.add_argument("--out", default="index_out", help="Directory to write index + metadata.")
    ap.add_argument("--cache", default="image_cache", help="Directory to cache downloaded images.")
    ap.add_argument("--limit", type=int, default=None, help="Limit number of faces (for testing).")
    ap.add_argument("--batch", type=int, default=64, help="Embedding batch size.")
    ap.add_argument(
        "--size",
        type=int,
        default=224,
        help="Square resize for images before CLIP preprocess (must match browser query preprocessing).",
    )
    ap.add_argument("--validate-cache", dest="validate_cache", action="store_true", default=True,
                    help="Validate cached images before embedding (default: enabled).")
    ap.add_argument("--no-validate-cache", dest="validate_cache", action="store_false",
                    help="Skip image validation (faster but may include corrupted images).")
    ap.add_argument("--hnsw-m", type=int, default=32,
                    help="HNSW M parameter (connectivity, default: 32). Higher = better recall, slower build.")
    ap.add_argument("--hnsw-ef-construction", type=int, default=200,
                    help="HNSW efConstruction parameter (build accuracy, default: 200). Higher = better quality, slower build.")
    args = ap.parse_args()

    # Validate CLI arguments
    validate_args(args)

    build_index(
        kind=args.kind,
        out_dir=Path(args.out),
        cache_dir=Path(args.cache),
        limit=args.limit,
        batch_size=args.batch,
        target_size=args.size,
        validate_cache=args.validate_cache,
        hnsw_m=args.hnsw_m,
        hnsw_ef_construction=args.hnsw_ef_construction
    )

if __name__ == "__main__":
    main()

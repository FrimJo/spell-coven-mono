#!/usr/bin/env python3
import argparse, io, json, os, sys, time, gzip, hashlib, threading
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import requests
from PIL import Image, UnidentifiedImageError
import numpy as np
from tqdm import tqdm

import torch
import clip  # from openai/CLIP
import faiss


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

def face_image_urls(card: dict) -> List[Tuple[str, str, str]]:
    """
    Returns a list of tuples (display_name, image_url, face_id)
    face_id is a stable UUID-like scryfall id for the card (or face).
    """
    out = []
    def pick(uris):
        return uris.get("art_crop") or uris.get("normal") or uris.get("large")

    if "image_uris" in card:
        u = pick(card["image_uris"])
        if u:
            out.append((card["name"], u, card.get("id")))
    for i, f in enumerate(card.get("card_faces", [])):
        if "image_uris" in f:
            u = pick(f["image_uris"])
            if u:
                name = f.get("name") or card["name"]
                face_id = (card.get("id") or "") + f":face:" + str(i)
                out.append((name, u, face_id))
    return out

def safe_filename(url: str) -> str:
    # stable cache name independent of query params
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()
    ext = ".jpg"
    if ".png" in url.lower():
        ext = ".png"
    return f"{h}{ext}"

def download_image(url: str, cache_dir: Path, retries: int = 3, timeout: int = 20) -> Optional[Path]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    fp = cache_dir / safe_filename(url)
    if fp.exists() and fp.stat().st_size > 0:
        return fp
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

def load_image_rgb(path: Path, target_size: int = 256) -> Optional[Image.Image]:
    try:
        img = Image.open(path).convert("RGB")
        # Simple square center-crop to be robust to non-uniform borders
        w, h = img.size
        s = min(w, h)
        left = (w - s) // 2
        top = (h - s) // 2
        img = img.crop((left, top, left + s, top + s))
        if max(img.size) != target_size:
            img = img.resize((target_size, target_size), Image.BICUBIC)
        return img
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
        self.model, self.preprocess = clip.load("ViT-B/32", device=self.device)  # 512-dim
        self.lock = threading.Lock()  # CLIP is thread-safe with a lock for transform

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
                return np.zeros((0, 512), dtype="float32")
            x = torch.cat(batch, dim=0).to(self.device)
            z = self.model.encode_image(x)
            z = z / z.norm(dim=-1, keepdim=True)
            arr = z.detach().cpu().numpy().astype("float32")
        # Reinsert blanks for failed images
        out = np.zeros((len(pil_images), 512), dtype="float32")
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
    target_size: int = 256
):
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading Scryfall bulk '{kind}' ...")
    cards = load_bulk(kind)
    print(f"Cards in bulk file: {len(cards):,}")

    # Gather (name, url, id, set, collector_number, frame, colors)
    records: List[Dict] = []
    for c in cards:
        for name, url, face_id in face_image_urls(c):
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
                "image_url": url,
            })
    if limit:
        records = records[:limit]

    print(f"Total faces to index: {len(records):,}")

    # Download
    paths: List[Optional[Path]] = []
    for rec in tqdm(records, desc="Downloading images"):
        p = download_image(rec["image_url"], cache_dir)
        paths.append(p)

    # Load + embed
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

    # Build FAISS (HNSW over inner-product; vectors already L2-normalized)
    d = X.shape[1]
    index = faiss.IndexIDMap(faiss.IndexFlatIP(d))
    if not index.is_trained:
      index.train(X)
    index.add_with_ids(X, np.arange(X.shape[0]).astype("int64"))
    faiss.write_index(index, str(out_dir / "mtg_art.faiss"))
    print(f"Saved FAISS index to {out_dir/'mtg_art.faiss'}")

    # Save metadata line-by-line (easy to stream later)
    meta_path = out_dir / "mtg_meta.jsonl"
    with open(meta_path, "w", encoding="utf-8") as f:
        for m in meta:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")
    print(f"Saved metadata for {len(meta)} vectors to {meta_path}")

def main():
    ap = argparse.ArgumentParser(description="Build a FAISS index of MTG card art from Scryfall bulk.")
    ap.add_argument("--kind", default="unique_artwork",
                    choices=["unique_artwork", "default_cards", "all_cards"],
                    help="Which Scryfall bulk to use.")
    ap.add_argument("--out", default="index_out", help="Directory to write index + metadata.")
    ap.add_argument("--cache", default="image_cache", help="Directory to cache downloaded images.")
    ap.add_argument("--limit", type=int, default=None, help="Limit number of faces (for testing).")
    ap.add_argument("--batch", type=int, default=64, help="Embedding batch size.")
    ap.add_argument("--size", type=int, default=256, help="Square resize for images before CLIP preprocess.")
    args = ap.parse_args()

    build_index(
        kind=args.kind,
        out_dir=Path(args.out),
        cache_dir=Path(args.cache),
        limit=args.limit,
        batch_size=args.batch,
        target_size=args.size
    )

if __name__ == "__main__":
    main()

import json
import argparse
import faiss
import torch
import clip
from PIL import Image
import numpy as np

# --- Load FAISS + metadata ---
index = faiss.read_index("index_out/mtg_cards.faiss")
meta = [json.loads(line) for line in open("index_out/mtg_meta.jsonl", "r", encoding="utf-8")]

# --- Init CLIP ---
device = "mps" if torch.backends.mps.is_available() else (
    "cuda" if torch.cuda.is_available() else "cpu"
)
print("Using device:", device)

model, preprocess = clip.load("ViT-B/32", device=device)

def embed_image(img_path: str) -> np.ndarray:
    img = Image.open(img_path).convert("RGB")
    with torch.no_grad():
        x = preprocess(img).unsqueeze(0).to(device)
        v = model.encode_image(x)
        v = v / v.norm(dim=-1, keepdim=True)
    return v.cpu().numpy().astype("float32")

if __name__ == "__main__":
    # --- CLI args ---
    ap = argparse.ArgumentParser(description="Query the MTG FAISS index with a local image")
    ap.add_argument("query_path", help="Path to query image")
    ap.add_argument("--k", type=int, default=1, help="Number of top results to return (default: 1)")
    args = ap.parse_args()

    # --- Query ---
    query_path = args.query_path
    vec = embed_image(query_path)
    D, I = index.search(vec, k=args.k)

    print(f"\nTop {args.k} matches for:", query_path)
    for rank, (dist, idx) in enumerate(zip(D[0], I[0]), 1):
        m = meta[int(idx)]
        score = dist  # IndexFlatIP returns dot product (cosine for normalized vectors)
        print(f"{rank}. {m['name']} [{m['set']}] score={score:.3f} url={m['image_url']}")

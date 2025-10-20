#!/usr/bin/env python3
"""
Test that querying the database with an image from the cache returns a perfect match (score 1.0).

This test verifies:
1. The embedding generation is deterministic
2. The database search finds exact matches
3. The cosine similarity scoring is correct

Usage:
    python test_perfect_match.py [--image-path PATH]
    
Example:
    python test_perfect_match.py
    python test_perfect_match.py --image-path image_cache/7f7b910a9ab37c62aea118e2052f8054d53c04fa.jpg
"""

import argparse
import sys
from pathlib import Path
import numpy as np
import faiss

# Import from build scripts
sys.path.insert(0, str(Path(__file__).parent))
from build_mtg_faiss import Embedder, load_image_rgb


def test_perfect_match(image_path: Path, index_path: Path = None, meta_path: Path = None):
    """
    Test that an image from the cache returns a perfect match when queried.
    
    Args:
        image_path: Path to the test image
        index_path: Path to FAISS index (default: index_out/index.faiss)
        meta_path: Path to metadata (default: index_out/meta.json)
    
    Returns:
        bool: True if test passes (score >= 0.99), False otherwise
    """
    
    # Default paths
    if index_path is None:
        index_path = Path(__file__).parent / "index_out" / "index.faiss"
    if meta_path is None:
        meta_path = Path(__file__).parent / "index_out" / "meta.json"
    
    # Validate paths
    if not image_path.exists():
        print(f"❌ Image not found: {image_path}")
        return False
    
    if not index_path.exists():
        print(f"❌ Index not found: {index_path}")
        print(f"   Run 'make build-all' or 'make embed' first")
        return False
    
    if not meta_path.exists():
        print(f"❌ Metadata not found: {meta_path}")
        return False
    
    print(f"🔍 Testing perfect match with image: {image_path.name}")
    print(f"   Index: {index_path}")
    print(f"   Metadata: {meta_path}")
    print()
    
    # Load metadata
    import json
    with open(meta_path) as f:
        meta_data = json.load(f)
    
    # Get embedding dimension from metadata
    embedding_dim = meta_data['shape'][1]
    print(f"📊 Embedding dimension: {embedding_dim}")
    
    # Load FAISS index
    print(f"📂 Loading FAISS index...")
    index = faiss.read_index(str(index_path))
    print(f"   Index size: {index.ntotal} vectors")
    print()
    
    # Generate embedding for test image
    print(f"🖼️  Generating embedding for test image...")
    embedder = Embedder()
    
    # Load and preprocess image
    img = load_image_rgb(image_path, target_size=256)
    if img is None:
        print(f"❌ Failed to load image: {image_path}")
        return False
    
    # Generate embedding
    embedding = embedder.encode_images([img])
    if embedding.shape[0] == 0:
        print(f"❌ Failed to generate embedding")
        return False
    
    query_embedding = embedding[0]
    print(f"   Embedding shape: {query_embedding.shape}")
    print(f"   Embedding norm: {np.linalg.norm(query_embedding):.6f}")
    print()
    
    # Query the index
    print(f"🔎 Querying index for top-1 match...")
    distances, indices = index.search(query_embedding.reshape(1, -1), k=1)
    
    score = distances[0][0]
    matched_idx = indices[0][0]
    
    print(f"   Top match index: {matched_idx}")
    print(f"   Cosine similarity score: {score:.6f}")
    print()
    
    # Check if it's a perfect match
    # Note: Due to floating point precision, we accept scores >= 0.99
    threshold = 0.99
    if score >= threshold:
        print(f"✅ PASS: Perfect match found! Score {score:.6f} >= {threshold}")
        
        # Print matched card info
        if 'records' in meta_data:
            matched_card = meta_data['records'][matched_idx]
            print(f"   Matched card: {matched_card.get('name', 'Unknown')}")
            if 'set' in matched_card:
                print(f"   Set: {matched_card['set']}")
        
        return True
    else:
        print(f"❌ FAIL: Score {score:.6f} < {threshold}")
        print(f"   Expected a perfect match (score ~1.0)")
        
        # Print top-5 matches for debugging
        print(f"\n   Top-5 matches:")
        distances_top5, indices_top5 = index.search(query_embedding.reshape(1, -1), k=5)
        for i, (dist, idx) in enumerate(zip(distances_top5[0], indices_top5[0])):
            card_name = "Unknown"
            if 'records' in meta_data and idx < len(meta_data['records']):
                card_name = meta_data['records'][idx].get('name', 'Unknown')
            print(f"   {i+1}. {card_name} (score: {dist:.6f})")
        
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Test that querying the database with a cached image returns a perfect match"
    )
    parser.add_argument(
        "--image-path",
        type=Path,
        default=None,
        help="Path to test image (default: first image in cache)"
    )
    parser.add_argument(
        "--index-path",
        type=Path,
        default=None,
        help="Path to FAISS index (default: index_out/index.faiss)"
    )
    parser.add_argument(
        "--meta-path",
        type=Path,
        default=None,
        help="Path to metadata (default: index_out/meta.json)"
    )
    
    args = parser.parse_args()
    
    # Find test image if not specified
    if args.image_path is None:
        cache_dir = Path(__file__).parent / "image_cache"
        if not cache_dir.exists():
            print(f"❌ Cache directory not found: {cache_dir}")
            print(f"   Run 'make download' first")
            return 1
        
        # Get first image from cache
        images = list(cache_dir.glob("*.jpg"))
        if not images:
            print(f"❌ No images found in cache: {cache_dir}")
            return 1
        
        args.image_path = images[0]
        print(f"📸 Using first cached image: {args.image_path.name}\n")
    
    # Run test
    success = test_perfect_match(
        args.image_path,
        args.index_path,
        args.meta_path
    )
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())

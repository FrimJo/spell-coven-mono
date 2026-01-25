#!/usr/bin/env python3
"""
Preview how a single card image is processed before embedding.
This mirrors the preprocessing in build_embeddings.py (contrast, pad-to-square, resize).
"""
import argparse
from pathlib import Path

from PIL import Image, ImageEnhance, UnidentifiedImageError

from config import get_default_contrast


def process_image(path: Path, target_size: int, enhance_contrast: float) -> Image.Image:
    img = Image.open(path).convert("RGB")

    if enhance_contrast > 1.0:
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(enhance_contrast)

    w, h = img.size
    s = max(w, h)
    padded = Image.new("RGB", (s, s), (0, 0, 0))
    paste_x = (s - w) // 2
    paste_y = (s - h) // 2
    padded.paste(img, (paste_x, paste_y))

    if s != target_size:
        padded = padded.resize((target_size, target_size), Image.BICUBIC)

    return padded


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Process a single card image the same way as embedding."
    )
    ap.add_argument("--input", required=True, help="Path to input image.")
    ap.add_argument("--output", required=True, help="Path to write processed image.")
    ap.add_argument(
        "--size",
        type=int,
        default=224,
        help="Square resize size (default: 224).",
    )
    ap.add_argument(
        "--contrast",
        type=float,
        default=get_default_contrast(),
        help="Contrast enhancement factor (default: 1.5).",
    )
    args = ap.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    if not in_path.exists():
        raise SystemExit(f"Input image not found: {in_path}")

    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        processed = process_image(in_path, args.size, args.contrast)
    except (UnidentifiedImageError, OSError) as exc:
        raise SystemExit(f"Failed to read image: {exc}") from exc

    processed.save(out_path)
    print(f"Saved processed image to {out_path}")


if __name__ == "__main__":
    main()

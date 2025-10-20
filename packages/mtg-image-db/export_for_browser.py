import json
import numpy as np
import argparse
from pathlib import Path

def main():
    # --- CLI args ---
    ap = argparse.ArgumentParser(description="Export embeddings for browser")
    ap.add_argument("--input-dir", default="index_out", help="Input directory (default: index_out)")
    ap.add_argument("--output-dir", default="index_out", help="Output directory (default: index_out)")
    ap.add_argument("--format", choices=["float32", "int8"], default="float32",
                    help="Export format: float32 (no quantization, recommended) or int8 (75%% smaller, slight accuracy loss)")
    args = ap.parse_args()

    # --- Paths ---
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    
    EMB_NPY  = input_dir / "mtg_embeddings.npy"
    META_LJL = input_dir / "mtg_meta.jsonl"

    # --- Validate ---
    if not EMB_NPY.exists():
        raise SystemExit(f"Missing {EMB_NPY}. Re-run the builder after adding the np.save() line.")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    if not output_dir.is_dir():
        raise SystemExit(f"Output directory {output_dir} is not accessible")

    # --- Load embeddings ---
    X = np.load(EMB_NPY)  # float32 [N, D]
    print(f"Loaded embeddings: shape={X.shape}, dtype={X.dtype}")
    
    # --- Verify normalization ---
    norms = np.linalg.norm(X, axis=1)
    if not np.allclose(norms, 1.0, atol=1e-5):
        print(f"⚠️  WARNING: Embeddings not properly normalized!")
        print(f"   Norms range: [{norms.min():.6f}, {norms.max():.6f}]")
        print(f"   Re-normalizing now...")
        X = X / norms[:, np.newaxis]
        norms = np.linalg.norm(X, axis=1)
        print(f"   ✓ Normalized. New norms range: [{norms.min():.6f}, {norms.max():.6f}]")
    else:
        print(f"✓ Embeddings properly normalized (norms within 1.0 ± 1e-5)")

    # --- Load metadata ---
    meta = [json.loads(l) for l in META_LJL.open("r", encoding="utf-8")]
    if len(meta) != X.shape[0]:
        raise SystemExit(f"Meta len {len(meta)} != embeddings rows {X.shape[0]}")

    # --- Export based on format ---
    if args.format == "float32":
        # Export as float32 (no quantization)
        OUT_BIN = output_dir / "embeddings.f32bin"
        OUT_META = output_dir / "meta.json"
        
        X.tofile(OUT_BIN)
        print(f"\nWrote {OUT_BIN} (float32, no quantization)")
        print(f"  Size: {X.nbytes/1e6:.1f} MB")
        print(f"  Shape: {X.shape}")
        
        meta_with_header = {
            "version": "1.0",
            "quantization": {
                "dtype": "float32",
                "scale_factor": 1.0,
                "original_dtype": "float32",
                "note": "No quantization - embeddings are L2-normalized float32"
            },
            "shape": list(X.shape),
            "records": meta
        }
        
    else:  # int8
        # Export as int8 (quantized)
        OUT_BIN = output_dir / "embeddings.i8bin"
        OUT_META = output_dir / "meta.json"
        
        # IMPORTANT: Quantize NORMALIZED embeddings
        # Browser must re-normalize after dequantization to restore unit length
        X_int8 = np.clip(X * 127, -127, 127).astype(np.int8)
        X_int8.tofile(OUT_BIN)
        
        print(f"\nWrote {OUT_BIN} (int8 quantized)")
        print(f"  Size reduction: {X.nbytes/1e6:.1f} MB (float32) → {X_int8.nbytes/1e6:.1f} MB (int8) = {100*(1-X_int8.nbytes/X.nbytes):.1f}% smaller")
        print(f"  Shape: {X.shape}")
        print(f"  ⚠️  NOTE: Browser must re-normalize after dequantization!")
        
        meta_with_header = {
            "version": "1.0",
            "quantization": {
                "dtype": "int8",
                "scale_factor": 127,
                "original_dtype": "float32",
                "note": "Dequantize by dividing by 127, then L2-normalize each embedding to unit length"
            },
            "shape": list(X.shape),
            "records": meta
        }
    
    OUT_META.write_text(json.dumps(meta_with_header, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT_META} ({len(meta)} records with quantization metadata)")
    print(f"\n✓ Export complete! Format: {args.format}")

if __name__ == "__main__":
    main()

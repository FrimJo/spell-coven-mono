import json
import numpy as np
import argparse
from pathlib import Path

def main():
    # --- CLI args ---
    ap = argparse.ArgumentParser(description="Export embeddings for browser")
    ap.add_argument("--input-dir", default="index_out", help="Input directory (default: index_out)")
    ap.add_argument("--output-dir", default="index_out", help="Output directory (default: index_out)")
    args = ap.parse_args()

    # --- Paths ---
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    
    EMB_NPY  = input_dir / "mtg_embeddings.npy"
    META_LJL = input_dir / "mtg_meta.jsonl"
    OUT_BIN  = output_dir / "embeddings.i8bin"
    OUT_META = output_dir / "meta.json"

    # --- Validate ---
    if not EMB_NPY.exists():
        raise SystemExit(f"Missing {EMB_NPY}. Re-run the builder after adding the np.save() line.")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    if not output_dir.is_dir():
        raise SystemExit(f"Output directory {output_dir} is not accessible")

    # --- Export ---
    X = np.load(EMB_NPY)  # float32 [N,512], already L2-normalized
    
    # Quantize to int8: map [-1, 1] to [-127, 127]
    X_int8 = np.clip(X * 127, -127, 127).astype(np.int8)
    X_int8.tofile(OUT_BIN)
    print(f"Wrote {OUT_BIN} (int8 quantized)  (~{X_int8.nbytes/1e6:.1f} MB)  shape={X.shape}")
    print(f"  Size reduction: {X.nbytes/1e6:.1f} MB (float32) → {X_int8.nbytes/1e6:.1f} MB (int8) = {100*(1-X_int8.nbytes/X.nbytes):.1f}% smaller")

    # Load and augment metadata with quantization info
    meta = [json.loads(l) for l in META_LJL.open("r", encoding="utf-8")]
    if len(meta) != X.shape[0]:
        raise SystemExit(f"Meta len {len(meta)} != embeddings rows {X.shape[0]}")
    
    # Add quantization metadata as header
    meta_with_header = {
        "quantization": {
            "dtype": "int8",
            "scale_factor": 127,
            "original_dtype": "float32",
            "note": "Dequantize by dividing by scale_factor: float_value = int8_value / 127.0"
        },
        "shape": list(X.shape),
        "records": meta
    }
    
    OUT_META.write_text(json.dumps(meta_with_header, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT_META}  ({len(meta)} records with quantization metadata)")

if __name__ == "__main__":
    main()

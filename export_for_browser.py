import json
import numpy as np
from pathlib import Path

EMB_NPY  = Path("index_out/mtg_embeddings.npy")
META_LJL = Path("index_out/mtg_meta.jsonl")
OUT_BIN  = Path("index_out/embeddings.f16bin")
OUT_META = Path("index_out/meta.json")

def main():
    if not EMB_NPY.exists():
        raise SystemExit(f"Missing {EMB_NPY}. Re-run the builder after adding the np.save() line.")

    X = np.load(EMB_NPY)                 # float32 [N,512], already L2-normalized
    X16 = X.astype(np.float16)
    X16.tofile(OUT_BIN)
    print(f"Wrote {OUT_BIN}  (~{X16.nbytes/1e6:.1f} MB)  shape={X.shape}")

    meta = [json.loads(l) for l in META_LJL.open("r", encoding="utf-8")]
    if len(meta) != X.shape[0]:
        raise SystemExit(f"Meta len {len(meta)} != embeddings rows {X.shape[0]}")
    OUT_META.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT_META}  ({len(meta)} records)")

if __name__ == "__main__":
    main()

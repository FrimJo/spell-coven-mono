import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers/dist/transformers.min.js";

const D = 512;
let meta = null;
let db = null;
let extractor = null;

function float16ToFloat32(uint16) {
  const out = new Float32Array(uint16.length);
  for (let i = 0; i < uint16.length; i++) {
    const h = uint16[i];
    const s = (h & 0x8000) >> 15;
    const e = (h & 0x7C00) >> 10;
    const f = h & 0x03FF;
    let v;
    if (e === 0) v = (f ? (f / 1024) * Math.pow(2, -14) : 0);
    else if (e === 31) v = f ? NaN : Infinity;
    else v = (1 + f / 1024) * Math.pow(2, e - 15);
    out[i] = (s ? -1 : 1) * v;
  }
  return out;
}

function l2norm(x) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  s = Math.sqrt(s) || 1;
  for (let i = 0; i < x.length; i++) x[i] /= s;
  return x;
}

export async function loadEmbeddingsAndMeta() {
  console.log("Loading embeddings + metadata…");
  meta = await (await fetch("index_out/meta.json")).json();
  const buf = await (await fetch("index_out/embeddings.f16bin")).arrayBuffer();
  db = float16ToFloat32(new Uint16Array(buf));
  console.log(`Loaded ${meta.length} embeddings`);
}

export async function loadModel(spinnerEl) {
  if (spinnerEl) {
    spinnerEl.style.display = "block";
    spinnerEl.textContent = "Downloading CLIP (vision) model…";
  }
  console.log("Loading CLIP vision model (first load may take a bit)…");
  extractor = await pipeline(
    "image-feature-extraction",
    "Xenova/clip-vit-base-patch32",
    {
      quantized: false,
      progress_callback: (p) => {
        const msg = `${p.status} ${p.progress ?? ""} ${p.file ?? ""}`;
        if (spinnerEl) spinnerEl.textContent = msg;
        console.log(msg);
      }
    }
  );
  if (spinnerEl) spinnerEl.style.display = "none";
  console.log("Model ready");
}

export async function embedFromImageElement(imgEl) {
  const url = imgEl.src; // blob URL
  const out = await extractor(url);
  return l2norm(Float32Array.from(out.data));
}

export async function embedFromCanvas(canvas) {
  const out = await extractor(canvas);
  return l2norm(Float32Array.from(out.data));
}

export function topK(query, K = 5) {
  const N = meta.length;
  const scores = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0, off = i * D;
    for (let j = 0; j < D; j++) s += query[j] * db[off + j];
    scores[i] = s;
  }
  const idx = [...scores.keys()];
  idx.sort((a, b) => scores[b] - scores[a]);
  return idx.slice(0, K).map(i => ({ score: scores[i], ...meta[i] }));
}

// Fast path for K=1: scan once, track the best.
export function top1(query) {
  const N = meta.length;
  let bestI = -1;
  let bestS = -Infinity;
  for (let i = 0; i < N; i++) {
    let s = 0;
    const off = i * D;
    for (let j = 0; j < D; j++) s += query[j] * db[off + j];
    if (s > bestS) { bestS = s; bestI = i; }
  }
  return { score: bestS, ...meta[bestI] };
}

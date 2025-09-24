<script type="module">
import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers/dist/transformers.min.js";

// 1) Load meta and embeddings
const meta = await (await fetch('/index_out/meta.json')).json();
const buf  = await (await fetch('/index_out/embeddings.f16bin')).arrayBuffer();

// Float16Array isn't universally supported yet—decode as Uint16 and convert:
function float16ToFloat32(uint16) {
  // fast f16->f32 conversion
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
const embF16 = new Uint16Array(buf);
const D = 512;
const N = embF16.length / D;
const db = float16ToFloat32(embF16);

// 2) Prepare CLIP image embedder in the browser
const extractor = await pipeline('feature-extraction', 'Xenova/clip-vit-base-patch32');

// Helper: L2-normalize a Float32Array
function l2norm(x) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  s = Math.sqrt(s) || 1;
  for (let i = 0; i < x.length; i++) x[i] /= s;
  return x;
}

// 3) Embed a query image element
async function embedImageElement(imgEl) {
  const out = await extractor(imgEl, { pooling: 'mean', normalize: true });
  // transformers.js returns a nested array; flatten to Float32Array
  const arr = Float32Array.from(out.data);
  return l2norm(arr);
}

// 4) Cosine search (dot products since both are L2-normalized)
function topK(query, K = 5) {
  const scores = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    const offset = i * D;
    for (let j = 0; j < D; j++) s += query[j] * db[offset + j];
    scores[i] = s;
  }
  // get indices of top-K
  const idx = [...scores.keys()];
  idx.sort((a, b) => scores[b] - scores[a]);
  return idx.slice(0, K).map(i => ({ i, score: scores[i], meta: meta[i] }));
}

// Example usage: load an <img id="q"> and search
const img = document.getElementById('q');
const q = await embedImageElement(img);
const results = topK(q, 5);
console.log(results);
</script>

<img id="q" src="/some_card_crop.jpg" crossorigin="anonymous" style="max-width:256px">

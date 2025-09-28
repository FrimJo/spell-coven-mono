// Embedding dimension from the prototype
const D = 512

export type CardMeta = {
  name: string
  set: string
  scryfall_uri?: string
  image_url?: string
  card_url?: string
}

let meta: CardMeta[] | null = null
let db: Float32Array | null = null
let extractor: any = null

// If available (bundled via Vite), these URLs resolve to files exported by @repo/mtg-image-db
// The `?url` suffix tells Vite to treat them as static assets and return their public URL at runtime.
// These imports are optional at runtime; they will be tree-shaken if unused.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import META_URL from '@repo/mtg-image-db/meta.json?url'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import EMB_URL from '@repo/mtg-image-db/embeddings.f16bin?url'

function float16ToFloat32(uint16: Uint16Array) {
  const out = new Float32Array(uint16.length)
  for (let i = 0; i < uint16.length; i++) {
    const h = uint16[i]
    const s = (h & 0x8000) >> 15
    const e = (h & 0x7c00) >> 10
    const f = h & 0x03ff
    let v
    if (e === 0) v = f ? (f / 1024) * Math.pow(2, -14) : 0
    else if (e === 31) v = f ? NaN : Infinity
    else v = (1 + f / 1024) * Math.pow(2, e - 15)
    out[i] = (s ? -1 : 1) * v
  }
  return out
}

function l2norm(x: Float32Array) {
  let s = 0
  for (let i = 0; i < x.length; i++) s += x[i] * x[i]
  s = Math.sqrt(s) || 1
  for (let i = 0; i < x.length; i++) x[i] /= s
  return x
}

export async function loadEmbeddingsAndMeta(basePath: string = '/') {
  if (meta && db) return
  // Files are expected to be served from public/index_out
  const m = await (await fetch(`${basePath}index_out/meta.json`)).json()
  const buf = await (await fetch(`${basePath}index_out/embeddings.f16bin`)).arrayBuffer()
  meta = m
  db = float16ToFloat32(new Uint16Array(buf))
  // Optional: console.log(`Loaded ${meta.length} embeddings`)
}

// Convenience: load assets directly from the published package using Vite asset URLs.
// This avoids copying files into public/ and works in dev/preview/build.
export async function loadEmbeddingsAndMetaFromPackage() {
  if (meta && db) return
  const m = await (await fetch(META_URL as string)).json()
  const buf = await (await fetch(EMB_URL as string)).arrayBuffer()
  meta = m
  db = float16ToFloat32(new Uint16Array(buf))
}

export async function loadModel(opts?: { onProgress?: (msg: string) => void }) {
  if (extractor) return
  const options= {
    quantized: false,
    progress_callback: (p: any) => {
      const msg = `${p.status ?? ''} ${p.progress ?? ''} ${p.file ?? ''}`.trim()
      opts?.onProgress?.(msg)
    },
  }
  // Dynamic import to avoid SSR requiring 'sharp'
  const { pipeline } = await import('@xenova/transformers')
  extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', options)
}

export async function embedFromImageElement(imgEl: HTMLImageElement) {
  if (!extractor) throw new Error('Model not loaded')
  const out = await extractor(imgEl.src)
  return l2norm(Float32Array.from(out.data))
}

export async function embedFromCanvas(canvas: HTMLCanvasElement) {
  if (!extractor) throw new Error('Model not loaded')
  const out = await extractor(canvas)
  return l2norm(Float32Array.from(out.data))
}

export function topK(query: Float32Array, K = 5) {
  if (!meta || !db) throw new Error('Embeddings not loaded')
  const N = meta.length
  const scores = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    let s = 0, off = i * D
    for (let j = 0; j < D; j++) s += query[j] * db[off + j]
    scores[i] = s
  }
  const idx = Array.from(scores.keys())
  idx.sort((a, b) => scores[b] - scores[a])
  return idx.slice(0, K).map((i) => ({ score: scores[i], ...(meta as CardMeta[])[i] }))
}

export function top1(query: Float32Array) {
  if (!meta || !db) throw new Error('Embeddings not loaded')
  const N = meta.length
  let bestI = -1
  let bestS = -Infinity as number
  for (let i = 0; i < N; i++) {
    let s = 0
    const off = i * D
    for (let j = 0; j < D; j++) s += query[j] * (db as Float32Array)[off + j]
    if (s > bestS) {
      bestS = s
      bestI = i
    }
  }
  return { score: bestS, ...(meta as CardMeta[])[bestI] }
}

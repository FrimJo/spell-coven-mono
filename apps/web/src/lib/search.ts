// Versioned MTG embeddings data
// Files are stored in public/data/mtg-embeddings/v1.0/ and committed to the repo
// This ensures consistent versioning and avoids rebuilding the entire database on every deploy
// To update: run the build script in packages/mtg-image-db, then copy the output files here

// Top-level import for transformers (no SSR)
import {
  env,
  pipeline,
  ProgressInfo,
} from '@huggingface/transformers'

// Version of the embeddings data - configured via environment variable
const EMBEDDINGS_VERSION = import.meta.env.VITE_EMBEDDINGS_VERSION || 'v1.0'
// Use import.meta.env.BASE_URL to handle GitHub Pages base path in production
const BASE_PATH = import.meta.env.BASE_URL || '/'
const EMB_URL = `${BASE_PATH}data/mtg-embeddings/${EMBEDDINGS_VERSION}/embeddings.i8bin`
const META_URL = `${BASE_PATH}data/mtg-embeddings/${EMBEDDINGS_VERSION}/meta.json`

// Embedding dimension from the prototype
const D = 512

export type CardMeta = {
  name: string
  set: string
  scryfall_uri?: string
  image_url?: string
  card_url?: string
}

export type MetaWithQuantization = {
  version: string
  quantization: {
    dtype: string
    scale_factor: number
    original_dtype: string
    note: string
  }
  shape: [number, number]
  records: CardMeta[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */

let meta: CardMeta[] | null = null
let db: Float32Array | null = null
// Runtime type is ImageFeatureExtractionPipeline from @huggingface/transformers
// Using any to avoid "union type too complex" error
let extractor: any = null
let loadTask: Promise<void> | null = null

function int8ToFloat32(int8Array: Int8Array, scaleFactor = 127) {
  const out = new Float32Array(int8Array.length)
  for (let i = 0; i < int8Array.length; i++) {
    out[i] = int8Array[i] / scaleFactor
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

// Convenience: load assets directly from the published package using Vite asset URLs.
// This avoids copying files into public/ and works in dev/preview/build.
export async function loadEmbeddingsAndMetaFromPackage() {
  if (meta && db) return
  if (loadTask) {
    return loadTask
  }
  loadTask = (async () => {
    const metaUrl = META_URL as string

    console.debug('[search] fetching package meta.json:', metaUrl)
    const metaRes = await fetch(metaUrl)
    if (!metaRes.ok) {
      const text = await metaRes.text().catch(() => '')
      throw new Error(
        `Failed to fetch META_URL (${metaUrl}): ${metaRes.status} ${metaRes.statusText} ${text?.slice(0, 200)}`,
      )
    }
    const metaType = metaRes.headers.get('content-type') || ''
    const metaText = await metaRes.text()
    if (!metaType.includes('application/json')) {
      throw new Error(
        `META_URL has unexpected content-type at ${metaUrl}: ${metaType}. First bytes: ${metaText.slice(0, 200)}`,
      )
    }
    let m: unknown
    try {
      m = JSON.parse(metaText)
    } catch (e) {
      throw new Error(
        `Failed to parse META_URL at ${metaUrl}: ${(e as Error).message}. First bytes: ${metaText.slice(0, 200)}`,
      )
    }
    const embUrl = EMB_URL as string

    console.debug('[search] fetching package embeddings:', embUrl)
    const embRes = await fetch(embUrl)
    if (!embRes.ok) {
      throw new Error(
        `Failed to fetch EMB_URL (${embUrl}): ${embRes.status} ${embRes.statusText}`,
      )
    }
    const buf = await embRes.arrayBuffer()

    // Handle both old format (array) and new format (object with quantization metadata)
    if (Array.isArray(m)) {
      // Old format: direct array of records
      meta = m
      // Assume old float16 format if no quantization metadata
      throw new Error(
        'Old float16 format no longer supported. Please re-export with int8 quantization.',
      )
    } else {
      // New format: object with quantization metadata and records
      const metaObj = m as MetaWithQuantization

      // Validate version
      if (!metaObj.version || metaObj.version !== '1.0') {
        throw new Error(
          `Unsupported meta.json version: ${metaObj.version || 'missing'}. Expected version 1.0`,
        )
      }

      // Validate required fields
      if (!metaObj.quantization || !metaObj.shape || !metaObj.records) {
        throw new Error(
          'Invalid meta.json: missing required fields (quantization, shape, or records)',
        )
      }

      // Validate shape matches buffer size
      const expectedSize = metaObj.shape[0] * metaObj.shape[1]
      if (buf.byteLength !== expectedSize) {
        throw new Error(
          `Embedding file size mismatch: expected ${expectedSize} bytes, got ${buf.byteLength} bytes`,
        )
      }

      meta = metaObj.records

      // Validate metadata count matches embeddings
      if (meta.length !== metaObj.shape[0]) {
        throw new Error(
          `Metadata count mismatch: ${meta.length} records but shape indicates ${metaObj.shape[0]}`,
        )
      }

      // Dequantize based on metadata
      if (metaObj.quantization.dtype === 'int8') {
        const scaleFactor = metaObj.quantization.scale_factor
        db = int8ToFloat32(new Int8Array(buf), scaleFactor)

        console.debug(
          `[search] Loaded meta.json v${metaObj.version}: ${meta.length} embeddings, int8 quantized (scale=${scaleFactor})`,
        )
      } else {
        throw new Error(
          `Unsupported quantization dtype: ${metaObj.quantization.dtype}`,
        )
      }
    }
  })()
  try {
    await loadTask
  } finally {
    // keep the resolved promise for future callers
  }
}

export async function loadModel(opts?: { onProgress?: (msg: string) => void }) {
  if (extractor) return

  try {
    // Configure environment for Transformers.js
    // Models are downloaded directly to browser cache from Hugging Face CDN
    // See: https://xenova.github.io/transformers.js/environments

    // Enable browser caching - models download once, then cached in IndexedDB
    env.useBrowserCache = true
    env.allowRemoteModels = true
    env.allowLocalModels = false


    // Initialize pipeline with proper options
    // CRITICAL: Must use CLIP ViT-B/32 to match backend embeddings (build_mtg_faiss.py line 111)
    let lastLogTime = 0
    extractor = await pipeline(
      'image-feature-extraction',
      'Xenova/clip-vit-base-patch32',
      {
        dtype: 'fp32', // CLIP requires full precision for accurate embeddings
        progress_callback: (progress: ProgressInfo) => {
          // Handle different progress types
          let msg = progress.status
          if ('file' in progress) {
            msg += ` ${progress.file}`
          }
          if ('progress' in progress && progress.progress !== undefined) {
            msg += ` ${progress.progress}%`
          }

          // Only log every second
          const now = Date.now()
          if (now - lastLogTime >= 1000) {
            lastLogTime = now
          }

          opts?.onProgress?.(msg.trim())
        },
      },
    )
  } catch (e: unknown) {
    console.error(
      '[model] Failed to initialize transformers pipeline. This often indicates a network/CORS error fetching model files (JSON or WASM) which may return HTML instead of JSON. Original error:',
      e,
    )
    console.error('[model] Error stack:', (e as Error).stack)
    throw new Error(
      `Model load failed (transformers). Check network requests to huggingface/CDN for non-200 or text/html responses. Original: ${(e as Error)?.message || e}`,
    )
  }
}

export async function embedFromImageElement(imgEl: HTMLImageElement) {
  if (!extractor) throw new Error('Model not loaded')
  const out = await extractor(imgEl.src)
  return l2norm(Float32Array.from(out.data))
}

export async function embedFromCanvas(canvas: HTMLCanvasElement) {
  if (!extractor) throw new Error('Model not loaded')
  
  // Validate preprocessing pipeline alignment (User Story 3)
  // CRITICAL: Canvas must be square and 384×384 to match Python preprocessing
  // See: packages/mtg-image-db/build_mtg_faiss.py lines 122-135
  
  // Check if canvas is square
  if (canvas.width !== canvas.height) {
    console.warn(
      `[search] ⚠️  Canvas should be square for optimal matching. ` +
      `Got ${canvas.width}×${canvas.height}. Results may be inaccurate. ` +
      `Expected: square dimensions matching Python preprocessing pipeline.`
    )
  }
  
  // Check if dimensions match Python target_size (384×384)
  if (canvas.width !== 384 || canvas.height !== 384) {
    console.warn(
      `[search] ⚠️  Canvas dimensions should be 384×384 to match database preprocessing. ` +
      `Got ${canvas.width}×${canvas.height}. ` +
      `Database embeddings were generated from 384×384 square images.`
    )
  }
  
  const out = await extractor(canvas)
  return l2norm(Float32Array.from(out.data))
}

export function topK(query: Float32Array, K = 5) {
  if (!meta || !db) throw new Error('Embeddings not loaded')
  const N = meta.length
  const scores = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    let s = 0
    const off = i * D
    for (let j = 0; j < D; j++) s += query[j] * db[off + j]
    scores[i] = s
  }
  const idx = Array.from(scores.keys())
  idx.sort((a, b) => scores[b] - scores[a])
  return idx
    .slice(0, K)
    .map((i) => ({ score: scores[i], ...(meta as CardMeta[])[i] }))
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

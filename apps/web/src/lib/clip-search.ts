// Versioned MTG embeddings data
// Files are stored in public/data/mtg-embeddings/v1.0/ and committed to the repo
// This ensures consistent versioning and avoids rebuilding the entire database on every deploy
// To update: run the build script in packages/mtg-image-db, then copy the output files here

// Top-level import for transformers (no SSR)
import type { ProgressInfo } from '@huggingface/transformers'
import { env } from '@/env'
import { env as hfEnv, pipeline } from '@huggingface/transformers'

// Version of the embeddings data - configured via environment variable
const EMBEDDINGS_VERSION = env.VITE_EMBEDDINGS_VERSION
const BLOB_STORAGE_URL = env.VITE_BLOB_STORAGE_URL

// Format: float32 (recommended, no quantization) or int8 (75% smaller, slight accuracy loss)
const EMBEDDINGS_FORMAT = env.VITE_EMBEDDINGS_FORMAT
const EMB_EXT = EMBEDDINGS_FORMAT === 'float32' ? 'f32bin' : 'i8bin'
const EMB_URL = `${BLOB_STORAGE_URL}${EMBEDDINGS_VERSION}/embeddings.${EMB_EXT}`
const META_URL = `${BLOB_STORAGE_URL}${EMBEDDINGS_VERSION}/meta.json`

// Contrast enhancement for query images to match database preprocessing
// Set to 1.0 for no enhancement (default)
// Set to 1.2 for 20% boost (recommended for blurry webcam cards)
// Set to 1.5 for 50% boost (aggressive, for very blurry conditions)
// Must match the --contrast value used when building the embeddings database
const QUERY_CONTRAST_ENHANCEMENT = parseFloat(env.VITE_QUERY_CONTRAST)

// Embedding dimension will be read from metadata at runtime
// Default to 512 (ViT-B/32) but will be overridden by actual metadata
let D = 512

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

let meta: CardMeta[] | null = null
let db: Float32Array | null = null
// Runtime type is ImageFeatureExtractionPipeline from @huggingface/transformers
// eslint-disable-next-line @typescript-eslint/no-explicit-any --  Using any to avoid "union type too complex" error
let extractor: any = null
let loadTask: Promise<void> | null = null
let modelWarmed = false

function int8ToFloat32(int8Array: Int8Array, scaleFactor = 127) {
  const out = new Float32Array(int8Array.length)
  for (let i = 0; i < int8Array.length; i++) {
    const val = int8Array[i]
    if (val !== undefined) {
      out[i] = val / scaleFactor
    }
  }
  return out
}

function l2norm(x: Float32Array) {
  let s = 0
  for (let i = 0; i < x.length; i++) {
    const val = x[i]
    if (val !== undefined) {
      s += val * val
    }
  }
  s = Math.sqrt(s) || 1
  for (let i = 0; i < x.length; i++) {
    const val = x[i]
    if (val !== undefined) {
      x[i] = val / s
    }
  }
  return x
}

/**
 * Apply contrast enhancement to a canvas to match database preprocessing.
 * This helps with blurry or low-contrast webcam cards by sharpening features.
 *
 * @param canvas Source canvas to enhance
 * @param factor Enhancement factor (1.0 = no change, 1.2 = 20% boost, 1.5 = 50% boost)
 * @returns New canvas with enhanced contrast, or original if factor is 1.0
 */
function enhanceCanvasContrast(
  canvas: HTMLCanvasElement,
  factor: number,
): HTMLCanvasElement {
  // No enhancement needed
  if (factor <= 1.0) {
    return canvas
  }

  // Create temporary canvas for processing
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = canvas.width
  tempCanvas.height = canvas.height
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return canvas

  // Draw original image
  ctx.drawImage(canvas, 0, 0)

  // Get image data
  const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
  const data = imageData.data

  // Apply contrast enhancement using midpoint formula:
  // new_value = (old_value - 128) * factor + 128
  // This preserves the midpoint (128) while amplifying differences
  const midpoint = 128
  for (let i = 0; i < data.length; i += 4) {
    // Skip alpha channel (i+3)
    for (let j = 0; j < 3; j++) {
      const value = data[i + j]
      if (value === undefined) {
        throw new Error(`enhanceContrast: Missing data at index ${i + j}`)
      }
      const enhanced = Math.round((value - midpoint) * factor + midpoint)
      // Clamp to [0, 255]
      data[i + j] = Math.max(0, Math.min(255, enhanced))
    }
  }

  // Put enhanced image data back
  ctx.putImageData(imageData, 0, 0)

  return tempCanvas
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
    console.log('[loadEmbeddingsAndMetaFromPackage] Loading from:', {
      BLOB_STORAGE_URL,
      EMBEDDINGS_VERSION,
      metaUrl,
      embUrl: EMB_URL,
    })

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
      // Calculate expected size in bytes based on data type
      const numElements = metaObj.shape[0] * metaObj.shape[1]
      const bytesPerElement = metaObj.quantization.dtype === 'int8' ? 1 : 4 // int8=1 byte, float32=4 bytes
      const expectedSize = numElements * bytesPerElement
      if (buf.byteLength !== expectedSize) {
        throw new Error(
          `Embedding file size mismatch: expected ${expectedSize} bytes (${numElements} elements × ${bytesPerElement} bytes/${metaObj.quantization.dtype}), got ${buf.byteLength} bytes`,
        )
      }

      meta = metaObj.records

      // Update embedding dimension from metadata
      D = metaObj.shape[1]
      console.log(
        `[loadEmbeddingsAndMetaFromPackage] Loaded embeddings with dimension D=${D}`,
      )

      // Validate metadata count matches embeddings
      if (meta.length !== metaObj.shape[0]) {
        throw new Error(
          `Metadata count mismatch: ${meta.length} records but shape indicates ${metaObj.shape[0]}`,
        )
      }

      // Dequantize based on metadata
      if (metaObj.quantization.dtype === 'float32') {
        // No quantization - embeddings are already normalized float32
        db = new Float32Array(buf)
      } else if (metaObj.quantization.dtype === 'int8') {
        const scaleFactor = metaObj.quantization.scale_factor
        const dequantized = int8ToFloat32(new Int8Array(buf), scaleFactor)

        // CRITICAL: Re-normalize embeddings after dequantization
        // Quantization to int8 destroys L2 normalization, so we must restore it
        // Each embedding should have unit length (norm = 1.0) for cosine similarity
        const N = meta.length
        const D_local = dequantized.length / N
        db = new Float32Array(dequantized.length)

        for (let i = 0; i < N; i++) {
          const offset = i * D_local
          // Calculate norm for this embedding
          let norm = 0
          for (let j = 0; j < D_local; j++) {
            const val = dequantized[offset + j]
            if (val === undefined) {
              throw new Error(`loadEmbeddingsAndMetaFromPackage: Missing dequantized value at offset ${offset + j}`)
            }
            norm += val * val
          }
          norm = Math.sqrt(norm)

          // Normalize and store
          for (let j = 0; j < D_local; j++) {
            const val = dequantized[offset + j]
            if (val === undefined) {
              throw new Error(`loadEmbeddingsAndMetaFromPackage: Missing dequantized value at offset ${offset + j}`)
            }
            db[offset + j] = val / norm
          }
        }
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

    // Check for SharedArrayBuffer support (required for WASM workers)
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined'
    console.log(
      '[loadModel] SharedArrayBuffer available:',
      hasSharedArrayBuffer,
    )
    if (!hasSharedArrayBuffer) {
      console.warn(
        '[loadModel] ⚠️  SharedArrayBuffer not available. WASM workers may not work properly.',
      )
      console.warn(
        "[loadModel] This can happen if: (1) Cross-Origin-Opener-Policy headers are not set, (2) Running in an iframe, or (3) Browser doesn't support it",
      )
    }

    // Enable browser caching - models download once, then cached in IndexedDB
    hfEnv.useBrowserCache = true
    hfEnv.allowRemoteModels = true
    hfEnv.allowLocalModels = false

    // Disable proxy mode to avoid worker issues
    if (hfEnv.backends.onnx?.wasm) {
      hfEnv.backends.onnx.wasm.proxy = false
      console.log('[loadModel] WASM proxy disabled to avoid worker issues')
    }

    // Enable WebGPU support if available (falls back to WebGL/WASM)
    // WebGPU provides 2-5x speedup for inference compared to WASM
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator
    if (hasWebGPU) {
      console.log('[loadModel] WebGPU support enabled')
    } else {
      console.log('[loadModel] WebGPU not available, using WASM fallback')
    }

    // Initialize pipeline with proper options
    // Using smaller CLIP model for faster browser inference (3-5x speedup)
    // Note: Using Xenova/ prefix for ONNX-converted model (required for transformers.js browser compatibility)
    console.log('[loadModel] Starting CLIP model download from Hugging Face...')
    let lastLoggedPercent = -1
    extractor = await pipeline(
      'image-feature-extraction',
      'Xenova/clip-vit-base-patch32',
      {
        dtype: 'fp16', // Use half precision to fit in browser memory
        progress_callback: (progress: ProgressInfo) => {
          // Handle different progress types
          let msg = progress.status
          if ('file' in progress) {
            msg += ` ${progress.file}`
          }
          if ('progress' in progress && progress.progress !== undefined) {
            // Round to nearest whole percentage
            const wholePercent = Math.round(progress.progress)
            // Only log if percentage changed
            if (wholePercent !== lastLoggedPercent) {
              lastLoggedPercent = wholePercent
              msg += ` ${wholePercent}%`
              opts?.onProgress?.(msg.trim())
            }
          }
        },
      },
    )
    console.log('[loadModel] ✅ CLIP model loaded successfully')
  } catch (e: unknown) {
    const errorMsg = (e as Error)?.message || String(e)
    const isMemoryError =
      errorMsg.includes('330010576') ||
      errorMsg.includes('memory') ||
      errorMsg.includes('out of memory')
    const isWorkerError =
      errorMsg.includes('worker not ready') || errorMsg.includes('worker')

    if (isMemoryError) {
      throw new Error(
        'Not enough memory to load CLIP model. Try closing other tabs or refreshing the page. If the problem persists, your device may not have enough RAM.',
      )
    }

    if (isWorkerError) {
      console.error('[loadModel] Worker initialization failed. Diagnostics:')
      console.error(
        '  - SharedArrayBuffer:',
        typeof SharedArrayBuffer !== 'undefined',
      )
      console.error(
        '  - Check CORS headers: Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy',
      )
      console.error('  - Check browser console for WASM worker errors')
      throw new Error(
        `WASM worker failed to initialize. This usually means: (1) CORS headers not set correctly, (2) Running in an iframe, or (3) Browser doesn't support SharedArrayBuffer. Original: ${errorMsg}`,
      )
    }

    throw new Error(
      `Model load failed (transformers). Check network requests to huggingface/CDN for non-200 or text/html responses. Original: ${errorMsg}`,
    )
  }
}

export async function embedFromImageElement(imgEl: HTMLImageElement) {
  if (!extractor) throw new Error('Model not loaded')
  const out = await extractor(imgEl.src)
  return l2norm(Float32Array.from(out.data))
}

export function isModelReady(): boolean {
  return extractor !== null && meta !== null && db !== null
}

/**
 * Warm up the CLIP model by running a dummy inference pass.
 * This eliminates the first-inference penalty (2-5x slower) by:
 * 1. Compiling/JIT-compiling the model in the browser
 * 2. Allocating GPU memory if using WebGPU
 * 3. Caching intermediate results
 *
 * Best called when user hovers over a video stream (indicates intent to click a card).
 * Only warms once per session.
 *
 * @returns Promise that resolves when warmup is complete
 */
export async function warmModel(): Promise<void> {
  // Skip if already warmed or model not ready
  if (modelWarmed || !extractor) {
    return
  }

  try {
    const warmupStart = performance.now()
    console.log('[warmModel] Starting model warmup...')

    // Create a small dummy canvas (224×224) for warmup
    const dummyCanvas = document.createElement('canvas')
    dummyCanvas.width = 224
    dummyCanvas.height = 224
    const ctx = dummyCanvas.getContext('2d')
    if (ctx) {
      // Fill with neutral gray color
      ctx.fillStyle = '#808080'
      ctx.fillRect(0, 0, 224, 224)
    }

    // Run dummy inference to warm up the model
    await extractor(dummyCanvas)

    const warmupDuration = performance.now() - warmupStart
    modelWarmed = true
    console.log(
      `[warmModel] Model warmup complete in ${warmupDuration.toFixed(0)}ms`,
    )
  } catch (error) {
    console.warn('[warmModel] Warmup failed (non-fatal):', error)
    // Don't throw - warmup failure shouldn't break the app
  }
}

export type EmbeddingMetrics = {
  contrast: number
  inference: number
  normalization: number
  total: number
}

export async function embedFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<{ embedding: Float32Array; metrics: EmbeddingMetrics }> {
  if (!extractor) {
    throw new Error(
      'CLIP model not loaded. Please wait for initialization to complete.',
    )
  }
  if (!meta || !db) {
    throw new Error(
      'Embeddings database not loaded. Please wait for initialization to complete.',
    )
  }

  const totalStart = performance.now()
  console.log(
    '[embedFromCanvas] Starting inference on canvas',
    canvas.width,
    'x',
    canvas.height,
  )

  // Apply contrast enhancement if configured (must match database preprocessing)
  let processedCanvas = canvas
  let contrastDuration = 0
  if (QUERY_CONTRAST_ENHANCEMENT > 1.0) {
    console.log(
      `[embedFromCanvas] Applying contrast enhancement (factor: ${QUERY_CONTRAST_ENHANCEMENT})`,
    )
    const enhanceStart = performance.now()
    processedCanvas = enhanceCanvasContrast(canvas, QUERY_CONTRAST_ENHANCEMENT)
    contrastDuration = performance.now() - enhanceStart
    console.log(
      `[embedFromCanvas] Contrast enhancement took ${contrastDuration.toFixed(0)}ms`,
    )
    // Log enhanced image blob
    processedCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        console.groupCollapsed(
          '%c[DEBUG STAGE 5] Final card for CLIP embedding (with contrast enhancement)',
          'background: #E91E63; color: white; padding: 2px 6px; border-radius: 3px;',
        )
        console.log(
          '%c ',
          `background: url(${url}) no-repeat; background-size: contain; padding: 100px 150px;`,
        )
        console.log('Blob URL (copy this):', url)
        console.log(
          'Dimensions:',
          `${processedCanvas.width}x${processedCanvas.height}`,
        )
        console.log('Contrast factor:', QUERY_CONTRAST_ENHANCEMENT)
        console.groupEnd()
      }
    }, 'image/png')
  } else {
    // Log original image blob if no enhancement
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        console.groupCollapsed(
          '%c[DEBUG STAGE 5] Final card for CLIP embedding (no enhancement)',
          'background: #E91E63; color: white; padding: 2px 6px; border-radius: 3px;',
        )
        console.log(
          '%c ',
          `background: url(${url}) no-repeat; background-size: contain; padding: 100px 150px;`,
        )
        console.log('Blob URL (copy this):', url)
        console.log('Dimensions:', `${canvas.width}x${canvas.height}`)
        console.groupEnd()
      }
    }, 'image/png')
  }

  const inferenceStart = performance.now()
  const out = await extractor(processedCanvas)
  const inferenceDuration = performance.now() - inferenceStart
  console.log(
    `[embedFromCanvas] Inference took ${inferenceDuration.toFixed(0)}ms`,
  )

  const normStart = performance.now()
  const embedding = l2norm(Float32Array.from(out.data))
  const normDuration = performance.now() - normStart
  console.log(
    `[embedFromCanvas] L2 normalization took ${normDuration.toFixed(0)}ms`,
  )

  const totalDuration = performance.now() - totalStart
  const metrics: EmbeddingMetrics = {
    contrast: contrastDuration,
    inference: inferenceDuration,
    normalization: normDuration,
    total: totalDuration,
  }

  // Log embedding result
  console.log('[embedFromCanvas] ✅ Embedding complete:', {
    embeddingDim: embedding.length,
    embeddingNorm: Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    ),
    metrics,
  })

  return { embedding, metrics }
}

export function top1(q: Float32Array): (CardMeta & { score: number }) | null {
  if (!db || !meta) throw new Error('Database not loaded')

  console.log('[top1] Database status:', {
    metaCount: meta.length,
    dbLength: db.length,
    embeddingDim: D,
    queryDim: q.length,
  })

  const n = meta.length
  let best = -Infinity
  let idx = -1
  if (!db) {
    throw new Error('top1: Database not loaded')
  }
  for (let i = 0; i < n; i++) {
    let dot = 0
    for (let d = 0; d < D; d++) {
      if (d >= q.length) break
      const qVal = q[d]
      const dbVal = db[i * D + d]
      if (qVal === undefined) {
        throw new Error(`top1: Missing query value at index ${d}`)
      }
      if (dbVal === undefined) {
        throw new Error(`top1: Missing database value at index ${i * D + d}`)
      }
      dot += qVal * dbVal
    }
    if (dot > best) {
      best = dot
      idx = i
    }
  }

  console.log('[top1] Best match:', { index: idx, score: best })
  if (idx < 0) {
    console.log('[top1] WARNING: No match found. This should not happen.')
    console.log('[top1] Query embedding:', q)
    console.log('[top1] Database embeddings:', db)
    console.log('[top1] Database metadata:', meta)
    console.log('[top1] Detailed logging:')
    console.log('[top1] Embedding dimensions:', D)
    console.log('[top1] Query embedding length:', q.length)
    console.log('[top1] Database embedding length:', db.length)
    console.log('[top1] Metadata length:', meta.length)
    for (let i = 0; i < n; i++) {
      console.log(`[top1] Embedding ${i}:`, db.slice(i * D, (i + 1) * D))
    }
  }
  if (idx >= 0) {
    console.log('[top1] Matched card:', meta[idx])
  } else {
    console.log('[top1] No match found')
  }
  if (idx < 0) {
    return null
  }
  const matchedMeta = meta[idx]
  if (!matchedMeta) {
    throw new Error(`top1: Metadata not found at index ${idx}`)
  }
  return { ...matchedMeta, score: best }
}

/**
 * Get database embedding for a specific card by name
 * Useful for debugging and comparing browser embeddings with database embeddings
 */
export function getDatabaseEmbedding(cardName: string): {
  embedding: Float32Array
  metadata: CardMeta
  index: number
} | null {
  if (!meta || !db) throw new Error('Embeddings not loaded')

  const normalizedSearch = cardName.toLowerCase().trim()
  const index = meta.findIndex((m) => m.name.toLowerCase() === normalizedSearch)

  if (index === -1) {
    return null
  }

  // Extract embedding from database
  const embedding = new Float32Array(D)
  const offset = index * D
  for (let i = 0; i < D; i++) {
    const dbVal = db[offset + i]
    if (dbVal === undefined) {
      throw new Error(`getDatabaseEmbedding: Missing database value at index ${offset + i}`)
    }
    embedding[i] = dbVal
  }

  const matchedMeta = meta[index]
  if (!matchedMeta) {
    throw new Error(`getDatabaseEmbedding: Metadata not found at index ${index}`)
  }

  return {
    embedding,
    metadata: matchedMeta,
    index,
  }
}

/**
 * Compare two embeddings and return detailed statistics
 */
export function compareEmbeddings(
  embedding1: Float32Array,
  embedding2: Float32Array,
) {
  if (embedding1.length !== embedding2.length) {
    throw new Error(
      `Embedding dimensions don't match: ${embedding1.length} vs ${embedding2.length}`,
    )
  }

  // Cosine similarity (dot product of normalized vectors)
  let dotProduct = 0
  for (let i = 0; i < embedding1.length; i++) {
    const val1 = embedding1[i]
    const val2 = embedding2[i]
    if (val1 === undefined || val2 === undefined) {
      throw new Error(`compareEmbeddings: Missing value at index ${i}`)
    }
    dotProduct += val1 * val2
  }

  // L2 distance
  let l2Distance = 0
  for (let i = 0; i < embedding1.length; i++) {
    const val1 = embedding1[i]
    const val2 = embedding2[i]
    if (val1 === undefined || val2 === undefined) {
      throw new Error(`compareEmbeddings: Missing value at index ${i}`)
    }
    const diff = val1 - val2
    l2Distance += diff * diff
  }
  l2Distance = Math.sqrt(l2Distance)

  // Element-wise statistics
  const diffs = new Float32Array(embedding1.length)
  for (let i = 0; i < embedding1.length; i++) {
    const val1 = embedding1[i]
    const val2 = embedding2[i]
    if (val1 === undefined || val2 === undefined) {
      throw new Error(`compareEmbeddings: Missing value at index ${i}`)
    }
    diffs[i] = Math.abs(val1 - val2)
  }

  const maxDiff = Math.max(...diffs)
  const meanDiff = diffs.reduce((sum, v) => sum + v, 0) / diffs.length

  const comparison = {
    cosineSimilarity: dotProduct,
    l2Distance,
    maxAbsDifference: maxDiff,
    meanAbsDifference: meanDiff,
    dimension: embedding1.length,
  }

  return comparison
}

export function topK(query: Float32Array, K = 5) {
  if (!meta || !db) throw new Error('Embeddings not loaded')
  const N = meta.length
  const scores = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    let s = 0
    const off = i * D
    for (let j = 0; j < D; j++) {
      const qVal = query[j]
      const dbVal = db[off + j]
      if (qVal === undefined) {
        throw new Error(`topK: Missing query value at index ${j}`)
      }
      if (dbVal === undefined) {
        throw new Error(`topK: Missing database value at index ${off + j}`)
      }
      s += qVal * dbVal
    }
    scores[i] = s
  }
  const idx = Array.from(scores.keys())
  idx.sort((a, b) => {
    const scoreB = scores[b]
    const scoreA = scores[a]
    if (scoreB === undefined || scoreA === undefined) {
      throw new Error(`topK: Missing score at index ${a} or ${b}`)
    }
    return scoreB - scoreA
  })
  return idx.slice(0, K).map((i) => {
    const score = scores[i]
    const metaItem = (meta as CardMeta[])[i]
    if (score === undefined) {
      throw new Error(`topK: Missing score at index ${i}`)
    }
    if (!metaItem) {
      throw new Error(`topK: Missing metadata at index ${i}`)
    }
    return { score, ...metaItem }
  })
}

import type { EmbeddingMetrics } from '@/lib/clip-search'
import type { CardQueryResult } from '@/types/card-query'
import {
  addAppBreadcrumb,
  captureAppException,
  startAppSpan,
  startAppSpanSync,
} from '@/integrations/sentry/reporting'
import {
  embedFromCanvas,
  isModelReady,
  loadEmbeddingsAndMetaFromPackage,
  loadModel,
  top1,
  topK,
} from '@/lib/clip-search'
import { generateOrientationCandidates } from '@/lib/detectors/geometry/orientation'

const TOP_K = 5

interface CardQueryPipelineResult {
  result: CardQueryResult
  queryImageUrl: string
}

function logOrientationCandidate(candidate: HTMLCanvasElement, index: number) {
  candidate.toBlob((blob) => {
    if (!blob) return

    const url = URL.createObjectURL(blob)
    console.groupCollapsed(
      `%c[DEBUG STAGE 4] Card orientation candidate ${index} (ready for embedding)`,
      'background: #E91E63; color: white; padding: 2px 6px; border-radius: 3px;',
    )
    console.log(
      '%c ',
      `background: url(${url}) no-repeat; background-size: contain; padding: 150px;`,
    )
    console.log('Blob URL (copy this):', url)
    console.log('Dimensions:', `${candidate.width}x${candidate.height}`)
    console.groupEnd()
  }, 'image/png')
}

async function ensureCardQueryModelReady() {
  if (isModelReady()) return

  console.log('[useCardQuery] Model/database not ready, loading now...')
  await Promise.all([
    startAppSpan(
      { name: 'Load embeddings database', op: 'ml.embeddings.load' },
      () => loadEmbeddingsAndMetaFromPackage(),
    ),
    startAppSpan({ name: 'Load CLIP model', op: 'ml.model.load' }, () =>
      loadModel(),
    ),
  ])
  console.log('[useCardQuery] Model and database loaded successfully')
}

export async function runCardQueryPipeline(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
): Promise<CardQueryPipelineResult | null> {
  if (signal.aborted) return null

  try {
    await ensureCardQueryModelReady()
  } catch (loadErr) {
    console.error('[useCardQuery] Failed to load model/database:', loadErr)
    captureAppException(loadErr, {
      tags: { feature: 'scanner', operation: 'load_model_or_database' },
    })
    throw loadErr
  }

  if (signal.aborted) return null

  console.log('[useCardQuery] Generating orientation candidates...')
  const orientationCandidates = startAppSpanSync(
    {
      name: 'Generate orientation candidates',
      op: 'scanner.orientation',
    },
    () => generateOrientationCandidates(canvas),
  )
  if (!orientationCandidates.length) {
    throw new Error('useCardQuery: Failed to generate orientation candidates')
  }
  console.log(
    '[useCardQuery] Generated orientation candidates:',
    orientationCandidates.length,
  )

  let bestResult: ReturnType<typeof top1> | null = null
  let bestScore = -Infinity
  let bestOrientation = -1
  let bestEmbeddingMetrics: EmbeddingMetrics | null = null
  let totalEmbeddingMs = 0
  let totalSearchMs = 0
  let bestEmbedding: Float32Array | null = null

  for (let i = 0; i < orientationCandidates.length; i += 1) {
    const candidate = orientationCandidates[i]
    if (!candidate) continue
    if (signal.aborted) return null

    logOrientationCandidate(candidate, i)
    console.log(
      `[useCardQuery] Proceeding to embed orientation candidate ${i} (toBlob logged asynchronously above)`,
    )

    console.log(`[useCardQuery] Starting embedding for orientation ${i}...`)
    let embedding: Float32Array
    let embeddingMetrics: EmbeddingMetrics
    try {
      const embeddingResult = await startAppSpan(
        {
          name: 'Embed card candidate',
          op: 'ml.embedding',
          attributes: { orientation: i },
        },
        () => embedFromCanvas(candidate),
      )
      embedding = embeddingResult.embedding
      embeddingMetrics = embeddingResult.metrics
    } catch (err) {
      console.error(
        `[useCardQuery] Failed to embed canvas for orientation ${i}:`,
        err,
      )
      captureAppException(err, {
        tags: {
          feature: 'scanner',
          operation: 'embed_canvas',
          orientation: i,
        },
      })
      throw new Error(
        `Failed to embed canvas: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    totalEmbeddingMs += embeddingMetrics.total
    console.log(`[useCardQuery] Embedding completed for orientation ${i}`)

    console.log('[useCardQuery] Embedding dimension:', embedding.length)
    console.log('[useCardQuery] About to query database with top1()...')
    const searchStart = performance.now()
    let result
    try {
      result = startAppSpanSync(
        {
          name: 'Search card index',
          op: 'ml.vector_search',
          attributes: { orientation: i },
        },
        () => top1(embedding),
      )
      console.log('[useCardQuery] top1() returned result:', result)
    } catch (err) {
      console.error('[useCardQuery] top1() threw error:', err)
      captureAppException(err, {
        tags: {
          feature: 'scanner',
          operation: 'search_card_index',
          orientation: i,
        },
      })
      throw err
    }
    const searchMs = performance.now() - searchStart
    totalSearchMs += searchMs
    console.log(
      `[useCardQuery] Database search completed in ${searchMs.toFixed(0)}ms (orientation ${i})`,
    )
    console.log('[useCardQuery] Search result:', result)

    const orientationLabel = ['0°', '90°', '180°', '270°'][i] || `${i * 90}°`
    console.log(
      `%c[ORIENTATION ${i}] ${orientationLabel} → score=${result?.score?.toFixed(4) ?? 'N/A'} match="${result?.name ?? 'none'}"`,
      result && result.score > bestScore
        ? 'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;'
        : 'background: #9E9E9E; color: white; padding: 2px 6px; border-radius: 3px;',
    )

    if (result && result.score > bestScore) {
      bestScore = result.score
      bestResult = result
      bestOrientation = i
      bestEmbeddingMetrics = embeddingMetrics
      bestEmbedding = embedding
    }
  }

  if (!bestResult) {
    throw new Error('No valid result from database search')
  }

  const winningLabel =
    ['0°', '90°', '180°', '270°'][bestOrientation] || `${bestOrientation * 90}°`
  console.log(
    `%c[ORIENTATION WINNER] ${winningLabel} (index ${bestOrientation}) → score=${bestScore.toFixed(4)} match="${bestResult.name}"`,
    'background: #2196F3; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold; font-size: 12px;',
  )

  if (signal.aborted) return null

  if (bestEmbedding) {
    const topKResults = startAppSpanSync(
      { name: 'Search top card matches', op: 'ml.vector_search.top_k' },
      () => topK(bestEmbedding, TOP_K),
    )
    console.groupCollapsed(
      `[useCardQuery] Top-${TOP_K} results (orientation ${bestOrientation})`,
    )
    topKResults.forEach((item, index) => {
      console.log(
        `#${index + 1} score=${item.score.toFixed(4)} name="${item.name}" set=${item.set}`,
      )
    })
    console.groupEnd()
  }

  const canvasWithMetrics = canvas as HTMLCanvasElement & {
    __pipelineMetrics?: { detection: number; crop: number }
  }
  if (canvasWithMetrics.__pipelineMetrics) {
    const metrics = canvasWithMetrics.__pipelineMetrics
    const totalMs =
      metrics.detection + metrics.crop + totalEmbeddingMs + totalSearchMs

    console.log('🎯 Pipeline Performance:', {
      Detection: `${metrics.detection.toFixed(0)}ms`,
      'Crop & Warp': `${metrics.crop.toFixed(0)}ms`,
      Embedding: `${totalEmbeddingMs.toFixed(0)}ms`,
      Search: `${totalSearchMs.toFixed(0)}ms`,
      Total: `${totalMs.toFixed(0)}ms`,
    })
    addAppBreadcrumb('scanner', 'Card query pipeline timing', {
      detectionMs: Math.round(metrics.detection),
      cropWarpMs: Math.round(metrics.crop),
      embeddingMs: Math.round(totalEmbeddingMs),
      searchMs: Math.round(totalSearchMs),
      totalMs: Math.round(totalMs),
      bestOrientation,
    })
    console.log('[useCardQuery] Best orientation index:', bestOrientation)

    if (bestEmbeddingMetrics && bestEmbeddingMetrics.contrast > 0) {
      console.log('📊 Embedding Breakdown:', {
        'Contrast Enhancement': `${bestEmbeddingMetrics.contrast.toFixed(0)}ms`,
        'CLIP Inference': `${bestEmbeddingMetrics.inference.toFixed(0)}ms`,
        'L2 Normalization': `${bestEmbeddingMetrics.normalization.toFixed(0)}ms`,
        'Total Embedding': `${bestEmbeddingMetrics.total.toFixed(0)}ms`,
      })
    } else {
      console.log('📊 Embedding Breakdown:', {
        'CLIP Inference': `${bestEmbeddingMetrics?.inference.toFixed(0) ?? '0'}ms`,
        'L2 Normalization': `${bestEmbeddingMetrics?.normalization.toFixed(0) ?? '0'}ms`,
        'Total Embedding': `${bestEmbeddingMetrics?.total.toFixed(0) ?? '0'}ms`,
      })
    }
  }

  const winningCanvas = orientationCandidates[bestOrientation]
  return {
    result: bestResult,
    queryImageUrl: winningCanvas
      ? winningCanvas.toDataURL('image/png')
      : canvas.toDataURL('image/png'),
  }
}

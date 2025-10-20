import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import {
  loadEmbeddingsAndMetaFromPackage,
  loadModel,
  embedFromCanvas,
  topK,
  getDatabaseEmbedding,
  compareEmbeddings,
} from '../lib/clip-search'

export const Route = createFileRoute('/test-stand-together')({
  component: TestStandTogether,
})

type TestResult = {
  rank: number
  name: string
  set: string
  score: number
  isCorrect: boolean
}

function TestStandTogether() {
  const [status, setStatus] = useState<{
    message: string
    type: 'idle' | 'loading' | 'success' | 'warning' | 'error'
  }>({ message: 'Ready to test', type: 'idle' })
  const [results, setResults] = useState<TestResult[]>([])
  const [embeddingsLoaded, setEmbeddingsLoaded] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Preprocess image: pad to square and resize to 336×336
  const preprocessImage = (img: HTMLImageElement) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = img.naturalWidth
    const h = img.naturalHeight
    const s = Math.max(w, h)

    // Create temporary canvas for padding
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = s
    tempCanvas.height = s
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    // Fill with black
    tempCtx.fillStyle = '#000000'
    tempCtx.fillRect(0, 0, s, s)

    // Center the image
    const pasteX = (s - w) / 2
    const pasteY = (s - h) / 2
    tempCtx.drawImage(img, pasteX, pasteY, w, h)

    // Draw to final 336×336 canvas
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 336, 336)
    ctx.drawImage(tempCanvas, 0, 0, 336, 336)

    console.log(
      `Preprocessed: ${w}×${h} → ${s}×${s} (padded) → 336×336 (resized)`,
    )
  }

  // Auto-preprocess when image loads
  useEffect(() => {
    const img = imageRef.current
    if (img && img.complete) {
      preprocessImage(img)
    }
  }, [])

  const handleLoadEmbeddings = async () => {
    try {
      setStatus({ message: 'Loading embeddings database...', type: 'loading' })

      await loadEmbeddingsAndMetaFromPackage()

      setStatus({
        message: '✓ Embeddings database loaded successfully',
        type: 'success',
      })
      setEmbeddingsLoaded(true)
    } catch (e) {
      setStatus({
        message: `✗ Failed to load embeddings: ${(e as Error).message}`,
        type: 'error',
      })
    }
  }

  const handleLoadModel = async () => {
    try {
      setStatus({
        message:
          'Loading CLIP model (ViT-L/14@336px)... This may take 30-60s on first load.',
        type: 'loading',
      })

      await loadModel({
        onProgress: (msg) => {
          setStatus({ message: `Loading model: ${msg}`, type: 'loading' })
        },
      })

      setStatus({ message: '✓ CLIP model loaded successfully', type: 'success' })
      setModelLoaded(true)
    } catch (e) {
      setStatus({
        message: `✗ Failed to load model: ${(e as Error).message}`,
        type: 'error',
      })
    }
  }

  const handleRunTest = async () => {
    try {
      setResults([])
      setStatus({ message: 'Running recognition test...', type: 'loading' })

      const canvas = canvasRef.current
      const img = imageRef.current
      if (!canvas || !img) {
        throw new Error('Canvas or image not ready')
      }

      // Preprocess image
      preprocessImage(img)

      // Embed
      setStatus({ message: 'Embedding image with CLIP...', type: 'loading' })
      const embedding = await embedFromCanvas(canvas)
      console.log('Browser embedding shape:', embedding.length)
      
      // Compare with database embedding
      console.log('\n=== EMBEDDING COMPARISON ===')
      const dbResult = getDatabaseEmbedding('Stand Together')
      if (dbResult) {
        console.log('Database embedding found at index:', dbResult.index)
        console.log('Database metadata:', dbResult.metadata)
        
        const comparison = compareEmbeddings(
          embedding,
          dbResult.embedding,
          'Browser Embedding',
          'Database Embedding'
        )
        
        console.log('\n📊 Comparison Summary:')
        console.log(`  Cosine Similarity: ${comparison.cosineSimilarity.toFixed(6)} (should be ~1.0 for identical)`)
        console.log(`  L2 Distance: ${comparison.l2Distance.toFixed(6)} (should be ~0.0 for identical)`)
        console.log(`  Max Difference: ${comparison.maxAbsDifference.toFixed(6)}`)
        console.log(`  Mean Difference: ${comparison.meanAbsDifference.toFixed(6)}`)
        
        if (comparison.cosineSimilarity < 0.95) {
          console.warn('⚠️  Low similarity detected! Preprocessing mismatch likely.')
        } else if (comparison.cosineSimilarity >= 0.99) {
          console.log('✅ Excellent alignment! Preprocessing is correct.')
        }
      } else {
        console.error('❌ Stand Together not found in database!')
      }
      console.log('=== END COMPARISON ===\n')

      // Search
      setStatus({ message: 'Searching database...', type: 'loading' })
      const searchResults = topK(embedding, 10)

      // Process results
      const processedResults: TestResult[] = searchResults.map((result, i) => ({
        rank: i + 1,
        name: result.name,
        set: result.set,
        score: result.score,
        isCorrect: result.name.toLowerCase().includes('stand together'),
      }))

      setResults(processedResults)

      // Summary
      const standTogether = processedResults.find((r) => r.isCorrect)
      if (standTogether && standTogether.rank === 1) {
        if (standTogether.score >= 0.95) {
          setStatus({
            message: `✅ SUCCESS: Stand Together matched with excellent score (${standTogether.score.toFixed(4)})`,
            type: 'success',
          })
        } else if (standTogether.score >= 0.85) {
          setStatus({
            message: `⚠️ WARNING: Stand Together matched but score lower than expected (${standTogether.score.toFixed(4)}). Expected: ~0.95`,
            type: 'warning',
          })
        } else {
          setStatus({
            message: `❌ FAIL: Stand Together matched but score too low (${standTogether.score.toFixed(4)})`,
            type: 'error',
          })
        }
      } else if (standTogether) {
        setStatus({
          message: `❌ FAIL: Stand Together found at rank #${standTogether.rank} (score: ${standTogether.score.toFixed(4)})`,
          type: 'error',
        })
      } else {
        setStatus({
          message: `❌ FAIL: Stand Together not found in top 10 results`,
          type: 'error',
        })
      }
    } catch (e) {
      setStatus({
        message: `✗ Test failed: ${(e as Error).message}`,
        type: 'error',
      })
      console.error(e)
    }
  }

  const getStatusColor = () => {
    switch (status.type) {
      case 'loading':
        return 'bg-blue-900/50 text-blue-200'
      case 'success':
        return 'bg-green-900/50 text-green-200'
      case 'warning':
        return 'bg-yellow-900/50 text-yellow-200'
      case 'error':
        return 'bg-red-900/50 text-red-200'
      default:
        return 'bg-gray-800/50 text-gray-300'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.95) return 'text-green-400'
    if (score >= 0.85) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-green-400 mb-2">
          🧪 Stand Together Recognition Test
        </h1>
        <p className="text-gray-400 mb-8">
          Testing perspective-warped card recognition with the browser CLIP
          pipeline.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Input Image */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">Input Image</h2>
            <img
              ref={imageRef}
              src="/data/mtg-embeddings/stand_together.jpg"
              alt="Stand Together test image"
              className="w-full border border-gray-700 rounded"
              onLoad={(e) => preprocessImage(e.currentTarget)}
            />
            <p className="text-sm text-gray-400 mt-2">
              <strong>Source:</strong> Perspective-warped Stand Together (before
              padding)
            </p>
          </div>

          {/* Preprocessed Canvas */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">
              Preprocessed Canvas (336×336)
            </h2>
            <canvas
              ref={canvasRef}
              width={336}
              height={336}
              className="w-full border-2 border-green-500 rounded"
            />
            <p className="text-sm text-gray-400 mt-2">
              <em>Black-padded and resized to match database preprocessing</em>
            </p>
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>

          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={handleLoadEmbeddings}
              disabled={embeddingsLoaded}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-500 font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              1. Load Embeddings Database
            </button>

            <button
              onClick={handleLoadModel}
              disabled={!embeddingsLoaded || modelLoaded}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-500 font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              2. Load CLIP Model
            </button>

            <button
              onClick={handleRunTest}
              disabled={!modelLoaded}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-500 font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              3. Run Recognition Test
            </button>
          </div>

          {/* Status */}
          <div
            className={`px-4 py-3 rounded font-mono text-sm ${getStatusColor()}`}
          >
            {status.message}
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h3 className="text-xl font-semibold mb-4">Top 10 Matches</h3>
            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.rank}
                  className={`p-4 rounded ${
                    result.rank === 1
                      ? 'bg-yellow-900/20 border-l-4 border-yellow-500'
                      : 'bg-gray-800 border-l-4 border-green-500'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <strong className="text-gray-300">#{result.rank}</strong>{' '}
                      {result.name}{' '}
                      <span className="text-gray-500">
                        [{result.set.toUpperCase()}]
                      </span>
                      {result.isCorrect && (
                        <span className="ml-2 text-green-400 font-semibold">
                          ✓ CORRECT
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-lg font-bold ${getScoreColor(result.score)}`}
                    >
                      {result.score.toFixed(4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

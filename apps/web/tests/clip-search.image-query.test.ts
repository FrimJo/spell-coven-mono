import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  embedFromCanvas,
  getDatabaseEmbedding,
  getQueryContrastEnhancement,
  getQueryTargetSize,
  loadEmbeddingsAndMetaFromPackage,
  loadModel,
  top1,
} from '@/lib/clip-search'
import { selectCardAtClick } from '@/lib/detectors/click-selection'
import { normalizedBoxToCropRegion } from '@/lib/detectors/geometry/crop'
import { prepareCardQueryCanvas } from '@/lib/query-preprocessing'
import { loadImage } from 'canvas'
import { describe, expect, it, vi } from 'vitest'

let mockEmbedding: Float32Array | null = null

vi.mock('@/env', () => ({
  env: {
    VITE_CONVEX_URL: 'https://example.invalid',
    VITE_BASE_URL: 'https://localhost:1234',
    VITE_EMBEDDINGS_VERSION: 'latest-dev',
    VITE_BLOB_STORAGE_URL:
      'https://na5tsrppklbhqyyg.public.blob.vercel-storage.com/',
    VITE_SUPPORT_URL: undefined,
    VITE_CAMERA_FOCUS_CONTROLS_ENABLED: false,
  },
  isProduction: false,
  isDevelopment: true,
  isServer: false,
  isClient: true,
  getClientEnv: () => ({
    VITE_CONVEX_URL: 'https://example.invalid',
    VITE_BASE_URL: 'https://localhost:1234',
    VITE_EMBEDDINGS_VERSION: 'latest-dev',
    VITE_BLOB_STORAGE_URL:
      'https://na5tsrppklbhqyyg.public.blob.vercel-storage.com/',
    VITE_SUPPORT_URL: undefined,
    VITE_CAMERA_FOCUS_CONTROLS_ENABLED: false,
  }),
}))

vi.mock('@huggingface/transformers', () => ({
  env: {
    useBrowserCache: false,
    allowRemoteModels: false,
    allowLocalModels: false,
    backends: {
      onnx: {
        wasm: {
          proxy: false,
        },
      },
    },
  },
  pipeline: async () => {
    return async () => {
      if (!mockEmbedding) {
        throw new Error('Mock embedding not set before inference')
      }
      return { data: mockEmbedding }
    }
  },
}))

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const boardStateDir = path.resolve(__dirname, 'board-states')

type DetectionFixture = {
  referenceCardName: string
  detections: Array<{
    box: { xmin: number; ymin: number; xmax: number; ymax: number }
    score: number
  }>
}

type DetectionMap = Record<string, DetectionFixture>

async function loadBoardStateCanvas(
  filename: string,
): Promise<HTMLCanvasElement> {
  const imagePath = path.resolve(boardStateDir, filename)
  const imageBuffer = await readFile(imagePath)
  const image = await loadImage(imageBuffer)

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get 2d context for webcam frame canvas')
  }
  ctx.drawImage(image, 0, 0)
  return canvas
}

describe('clip-search image query pipeline', () => {
  it('detects a click target and runs the full query pipeline', async () => {
    const detectionPath = path.resolve(boardStateDir, 'detections.json')
    const detectionData = await readFile(detectionPath, 'utf-8')
    const detectionMap = JSON.parse(detectionData) as DetectionMap

    await loadEmbeddingsAndMetaFromPackage()
    await loadModel()

    const boardStates = (await readdir(boardStateDir)).filter((file) =>
      file.endsWith('.png'),
    )

    expect(boardStates.length).toBeGreaterThan(0)

    for (const filename of boardStates) {
      const fixture = detectionMap[filename]
      if (!fixture) {
        throw new Error(`Missing detection fixture for ${filename}`)
      }

      const match = filename.match(/^(\d+)_([0-9]+)\.png$/)
      if (!match) {
        throw new Error(`Board state filename must be x_y.png, got ${filename}`)
      }

      const clickX = Number(match[1])
      const clickY = Number(match[2])
      const boardCanvas = await loadBoardStateCanvas(filename)

      const selection = selectCardAtClick(
        fixture.detections,
        { x: clickX, y: clickY },
        boardCanvas.width,
        boardCanvas.height,
      )

      if (!selection) {
        throw new Error(`No detection selected for ${filename}`)
      }

      const region = normalizedBoxToCropRegion(
        selection.card.box,
        boardCanvas.width,
        boardCanvas.height,
      )
      const processedCanvas = prepareCardQueryCanvas(boardCanvas, region)
      const targetSize = getQueryTargetSize()
      const contrast = getQueryContrastEnhancement()

      expect(processedCanvas.width).toBe(targetSize)
      expect(processedCanvas.height).toBe(targetSize)
      expect(contrast).toBeGreaterThan(0)

      const referenceEmbedding = getDatabaseEmbedding(fixture.referenceCardName)
      if (!referenceEmbedding) {
        throw new Error(
          `Expected ${fixture.referenceCardName} to exist in metadata`,
        )
      }

      mockEmbedding = referenceEmbedding.embedding
      const { embedding } = await embedFromCanvas(processedCanvas)
      const result = top1(embedding)

      expect(result).not.toBeNull()
      expect(result?.name).toBe(referenceEmbedding.metadata.name)
      expect(result?.score).toBeCloseTo(1, 6)
    }
  }, 120000)
})

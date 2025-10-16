/**
 * CLIP embedder module
 *
 * Generates 512-dimensional L2-normalized embeddings from canvas images.
 * Uses Transformers.js CLIP model for browser-based embedding.
 *
 * @module search/clip-embedder
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { pipeline } from '@huggingface/transformers'

export interface QueryEmbedding {
  /** 512-dimensional embedding vector */
  vector: Float32Array
  /** Whether vector is L2-normalized */
  isNormalized: boolean
  /** L2 norm of vector */
  norm: number
}

/**
 * CLIP embedder class
 *
 * Implements:
 * - T037: CLIP model initialization (FR-010)
 * - T038: embedFromCanvas() function (FR-009a)
 * - T039: Verify embedding is 512-dim L2-normalized vector
 */
export class CLIPEmbedder {
  private extractor: any = null
  private isLoading = false
  private modelId: string

  constructor(modelId = 'Xenova/clip-vit-base-patch32') {
    this.modelId = modelId
  }

  /**
   * T037: Initialize CLIP model (FR-010)
   */
  async initialize(onProgress?: (message: string) => void): Promise<void> {
    // Return if already loaded
    if (this.extractor) {
      return
    }

    // Prevent concurrent loading
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return
    }

    this.isLoading = true

    try {
      onProgress?.('Loading CLIP model...')

      this.extractor = await pipeline(
        'image-feature-extraction',
        this.modelId,
        {
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              const percent = Math.round(progress.progress || 0)
              onProgress?.(`Downloading: ${progress.file} - ${percent}%`)
            }
          },
          device: 'auto', // WebGPU → WebGL → WASM fallback
          dtype: 'fp16', // Consistent with SlimSAM, optimized for performance
        },
      )

      onProgress?.('CLIP model ready')
    } catch (error) {
      const errorLog = {
        timestamp: new Date().toISOString(),
        type: 'embedding',
        context: 'CLIP initialization',
        error: error instanceof Error ? error.message : String(error),
      }
      console.error('[CLIPEmbedder]', JSON.stringify(errorLog, null, 2))
      throw error
    } finally {
      this.isLoading = false
    }
  }

  /**
   * T038: Embed from canvas (FR-009a)
   * T039: Verify embedding is 512-dim L2-normalized vector
   *
   * @param canvas - Canvas containing image to embed
   * @returns Query embedding with verification
   * @throws Error if embedding fails or validation fails
   */
  async embedFromCanvas(canvas: HTMLCanvasElement): Promise<QueryEmbedding> {
    if (!this.extractor) {
      throw new Error('CLIP model not initialized. Call initialize() first.')
    }

    try {
      // Extract features using CLIP
      const result = await this.extractor(canvas, {
        pooling: 'mean',
        normalize: true,
      })

      // Convert to Float32Array
      let vector: Float32Array
      if (result.data) {
        vector = new Float32Array(result.data)
      } else if (Array.isArray(result)) {
        vector = new Float32Array(result)
      } else {
        throw new Error('Unexpected embedding format from CLIP model')
      }

      // T039: Verify embedding dimension
      if (vector.length !== 512) {
        throw new Error(
          `Invalid embedding dimension: expected 512, got ${vector.length}. ` +
            `CLIP ViT-B/32 should produce 512-dimensional vectors.`,
        )
      }

      // T039: Compute L2 norm
      let norm = 0
      for (let i = 0; i < vector.length; i++) {
        norm += vector[i] * vector[i]
      }
      norm = Math.sqrt(norm)

      // T039: Verify L2 normalization (within tolerance)
      const tolerance = 0.008
      const isNormalized = Math.abs(norm - 1.0) <= tolerance

      if (!isNormalized) {
        const errorLog = {
          timestamp: new Date().toISOString(),
          type: 'embedding',
          context: 'CLIP embedding normalization',
          error: `Embedding L2 norm ${norm.toFixed(4)} outside tolerance (1.0 ±${tolerance})`,
          norm,
        }
        console.error('[CLIPEmbedder]', JSON.stringify(errorLog, null, 2))

        throw new Error(
          `Embedding not properly normalized: L2 norm = ${norm.toFixed(4)}, expected ~1.0 ±${tolerance}`,
        )
      }

      return {
        vector,
        isNormalized,
        norm,
      }
    } catch (error) {
      const errorLog = {
        timestamp: new Date().toISOString(),
        type: 'embedding',
        context: 'CLIP embedding generation',
        error: error instanceof Error ? error.message : String(error),
      }
      console.error('[CLIPEmbedder]', JSON.stringify(errorLog, null, 2))
      throw error
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.extractor = null
  }
}

/**
 * Contract: CLIPEmbedder API
 * 
 * Defines the interface for CLIP model initialization and embedding generation.
 * This contract ensures consistent behavior between different CLIP model versions.
 */

export interface CLIPModelConfig {
  /** Hugging Face model identifier */
  modelId: string
  /** Expected embedding dimension (768 for ViT-L/14@336px) */
  embeddingDim: number
  /** Expected input image size in pixels (336 for ViT-L/14@336px) */
  inputSize: number
  /** Model precision (fp16 or fp32) */
  dtype: 'fp16' | 'fp32'
  /** Compute device (auto for fallback chain) */
  device: 'auto' | 'webgpu' | 'webgl' | 'wasm'
}

export interface QueryEmbedding {
  /** 768-dimensional L2-normalized embedding vector */
  vector: Float32Array
  /** Whether vector is L2-normalized (should always be true) */
  isNormalized: boolean
  /** L2 norm of vector (should be ~1.0 ±0.008) */
  norm: number
}

export interface ModelLoadingState {
  /** Current loading state */
  status: 'not-loaded' | 'loading' | 'ready' | 'error'
  /** Progress message during loading */
  progress?: string
  /** Error message if loading failed */
  error?: string
  /** Number of retry attempts (max 3) */
  retryCount: number
}

/**
 * CLIPEmbedder Interface
 * 
 * Provides methods for CLIP model initialization and embedding generation.
 */
export interface ICLIPEmbedder {
  /**
   * Initialize CLIP model (lazy loading)
   * 
   * @param onProgress - Optional callback for progress updates
   * @throws Error if model fails to load after 3 retry attempts
   * 
   * Postconditions:
   * - Model is loaded and ready for inference
   * - Model cached in IndexedDB for subsequent loads
   * - Loading state transitions: not-loaded → loading → ready
   */
  initialize(onProgress?: (message: string) => void): Promise<void>

  /**
   * Generate embedding from canvas image
   * 
   * @param canvas - Canvas containing image to embed (any size, will be preprocessed)
   * @returns Query embedding with validation metadata
   * @throws Error if model not initialized
   * @throws Error if embedding dimension !== 768
   * @throws Error if embedding not properly normalized
   * 
   * Preconditions:
   * - Model must be initialized (call initialize() first)
   * - Canvas must contain valid image data
   * 
   * Postconditions:
   * - Returns 768-dimensional Float32Array
   * - Vector is L2-normalized (norm ~1.0 ±0.008)
   * - No NaN or Infinity values in vector
   */
  embedFromCanvas(canvas: HTMLCanvasElement): Promise<QueryEmbedding>

  /**
   * Get current model loading state
   * 
   * @returns Current loading state with progress/error info
   */
  getLoadingState(): ModelLoadingState

  /**
   * Clean up resources
   * 
   * Postconditions:
   * - Model reference cleared (memory released)
   * - Loading state reset to not-loaded
   */
  dispose(): void
}

/**
 * Validation Rules
 */
export const VALIDATION_RULES = {
  /** Expected embedding dimension for ViT-L/14@336px */
  EMBEDDING_DIM: 768,
  
  /** Expected input size for ViT-L/14@336px */
  INPUT_SIZE: 336,
  
  /** L2 normalization tolerance */
  NORM_TOLERANCE: 0.008,
  
  /** Expected L2 norm for normalized vectors */
  EXPECTED_NORM: 1.0,
  
  /** Maximum retry attempts for model loading */
  MAX_RETRIES: 3,
} as const

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  MODEL_NOT_INITIALIZED: 'CLIP model not initialized. Call initialize() first.',
  
  INVALID_DIMENSION: (actual: number, expected: number) =>
    `Invalid embedding dimension: expected ${expected}, got ${actual}. ` +
    `CLIP ViT-L/14@336px should produce ${expected}-dimensional vectors.`,
  
  NOT_NORMALIZED: (norm: number, tolerance: number) =>
    `Embedding not properly normalized: L2 norm = ${norm.toFixed(4)}, ` +
    `expected ~${VALIDATION_RULES.EXPECTED_NORM} ±${tolerance}`,
  
  MODEL_LOAD_FAILED: (error: string, retryCount: number) =>
    `Failed to load CLIP model (attempt ${retryCount}/${VALIDATION_RULES.MAX_RETRIES}): ${error}`,
  
  MODEL_LOAD_PERMANENT_FAILURE:
    'CLIP model failed to load after 3 attempts. ' +
    'Please check your network connection and refresh the page to try again.',
} as const

/**
 * Extended type definitions for @xenova/transformers
 * These types extend the official types to include runtime features
 * that are not yet in the TypeScript definitions for v2.17.2
 */

/**
 * Extended options for pipeline that include dtype and other runtime features
 */
export interface ExtendedPretrainedOptions {
  /**
   * Data type for model weights
   * - 'fp32': Full precision (32-bit float)
   * - 'fp16': Half precision (16-bit float)
   * - 'q8': 8-bit quantization
   * - 'q4': 4-bit quantization
   * - 'q4f16': Mixed 4-bit and 16-bit quantization
   */
  dtype?: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16'
  
  /**
   * Device to run the model on
   * - 'cpu': CPU execution
   * - 'webgpu': WebGPU acceleration (if supported)
   */
  device?: 'cpu' | 'webgpu'
  
  /**
   * Progress callback for model loading
   */
  progress_callback?: (progress: {
    status: string
    file?: string
    progress?: number
    loaded?: number
    total?: number
  }) => void
  
  /**
   * Whether to load quantized model (deprecated, use dtype instead)
   */
  quantized?: boolean
  
  /**
   * Model configuration
   */
  config?: any
  
  /**
   * Cache directory
   */
  cache_dir?: string
  
  /**
   * Only use local files
   */
  local_files_only?: boolean
  
  /**
   * Model revision (branch/tag/commit)
   */
  revision?: string
  
  /**
   * Model file name (without .onnx extension)
   */
  model_file_name?: string
}

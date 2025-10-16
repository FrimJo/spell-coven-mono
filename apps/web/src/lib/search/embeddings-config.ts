/**
 * Embeddings configuration
 *
 * Provides paths to versioned embedding artifacts.
 * Version is controlled via VITE_EMBEDDINGS_VERSION environment variable.
 *
 * @module search/embeddings-config
 */

/**
 * Get the embeddings version from environment
 * Defaults to 'v1.0' if not set
 */
export function getEmbeddingsVersion(): string {
  return import.meta.env.VITE_EMBEDDINGS_VERSION || 'v1.0'
}

/**
 * Get the base path for embeddings data
 * Points to versioned directory in public/data/mtg-embeddings/
 */
export function getEmbeddingsBasePath(): string {
  const version = getEmbeddingsVersion()
  return `/data/mtg-embeddings/${version}`
}

/**
 * Get the full URL for embeddings binary file
 */
export function getEmbeddingsBinaryUrl(): string {
  return `${getEmbeddingsBasePath()}/embeddings.i8bin`
}

/**
 * Get the full URL for metadata JSON file
 */
export function getMetadataUrl(): string {
  return `${getEmbeddingsBasePath()}/meta.json`
}

/**
 * Get the full URL for build manifest file
 */
export function getBuildManifestUrl(): string {
  return `${getEmbeddingsBasePath()}/build_manifest.json`
}

/**
 * Type contracts for card cropping and image database query feature
 *
 * These interfaces define the data structures used for card identification
 * queries in the game room interface.
 *
 * @module card-query
 */

/**
 * Result of a card identification query from the image database
 *
 * Returned by the top1() function from @/lib/search after embedding
 * a cropped card image and finding the best match.
 */
export interface CardQueryResult {
  /** Card name (e.g., "Lightning Bolt") */
  name: string

  /** Set code (e.g., "LEA", "M21") */
  set: string

  /** Cosine similarity score between 0.0 and 1.0 */
  score: number

  /** Optional link to Scryfall card page */
  scryfall_uri?: string

  /** Optional URL to card art crop image */
  image_url?: string

  /** Optional URL to full card image */
  card_url?: string
}

/**
 * State of a card identification query operation
 *
 * Managed by the useCardQuery hook to track query lifecycle.
 */
export interface CardQueryState {
  /** Current query status */
  status: 'idle' | 'querying' | 'success' | 'error'

  /** Query result (present when status is 'success') */
  result: CardQueryResult | null

  /** Error message (present when status is 'error') */
  error: string | null
}

/**
 * State of CLIP model and embeddings initialization
 *
 * Used to manage whole-page loading overlay during startup.
 */
export interface ModelLoadingState {
  /** Whether model/embeddings are currently loading */
  isLoading: boolean

  /** Progress message (e.g., "Loading embeddings...", "Downloading CLIP model...") */
  progress: string

  /** Whether system is ready for queries */
  isReady: boolean
}

/**
 * Cropped card image data ready for querying
 *
 * Created when user clicks a detected card in the video stream.
 */
export interface CroppedCardData {
  /** Canvas containing cropped card (446x620px) */
  canvas: HTMLCanvasElement

  /** When the crop was created (for cancellation tracking) */
  timestamp: number

  /** Whether canvas contains non-empty image data */
  hasData: boolean
}

/**
 * Props for CardResultDisplay component
 */
export interface CardResultDisplayProps {
  /** Callback to trigger when a card is clicked in the video stream */
  onCardCrop: (canvas: HTMLCanvasElement) => void

  /** Whether the model and embeddings are loaded and ready */
  isModelReady: boolean
}

/**
 * Props for card-result component (presentational)
 */
export interface CardResultProps {
  /** Query result to display */
  result: CardQueryResult

  /** Whether to show low confidence warning (score < 0.70) */
  showLowConfidenceWarning?: boolean
}

/**
 * Props for inline-message component (presentational)
 */
export interface InlineMessageProps {
  /** Message variant */
  variant: 'error' | 'warning' | 'info'

  /** Message text to display */
  message: string

  /** Optional title */
  title?: string
}

/**
 * Props for loading-overlay component (presentational)
 */
export interface LoadingOverlayProps {
  /** Whether overlay is visible */
  isVisible: boolean

  /** Progress message to display */
  message: string
}

/**
 * Return type of useCardQuery hook
 */
export interface UseCardQueryReturn {
  /** Current query state */
  state: CardQueryState

  /** Function to start a new query */
  query: (canvas: HTMLCanvasElement) => Promise<void>

  /** Function to cancel pending query */
  cancel: () => void
}

/**
 * Validation result for canvas data
 */
export interface CanvasValidationResult {
  /** Whether canvas is valid for querying */
  isValid: boolean

  /** Error message if invalid */
  error?: string
}

/**
 * Constants for query thresholds and validation
 */
export const CARD_QUERY_CONSTANTS = {
  /** Similarity score threshold for low confidence warning */
  LOW_CONFIDENCE_THRESHOLD: 0.7,

  /** Expected canvas dimensions */
  CANVAS_WIDTH: 446,
  CANVAS_HEIGHT: 620,

  /** Maximum query timeout (milliseconds) */
  QUERY_TIMEOUT_MS: 10000,
} as const

/**
 * Type guard to check if a value is a valid CardQueryResult
 */
export function isCardQueryResult(value: unknown): value is CardQueryResult {
  if (typeof value !== 'object' || value === null) return false

  const result = value as Partial<CardQueryResult>

  return (
    typeof result.name === 'string' &&
    result.name.length > 0 &&
    typeof result.set === 'string' &&
    result.set.length > 0 &&
    typeof result.score === 'number' &&
    result.score >= 0 &&
    result.score <= 1
  )
}

/**
 * Validates a canvas for querying
 */
export function validateCanvas(
  canvas: HTMLCanvasElement,
): CanvasValidationResult {
  // Check dimensions
  if (
    canvas.width !== CARD_QUERY_CONSTANTS.CANVAS_WIDTH ||
    canvas.height !== CARD_QUERY_CONSTANTS.CANVAS_HEIGHT
  ) {
    return {
      isValid: false,
      error: `Invalid canvas dimensions: expected ${CARD_QUERY_CONSTANTS.CANVAS_WIDTH}x${CARD_QUERY_CONSTANTS.CANVAS_HEIGHT}, got ${canvas.width}x${canvas.height}`,
    }
  }

  // Check context accessibility
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      isValid: false,
      error: 'Could not get 2d context from canvas',
    }
  }

  // Check for non-empty image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const hasData = imageData.data.some((pixel) => pixel !== 0)

  if (!hasData) {
    return {
      isValid: false,
      error: 'Canvas is empty - no valid card detected',
    }
  }

  return { isValid: true }
}

/**
 * Checks if a query result has low confidence
 */
export function isLowConfidence(score: number): boolean {
  return score < CARD_QUERY_CONSTANTS.LOW_CONFIDENCE_THRESHOLD
}

// ============================================================================
// DETR Object Detection Types
// ============================================================================

/**
 * Bounding box in normalized coordinates [0.0, 1.0]
 * Origin: top-left (0, 0)
 */
export interface BoundingBox {
  /** Left edge as percentage of frame width */
  xmin: number
  /** Top edge as percentage of frame height */
  ymin: number
  /** Right edge as percentage of frame width */
  xmax: number
  /** Bottom edge as percentage of frame height */
  ymax: number
}

/**
 * Raw detection result from DETR model
 */
export interface DetectionResult {
  /** Object class label (e.g., "book", "remote", "card") */
  label: string
  /** Confidence score [0.0, 1.0] */
  score: number
  /** Location in normalized coordinates */
  box: BoundingBox
}

/**
 * 2D point in pixel coordinates
 */
export interface Point {
  x: number
  y: number
}

/**
 * Validated card detection ready for user interaction
 */
export interface DetectedCard {
  /** Bounding box in normalized coordinates */
  box: BoundingBox
  /** Confidence score [0.5, 1.0] */
  score: number
  /** Computed aspect ratio (width/height) */
  aspectRatio: number
  /** 4-point polygon for rendering (TL, TR, BR, BL) */
  polygon: Point[]
}

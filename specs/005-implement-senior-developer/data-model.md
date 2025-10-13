# Data Model: MTG Image DB Production Hardening

**Feature**: 005-implement-senior-developer  
**Date**: 2025-10-14

## Overview

This feature hardens existing Python scripts without introducing new data models. The entities below represent runtime state and configuration objects used during the build process. All persistent data formats (FAISS index, JSONL metadata, NPY embeddings) remain unchanged for backward compatibility.

## Entities

### DownloadSession

Represents a configured HTTP session with retry logic and connection pooling.

**Purpose**: Manage HTTP requests with automatic retries, rate limiting, and proper resource cleanup.

**Attributes**:
- `session`: requests.Session instance with retry adapter
- `timeout`: tuple (connect_timeout, read_timeout) = (5, 30)
- `user_agent`: string = "MTG-Image-DB/1.0 (+https://github.com/user/repo; contact@example.com)"
- `max_retries`: int = 5
- `backoff_factor`: float = 1.0 (produces 1s, 2s, 4s, 8s, 16s delays)
- `status_forcelist`: list[int] = [429, 500, 502, 503, 504]

**Lifecycle**:
- Created once at script startup
- Shared across all download workers (thread-safe)
- Closed on script exit

**Relationships**:
- Used by: DownloadWorker (many-to-one)
- Configures: HTTPAdapter with Retry strategy

---

### ImageCacheEntry

Represents a cached image file with validation status.

**Purpose**: Track downloaded images and their validation state to prevent corrupted data from entering the pipeline.

**Attributes**:
- `url`: string - Source URL from Scryfall
- `cache_path`: Path - Local file path (hash-based filename)
- `exists`: bool - Whether file exists on disk
- `size_bytes`: int - File size (0 if missing)
- `is_valid`: bool | None - Validation result (None = not yet validated)
- `validation_error`: string | None - Error message if validation failed

**Validation Rules**:
- File must exist and have size > 0
- Must be loadable by PIL.Image.open()
- Must pass PIL.Image.verify() integrity check
- Must successfully decode (Image.load())

**Lifecycle**:
- Created during metadata gathering phase
- Validated before embedding phase
- Invalid entries excluded from final index

**Relationships**:
- Maps to: CardMetadata (one-to-one via URL)
- Validated by: validate_image() function

---

### EmbeddingVector

Represents a 512-dimensional L2-normalized float32 vector.

**Purpose**: Store CLIP embeddings with guaranteed normalization for correct cosine similarity.

**Attributes**:
- `vector`: np.ndarray shape=(512,) dtype=float32
- `norm`: float - L2 norm (must equal 1.0 within tolerance)
- `source_index`: int - Index in original records list
- `metadata`: CardMetadata - Associated card information

**Validation Rules**:
- Shape must be (512,)
- Dtype must be float32
- L2 norm must be 1.0 ± 1e-5 (normalized)
- No NaN or Inf values

**Lifecycle**:
- Created by CLIP model during embedding phase
- Normalized immediately after creation
- Validated before adding to FAISS index
- Persisted to mtg_embeddings.npy

**Relationships**:
- Produced by: Embedder.encode_images()
- Indexed by: FAISS IndexHNSWFlat with METRIC_INNER_PRODUCT
- Aligned with: CardMetadata via kept indices

---

### FAISSIndexConfig

Represents parameters for HNSW index construction.

**Purpose**: Configure FAISS index build-time and query-time parameters for performance/accuracy trade-offs.

**Attributes**:
- `dimension`: int = 512 (fixed by CLIP model)
- `M`: int = 32 (connectivity parameter, default balanced)
- `efConstruction`: int = 200 (build-time accuracy, default balanced)
- `metric_type`: faiss.MetricType = METRIC_INNER_PRODUCT (for cosine similarity)

**Validation Rules**:
- M must be >= 4 and <= 128
- efConstruction must be >= M and <= 2000
- dimension must equal embedding vector size (512)
- metric_type must be METRIC_INNER_PRODUCT for normalized vectors

**Trade-offs**:
- Higher M: Better recall, larger index, slower build
- Higher efConstruction: Better recall, slower build, no impact on index size
- Query-time efSearch (not stored): Higher = better recall, slower queries

**Lifecycle**:
- Created from CLI arguments at script startup
- Validated before index creation
- Used once to configure FAISS index
- Persisted in build manifest

**Relationships**:
- Configures: faiss.IndexHNSWFlat
- Documented in: BuildManifest

---

### BuildCheckpoint

Represents the state of a partially completed embedding job.

**Purpose**: Enable resumability of long-running jobs by saving progress every 500 images.

**Attributes**:
- `checkpoint_path`: Path - Location of .npz file
- `metadata_path`: Path - Location of JSON metadata
- `processed_count`: int - Number of images processed so far
- `total_count`: int - Total images to process
- `embeddings`: np.ndarray - Partial embedding array
- `indices`: np.ndarray - Indices of successfully embedded images
- `good_mask`: np.ndarray - Boolean mask of valid embeddings
- `timestamp`: float - Unix timestamp of checkpoint creation
- `parameters`: dict - Build parameters (batch_size, target_size, etc.)

**Validation Rules**:
- processed_count must be <= total_count
- embeddings.shape[0] must equal processed_count
- indices.shape[0] must equal number of True values in good_mask
- parameters must match current run (or warn user)

**Lifecycle**:
- Created every 500 images during embedding phase
- Loaded at script startup if exists
- Deleted on successful completion
- Preserved on error for manual inspection

**Relationships**:
- Contains: Partial EmbeddingVector array
- Resumes: Embedding job from last checkpoint

---

### BuildManifest

Represents provenance information for an index build.

**Purpose**: Track build parameters, statistics, and environment for reproducibility and debugging.

**Attributes**:
- `version`: string = "1.0.0" (semantic versioning)
- `timestamp`: string (ISO 8601 format)
- `parameters`: dict
  - `kind`: string (unique_artwork | default_cards | all_cards)
  - `batch_size`: int
  - `target_size`: int
  - `hnsw_m`: int
  - `hnsw_ef_construction`: int
- `statistics`: dict
  - `total_records`: int
  - `successful_embeddings`: int
  - `failed_embeddings`: int
  - `success_rate`: float (0.0 to 1.0)
  - `missing_from_cache`: int
  - `validation_failures`: int
- `environment`: dict
  - `python_version`: string
  - `numpy_version`: string
  - `torch_version`: string
  - `faiss_version`: string
  - `clip_model`: string = "ViT-B/32"
- `git_commit`: string | None (optional, if available)

**Validation Rules**:
- version must follow semver format
- success_rate must be between 0.0 and 1.0
- All counts must be non-negative integers
- timestamp must be valid ISO 8601

**Lifecycle**:
- Created at end of successful index build
- Written to index_out/build_manifest.json
- Never modified after creation
- Used for debugging and provenance tracking

**Relationships**:
- Documents: FAISSIndexConfig parameters
- References: Output artifacts (FAISS index, embeddings, metadata)

---

### CardMetadata

**Note**: This entity already exists in the current implementation. No changes required, included for completeness.

**Purpose**: Store Scryfall card information for search results.

**Attributes**:
- `name`: string
- `scryfall_id`: string
- `face_id`: string
- `set`: string
- `collector_number`: string
- `frame`: string
- `layout`: string
- `lang`: string
- `colors`: list[string]
- `image_url`: string (used for embedding)
- `card_url`: string (used for display)
- `scryfall_uri`: string

**Persistence**: Written to mtg_meta.jsonl (one JSON object per line)

**Relationships**:
- Aligned with: EmbeddingVector via kept indices
- Returned in: Query results

## Data Flow

```
1. Download Phase:
   Scryfall API → DownloadSession → ImageCacheEntry (validated)

2. Embedding Phase:
   ImageCacheEntry → PIL.Image → Embedder → EmbeddingVector (normalized)
   
3. Indexing Phase:
   EmbeddingVector[] → FAISSIndexConfig → faiss.IndexHNSWFlat
   
4. Persistence Phase:
   EmbeddingVector[] → mtg_embeddings.npy
   CardMetadata[] → mtg_meta.jsonl
   FAISS Index → mtg_cards.faiss
   BuildManifest → build_manifest.json

5. Checkpoint Phase (every 500 images):
   Partial state → BuildCheckpoint → checkpoint.npz + checkpoint_meta.json
```

## Validation Strategy

### Pre-Embedding Validation
- ImageCacheEntry: File exists, size > 0, PIL can load
- Reject corrupted files before they enter embedding pipeline

### Post-Embedding Validation
- EmbeddingVector: L2 norm = 1.0 ± 1e-5
- No NaN or Inf values
- Correct shape (512,)

### Pre-Indexing Validation
- At least 1 valid embedding (abort if zero)
- FAISSIndexConfig parameters within valid ranges
- Embedding array shape matches expected dimensions

### Post-Build Validation
- FAISS index size matches embedding count
- Metadata count matches embedding count
- Self-query test: identical image returns score ≥0.99

## Error Handling

### Download Errors
- Network timeout: Retry with exponential backoff (max 5 attempts)
- HTTP 429: Respect Retry-After header, use exponential backoff
- HTTP 404: Log and skip (genuine missing image)
- HTTP 5xx: Retry with exponential backoff

### Validation Errors
- Corrupted image: Log warning, exclude from index, continue
- Zero valid images: Abort with clear error message
- Partial checkpoint: Warn if parameters mismatch, allow override

### Edge Cases
- Division by zero: Guard all percentage calculations
- Empty arrays: Check before FAISS operations
- Invalid CLI args: Validate at startup, fail fast

## Backward Compatibility

**No breaking changes to persistent formats:**
- FAISS index format unchanged
- JSONL metadata format unchanged
- NPY embedding format unchanged
- New build_manifest.json is additive (optional)
- Checkpoints are optional (don't block normal operation)

**Consumers (browser app) unaffected:**
- export_for_browser.py reads same formats
- int8 quantization process unchanged
- meta.json structure unchanged

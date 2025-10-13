# Feature Specification: MTG Image DB Production Hardening

**Feature Branch**: `005-implement-senior-developer`  
**Created**: 2025-10-14  
**Status**: Draft  
**Input**: User description: "Implement senior developer feedback for mtg-image-db: networking robustness, data validation, edge case handling, performance improvements, and correctness fixes"

## Clarifications

### Session 2025-10-14

- Q: What retry strategy should be used for rate limiting (429) and server errors (5xx)? → A: Max 5 retries with exponential backoff (1s, 2s, 4s, 8s, 16s) capped at 60s
- Q: How frequently should checkpoints be saved during long-running embedding jobs? → A: Every 500 images
- Q: What format should the User-Agent header use? → A: Detailed format including tool name, version, repository link, and contact: "MTG-Image-DB/1.0 (+https://github.com/user/repo; contact@example.com)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable Large-Scale Image Downloads (Priority: P1)

A developer runs the image download script to cache 20,000+ MTG card images from Scryfall. The process completes successfully despite network hiccups, rate limiting, and temporary server errors, with all images properly cached and validated.

**Why this priority**: This is the foundation of the entire pipeline. Without reliable downloads, the embedding and indexing steps cannot produce trustworthy results. Network failures are common at scale and must be handled gracefully.

**Independent Test**: Can be fully tested by running `download_images.py` with a large dataset (e.g., `--kind unique_artwork`) and verifying that (1) the script completes without hanging, (2) all cached files are valid images, (3) interrupted downloads can be resumed, and (4) rate limiting is respected.

**Acceptance Scenarios**:

1. **Given** Scryfall API returns a 429 rate limit error, **When** the download script encounters this response, **Then** it automatically retries with exponential backoff and completes successfully
2. **Given** a network timeout occurs during image download, **When** the timeout is detected, **Then** the script retries the download up to 3 times before marking it as failed
3. **Given** a download is interrupted mid-file, **When** the script resumes, **Then** it does not treat the partial file as valid and re-downloads it completely
4. **Given** 10,000 images need downloading, **When** using parallel downloads with 16 workers, **Then** all images complete in reasonable time without overwhelming Scryfall's servers

---

### User Story 2 - Data Integrity Validation (Priority: P1)

A developer builds embeddings from cached images. The system validates each cached file before processing, rejecting corrupted images, HTML error pages, or truncated files, ensuring only valid image data enters the embedding pipeline.

**Why this priority**: Invalid cached data silently corrupts the entire index. A single HTML error page embedded as an "image" produces meaningless search results. Validation prevents garbage-in-garbage-out scenarios.

**Independent Test**: Can be fully tested by (1) placing corrupted files in the cache directory, (2) running `build_embeddings.py`, and (3) verifying that corrupted files are detected, logged, and excluded from the final index.

**Acceptance Scenarios**:

1. **Given** a cached file contains an HTML error page instead of an image, **When** the embedding script processes it, **Then** it detects the invalid format, logs a warning, and excludes it from the index
2. **Given** a cached file is truncated (incomplete download), **When** validation runs, **Then** it fails to load as a valid image and is marked for re-download
3. **Given** 100 cached images with 5 corrupted files, **When** building embeddings, **Then** the final index contains exactly 95 valid entries with clear reporting of the 5 failures

---

### User Story 3 - Graceful Edge Case Handling (Priority: P1)

A developer runs the pipeline with unusual inputs: zero available images, all downloads fail, or an empty dataset. The system detects these conditions early, provides clear error messages, and exits gracefully without crashing or creating invalid indexes.

**Why this priority**: Edge cases cause production failures. A crash on empty input or a silent creation of an invalid index wastes developer time and creates debugging nightmares. Defensive programming is essential.

**Independent Test**: Can be fully tested by running the scripts with (1) an empty cache directory, (2) all image URLs returning 404s, (3) `--limit 0`, and verifying that each scenario produces a clear error message and clean exit.

**Acceptance Scenarios**:

1. **Given** all images fail to download or are missing from cache, **When** building embeddings, **Then** the script detects zero valid images and exits with error message "No valid images to embed" before attempting FAISS index creation
2. **Given** the embedding process results in zero vectors, **When** attempting to create a FAISS index, **Then** the script aborts with a clear message rather than creating an empty or invalid index
3. **Given** percentage calculations with zero records, **When** generating summary statistics, **Then** the script handles division by zero gracefully and reports "N/A" or "0/0" instead of crashing

---

### User Story 4 - High-Performance Parallel Processing (Priority: P2)

A developer downloads 20,000 images using parallel workers. The process completes 10-20x faster than sequential downloads while respecting rate limits and maintaining data integrity through proper synchronization.

**Why this priority**: Sequential downloads of large datasets take hours. Parallel processing is essential for developer productivity and practical use at scale. However, it must be implemented correctly to avoid race conditions.

**Independent Test**: Can be fully tested by comparing download times between sequential (1 worker) and parallel (16 workers) modes on a 1,000-image subset, verifying both complete successfully with identical results.

**Acceptance Scenarios**:

1. **Given** 5,000 images to download with 16 parallel workers, **When** the download completes, **Then** the total time is at least 10x faster than single-threaded mode
2. **Given** parallel downloads are active, **When** multiple workers access the shared session, **Then** no race conditions occur and all files are written atomically
3. **Given** parallel workers encounter rate limits, **When** retries occur, **Then** the retry logic coordinates across workers to avoid thundering herd problems

---

### User Story 5 - Configurable Index Quality vs Performance (Priority: P2)

A developer tunes FAISS index parameters (M, efConstruction, efSearch) based on their use case: high recall for production or fast builds for development. The system exposes these as CLI flags with sensible defaults and clear documentation.

**Why this priority**: Different use cases require different trade-offs. Development iterations need fast builds; production needs high accuracy. Hard-coded parameters force one-size-fits-all compromises.

**Independent Test**: Can be fully tested by building indexes with different parameter sets (e.g., M=16 vs M=64) and measuring build time, index size, and query recall on a test set.

**Acceptance Scenarios**:

1. **Given** a developer runs `build_embeddings.py --hnsw-m 32 --hnsw-ef-construction 200`, **When** the index builds, **Then** it completes faster than default settings with slightly lower recall
2. **Given** default parameters are used, **When** building an index, **Then** the system uses M=32 and efConstruction=200 (balanced defaults)
3. **Given** a developer queries the index, **When** they need higher accuracy, **Then** they can set efSearch at query time without rebuilding the index

---

### User Story 6 - Correct Distance Metric Implementation (Priority: P1)

A developer builds an index and performs similarity searches. The system correctly implements cosine similarity by L2-normalizing vectors and using the appropriate FAISS metric, ensuring search results accurately reflect visual similarity.

**Why this priority**: Incorrect distance metrics produce wrong search results. If vectors aren't normalized or the wrong FAISS metric is used, the entire search engine returns meaningless results. This is a correctness issue, not just performance.

**Independent Test**: Can be fully tested by (1) verifying embeddings are L2-normalized (||v|| = 1), (2) confirming FAISS uses inner product metric after normalization, and (3) validating that identical images return distance ~1.0 and dissimilar images return distance ~0.0.

**Acceptance Scenarios**:

1. **Given** the embedder produces vectors, **When** checking their norms, **Then** all vectors have L2 norm equal to 1.0 (within floating-point tolerance)
2. **Given** L2-normalized vectors, **When** building the FAISS index, **Then** the index uses METRIC_INNER_PRODUCT to correctly compute cosine similarity
3. **Given** a query for an image against itself, **When** searching the index, **Then** the top result has distance 1.0 (perfect similarity)

---

### User Story 7 - Progress Tracking and Resumability (Priority: P3)

A developer runs a multi-hour embedding job. The system periodically saves progress checkpoints, displays detailed progress information, and allows resuming from the last checkpoint if interrupted, avoiding wasted computation.

**Why this priority**: Long-running jobs are vulnerable to interruptions. Without checkpoints, a crash at 90% completion means starting over. This is a quality-of-life improvement that saves significant time.

**Independent Test**: Can be fully tested by (1) starting an embedding job, (2) interrupting it at 50% completion, (3) restarting with the same parameters, and (4) verifying it resumes from the checkpoint rather than starting over.

**Acceptance Scenarios**:

1. **Given** an embedding job is running, **When** 500 images are processed, **Then** the system writes a checkpoint file with completed indices
2. **Given** a previous run was interrupted, **When** restarting with the same output directory, **Then** the system detects the checkpoint and skips already-processed images
3. **Given** a long-running job, **When** monitoring progress, **Then** the system displays estimated time remaining and current throughput (images/second)

---

### Edge Cases

- What happens when all image URLs return 404 errors? System should detect zero successful downloads and exit with clear error before attempting to build embeddings.
- What happens when the cache directory contains only corrupted files? Validation should reject all files and exit with error message listing validation failures.
- What happens when `--limit 0` is specified? System should validate CLI arguments and reject invalid limits with helpful error message.
- What happens when FAISS index creation receives zero vectors? System should detect empty vector array and abort with clear message before calling FAISS.
- What happens when percentage calculations have zero denominator? System should guard all division operations and display "N/A" or handle gracefully.
- What happens when Scryfall changes URL structure? Filename hashing should prevent collisions; system should detect and handle URL changes gracefully.
- What happens when disk space runs out during download? Atomic writes should prevent partial files; system should detect write failures and report clearly.
- What happens when multiple processes write to the same cache directory? File locking or atomic operations should prevent corruption.
- What happens when the embedding model fails to load? System should fail fast with clear error message about missing dependencies or model files.
- What happens when a single image takes extremely long to download? Timeout settings should prevent indefinite hangs; system should log slow downloads and continue.

## Requirements *(mandatory)*

### Functional Requirements

#### Networking & Robustness

- **FR-001**: Download system MUST implement request timeouts with connect timeout of 5 seconds and read timeout of 30 seconds to prevent indefinite hangs
- **FR-002**: Download system MUST implement automatic retry logic with exponential backoff for HTTP 429 (rate limit) and 5xx (server error) responses, with maximum 5 retries using delays of 1s, 2s, 4s, 8s, 16s (capped at 60s)
- **FR-003**: Download system MUST include a polite User-Agent header in the format "MTG-Image-DB/1.0 (+https://github.com/FrimJo/spell-coven-mono; ifrim@me.com)" identifying the tool, repository, and contact information to comply with API etiquette
- **FR-004**: Download system MUST use a shared session with connection pooling to improve performance and respect server resources
- **FR-005**: Download system MUST write files atomically using temporary files with rename-on-success to prevent partial file corruption

#### Data Validation & Integrity

- **FR-006**: System MUST validate each cached image file by attempting to load it with an image library before using it for embeddings
- **FR-007**: System MUST reject and log any cached files that are not valid images (e.g., HTML error pages, truncated files, corrupted data)
- **FR-008**: Cache filename generation MUST include a stable hash of the source URL to prevent collisions when URL paths change
- **FR-009**: System MUST persist the mapping between kept indices and metadata for auditability and validation
- **FR-010**: System MUST verify that all vectors are L2-normalized (unit norm) before indexing

#### Edge Case Handling

- **FR-011**: System MUST detect when zero valid images are available and exit with a clear error message before attempting to create a FAISS index
- **FR-012**: System MUST guard all percentage calculations against division by zero and display appropriate messages (e.g., "N/A" or "0/0")
- **FR-013**: System MUST validate CLI arguments at startup and reject invalid values (e.g., negative limits, batch size < 1, image size < 64) with helpful error messages
- **FR-014**: System MUST detect and report when the embedding vector array is empty (shape 0×512) before calling FAISS index creation

#### Performance & Scalability

- **FR-015**: Download system MUST support parallel downloads using a configurable thread pool (default 10-32 workers) to improve throughput
- **FR-016**: Download system MUST coordinate retry logic across parallel workers to avoid thundering herd problems during rate limiting
- **FR-017**: Embedding system MUST support memory-mapped output for large datasets to avoid RAM spikes and improve resilience
- **FR-018**: Embedding system MUST support periodic checkpoints every 500 images to enable resumability of long-running jobs with minimal rework on interruption
- **FR-019**: System MUST expose FAISS HNSW parameters (M, efConstruction) as CLI flags with sensible defaults (M=32, efConstruction=200)

#### Correctness

- **FR-020**: System MUST explicitly L2-normalize all embedding vectors before indexing if the embedder does not guarantee normalization
- **FR-021**: System MUST use FAISS METRIC_INNER_PRODUCT for L2-normalized vectors to correctly implement cosine similarity
- **FR-022**: System MUST verify that identical images return similarity scores near 1.0 and dissimilar images return scores near 0.0
- **FR-023**: System MUST remove unused imports from all scripts to maintain code cleanliness and avoid confusion

#### Observability & Reporting

- **FR-024**: System MUST display detailed progress information including current throughput (images/second) and estimated time remaining
- **FR-025**: System MUST log all validation failures with specific details (filename, reason for rejection)
- **FR-026**: System MUST generate a build manifest file containing timestamps, counts, parameters, and provenance information for each index build
- **FR-027**: System MUST report download and embedding statistics including success rates, failure counts, and performance metrics

#### Documentation

- **FR-028**: README MUST document parallel download configuration and worker count tuning recommendations
- **FR-029**: README MUST document retry behavior and rate limiting courtesy to Scryfall
- **FR-030**: README MUST document HNSW parameter tuning guidelines including trade-offs between build time, index size, and recall
- **FR-031**: README MUST document query-time efSearch parameter and how to tune it without rebuilding the index

### Key Entities

- **Download Session**: Represents a configured HTTP session with retry logic, timeouts, connection pooling, and User-Agent. Shared across parallel workers for efficiency and rate limit coordination.

- **Image Cache Entry**: Represents a cached image file with validation status. Contains source URL, local file path, hash-based filename, validation result, and file size. Tracks whether the file is a valid image or corrupted.

- **Embedding Vector**: Represents a 512-dimensional L2-normalized float32 vector produced by CLIP. Associated with metadata (card name, Scryfall ID, face ID, etc.) and kept index for alignment with FAISS index.

- **FAISS Index Configuration**: Represents the parameters for HNSW index construction including dimension (512), M (connectivity), efConstruction (build-time accuracy), and metric type (inner product for cosine similarity).

- **Build Checkpoint**: Represents the state of a partially completed embedding job. Contains processed indices, output file paths, and parameters to enable resumption after interruption.

- **Build Manifest**: Represents provenance information for an index build including timestamps, record counts, parameters (kind, batch size, HNSW settings), success/failure statistics, and optional commit hash.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Download script completes successfully on datasets of 20,000+ images with less than 1% failure rate due to network issues (excluding genuine 404s)

- **SC-002**: Parallel downloads (16 workers) complete at least 10x faster than sequential downloads on datasets of 1,000+ images

- **SC-003**: System detects and rejects 100% of corrupted cache files (HTML error pages, truncated files) before they enter the embedding pipeline

- **SC-004**: Zero crashes occur when running scripts with edge case inputs (empty cache, zero images, invalid parameters)

- **SC-005**: All percentage calculations and summary statistics display correctly without division-by-zero errors across all possible input scenarios

- **SC-006**: Embedding vectors have L2 norm within 0.001 of 1.0, and cosine similarity searches return correct results (identical images score ≥0.99)

- **SC-007**: Interrupted embedding jobs can resume from checkpoints, saving at least 80% of already-completed work

- **SC-008**: Build time for 20,000 images reduces by at least 50% compared to current implementation when using parallel downloads and optimized settings

- **SC-009**: Index builds with different HNSW parameters (M=16 vs M=64) show measurable trade-offs in build time and query recall as documented

- **SC-010**: Documentation includes clear guidance on all new features (parallel downloads, parameter tuning, retry behavior) that enables developers to use them without reading source code

- **SC-011**: All scripts complete without unused import warnings when run with linting tools

- **SC-012**: Build manifest files are generated for every index build and contain all required provenance information (timestamps, parameters, statistics)

# Feature Specification: CLIP Model Alignment & Pipeline Optimization

**Feature Branch**: `012-fix-clip-model-alignment`
**Created**: 2025-10-17
**Status**: Draft
**Input**: User description: "Fix critical CLIP model dimension mismatch between browser (512-dim ViT-B/32) and database (768-dim ViT-L/14@336px), align preprocessing with Python pipeline (black padding instead of center-crop), and optimize SlimSAM→CLIP pipeline by eliminating redundant resize operations"

## Clarifications

### Session 2025-10-17

- Q: Should we maintain backward compatibility with existing 512-dim indexes? → A: No, this is a breaking change. Old indexes must be regenerated with the new model.
- Q: Should we implement manual preprocessing or trust Transformers.js automatic preprocessing? → A: Start with Transformers.js automatic preprocessing, but add verification tests to ensure it matches Python pipeline. If tests fail, implement manual preprocessing.
- Q: Should CLIP model loading be lazy (on first use) or eager (on page load)? → A: Implement lazy loading to improve perceived performance, with clear loading state in UI.
- Q: What should be the target canvas size for CLIP input? → A: 336×336 to match ViT-L/14@336px native input size.
- Q: What should happen when the CLIP model fails to load after multiple retry attempts? → A: Block all card identification permanently until page refresh, show persistent error banner
- Q: How should the system validate that browser and Python preprocessing produce equivalent results? → A: Visual inspection by developers during testing (manual verification only)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct Card Identification (Priority: P1)

A user clicks on a card in their webcam stream. The system segments the card using SlimSAM, embeds it using the correct CLIP model (ViT-L/14@336px, 768-dim), and returns accurate search results that match the Python pipeline's behavior.

**Why this priority**: This is a critical bug fix. The current dimension mismatch (512 vs 768) causes immediate runtime failures. Without this fix, the card identification feature is completely broken.

**Independent Test**: Can be fully tested by (1) clicking a card in the video stream, (2) verifying the embedding is 768-dimensional, (3) confirming the search completes without errors, and (4) comparing results with Python pipeline on the same card image (should return identical top-1 match).

**Acceptance Scenarios**:

1. **Given** a user clicks on a card in the video stream, **When** SlimSAM segments the card and CLIP embeds it, **Then** the embedding vector has exactly 768 dimensions (not 512)
2. **Given** a 768-dim embedding is generated, **When** querying the database, **Then** the similarity search completes successfully without dimension mismatch errors
3. **Given** the same card image is processed in both Python and browser, **When** comparing the embeddings, **Then** the cosine similarity between them is ≥0.95 (indicating consistent preprocessing)
4. **Given** a user clicks on a known card, **When** the search completes, **Then** the top-1 result matches the expected card with high confidence (score ≥0.85)

---

### User Story 2 - Consistent Preprocessing Pipeline (Priority: P1)

The browser's CLIP preprocessing matches the Python pipeline exactly: using black padding (not center-crop) to preserve full card information, and resizing to 336×336 (not 384×384). This ensures embeddings are compatible and search results are consistent.

**Why this priority**: Preprocessing mismatch causes lower accuracy even if dimensions match. Center-crop loses card edges (important for identification), while black padding preserves all information. This directly impacts search quality.

**Independent Test**: Can be fully tested by (1) preprocessing the same card image in Python and browser, (2) visually inspecting the preprocessed images side-by-side, (3) verifying both use black padding and 336×336 size, and (4) confirming embedding similarity ≥0.95 as secondary validation.

**Acceptance Scenarios**:

1. **Given** a card image with aspect ratio 63:88 (portrait), **When** preprocessing for CLIP, **Then** the output is 336×336 with black padding on sides (not center-cropped)
2. **Given** SlimSAM outputs a 384×384 warped canvas, **When** preprocessing for CLIP, **Then** it is resized to 336×336 with aspect ratio preserved via black padding
3. **Given** the same card is processed in Python and browser, **When** developers visually inspect preprocessed images side-by-side, **Then** they appear identical (same padding, same size, same content)
4. **Given** preprocessing uses black padding, **When** embedding the card, **Then** all card information (including edges) is preserved in the embedding

---

### User Story 3 - Optimized Pipeline Without Redundant Operations (Priority: P2)

The system eliminates the unnecessary 446×620 resize step between SlimSAM and CLIP. The warped canvas from SlimSAM (384×384) goes directly to CLIP preprocessing (336×336), reducing latency and memory usage.

**Why this priority**: The current pipeline wastes CPU cycles and memory on a resize that is immediately undone. While not breaking functionality, this optimization improves performance and code clarity.

**Independent Test**: Can be fully tested by (1) measuring end-to-end latency from click to result before and after optimization, (2) verifying the 446×620 canvas is no longer created, and (3) confirming search results remain identical.

**Acceptance Scenarios**:

1. **Given** SlimSAM produces a 384×384 warped canvas, **When** preparing for CLIP embedding, **Then** it is preprocessed directly to 336×336 without intermediate 446×620 resize
2. **Given** the optimized pipeline is active, **When** measuring canvas operations, **Then** there is exactly one resize operation (384×384 → 336×336) instead of two
3. **Given** the optimized pipeline, **When** comparing end-to-end latency, **Then** it is at least 5-10ms faster than the original pipeline
4. **Given** the optimized pipeline, **When** comparing search results, **Then** they are identical to the original pipeline (no accuracy loss)

---

### User Story 4 - Lazy CLIP Model Loading (Priority: P3)

The CLIP model loads on first card click (not on page load), improving perceived performance. Users see the game room UI immediately, and the model downloads only when needed.

**Why this priority**: The CLIP model is large (~500MB). Loading it on page load delays the initial UI, even if the user never clicks a card. Lazy loading improves user experience without sacrificing functionality.

**Independent Test**: Can be fully tested by (1) loading the game room page, (2) verifying the CLIP model is not downloaded, (3) clicking a card, (4) verifying the model downloads and the search completes, and (5) confirming subsequent clicks use the cached model.

**Acceptance Scenarios**:

1. **Given** a user loads the game room page, **When** the page renders, **Then** the CLIP model is not downloaded (network tab shows no model requests)
2. **Given** a user clicks their first card, **When** the click is processed, **Then** the CLIP model begins downloading with visible loading indicator
3. **Given** the CLIP model is loading, **When** the user clicks another card, **Then** the second click waits for the model to finish loading (no duplicate downloads)
4. **Given** the CLIP model is loaded, **When** the user clicks subsequent cards, **Then** they are processed immediately without re-downloading the model

---

### User Story 5 - Clear Error Messages and Validation (Priority: P2)

When dimension mismatches or preprocessing errors occur, the system provides clear, actionable error messages that help developers debug issues. Validation checks catch problems early in the pipeline.

**Why this priority**: Cryptic errors waste developer time. Clear error messages with context (expected vs actual dimensions, preprocessing steps, etc.) enable rapid debugging and prevent silent failures.

**Independent Test**: Can be fully tested by (1) intentionally using mismatched database dimensions, (2) verifying the error message clearly states the mismatch, (3) testing with corrupted embeddings, and (4) confirming validation catches the issue before search.

**Acceptance Scenarios**:

1. **Given** the database has 768-dim embeddings but the query is 512-dim, **When** attempting similarity search, **Then** the error message states "Query dimension mismatch: expected 768, got 512. Ensure browser uses ViT-L/14@336px model."
2. **Given** an embedding vector is not L2-normalized, **When** validation runs, **Then** the error message states "Embedding not properly normalized: L2 norm = X.XXXX, expected ~1.0 ±0.008"
3. **Given** CLIP preprocessing fails, **When** the error occurs, **Then** the error message includes the canvas dimensions and preprocessing step that failed
4. **Given** SlimSAM segmentation fails, **When** attempting to crop the card, **Then** the error message clearly states "No valid card detected at click position" (not a generic error)

---

### Edge Cases

- What happens when the database is still using 512-dim embeddings (old format)? System should detect dimension mismatch and display clear error: "Database uses old 512-dim format. Please regenerate with ViT-L/14@336px model."
- What happens when SlimSAM produces a non-square warped canvas? Preprocessing should handle arbitrary aspect ratios with black padding.
- What happens when the CLIP model fails to download (network error)? System should display clear error with retry option. After 3 failed retry attempts, block all card identification and show persistent error banner requiring page refresh.
- What happens when preprocessing produces a canvas with wrong dimensions? Validation should catch this before embedding and throw clear error.
- What happens when the user clicks rapidly before the model loads? System should queue requests and process them sequentially after model loads (no duplicate downloads).
- What happens when the embedding vector has NaN or Infinity values? Validation should detect invalid values and reject the embedding with clear error.
- What happens when the database is empty (zero cards)? System should detect this at initialization and display helpful message (not crash on first query).
- What happens when the warped canvas from SlimSAM is corrupted or empty? Validation should detect invalid canvas before preprocessing.

## Requirements *(mandatory)*

### Functional Requirements

#### Model Alignment

- **FR-001**: Browser MUST use the same card recognition model as the Python pipeline (the larger, more accurate model)
- **FR-002**: System MUST validate that browser-generated embeddings are compatible with the database format
- **FR-003**: System MUST verify embedding quality before performing searches
- **FR-004**: System MUST detect incompatible database formats and provide clear error messages explaining the mismatch

#### Image Preprocessing Alignment

- **FR-005**: Card image preprocessing MUST preserve all card information without cropping edges (use padding instead)
- **FR-006**: Card images MUST be resized to match the model's expected input format
- **FR-007**: Preprocessing MUST maintain card aspect ratio by adding padding to shorter edges
- **FR-008**: System MUST validate preprocessed images meet quality standards before analysis

#### Pipeline Optimization

- **FR-009**: System MUST eliminate unnecessary image resizing operations between card detection and recognition
- **FR-010**: Detected card images MUST flow directly to the recognition model without intermediate transformations
- **FR-011**: System MUST NOT create temporary display-sized images when they are not needed for the search workflow
- **FR-012**: Optimized pipeline MUST produce identical search results to the original pipeline (no accuracy loss)

#### On-Demand Model Loading

- **FR-013**: Recognition model MUST NOT load during initial page load (only metadata loads immediately)
- **FR-014**: Recognition model MUST load on first card identification attempt with visible progress indicator
- **FR-015**: System MUST prevent duplicate model downloads when users trigger multiple identification requests
- **FR-016**: System MUST cache the loaded model for subsequent card identifications (no repeated downloads)

#### Validation & Error Handling

- **FR-017**: System MUST validate that query format matches database format before performing searches
- **FR-018**: System MUST validate embedding quality and reject invalid data with clear error messages
- **FR-019**: System MUST validate preprocessed images meet quality requirements before analysis
- **FR-020**: All format mismatch errors MUST clearly explain what went wrong and what format was expected
- **FR-021**: System MUST detect corrupted or invalid images before processing and provide clear error messages
- **FR-022**: System MUST handle model download failures gracefully with up to 3 retry attempts, then block card identification with persistent error banner requiring page refresh

#### System Consistency

- **FR-023**: Browser implementation MUST match the Python pipeline's preprocessing approach
- **FR-024**: Technical documentation MUST accurately reflect the current system architecture and data formats
- **FR-025**: System MUST document breaking changes and provide clear migration instructions for existing deployments
- **FR-026**: System MUST include version compatibility checks to detect and report format mismatches

### Key Entities

- **Recognition Model Configuration**: Represents the card recognition model settings including which model variant to use, expected data formats, image input requirements, and preprocessing approach. Ensures browser and Python pipelines use consistent settings.

- **Preprocessed Card Image**: Represents a standardized card image ready for recognition. Contains the card image at the correct size with aspect ratio preserved through padding. Validated before processing.

- **Card Embedding**: Represents a mathematical fingerprint of a card image used for similarity comparison. Must meet quality standards before being used in searches. Enables finding matching cards in the database.

- **Processing Pipeline Stage**: Represents a step in the card identification workflow (detection → correction → preprocessing → recognition → search). Each stage includes validation and error handling.

- **Model Loading State**: Represents whether the recognition model is ready for use (not loaded, currently loading, ready, or error). Used to coordinate on-demand loading and prevent duplicate downloads.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All card identification queries complete successfully without format compatibility errors (zero dimension mismatch errors)

- **SC-002**: Browser-generated card embeddings produce identical search results to Python-generated embeddings when querying the same card (verified by matching top-1 results)

- **SC-003**: Card identification accuracy improves by at least 10% compared to the previous system (measured by correct top-1 matches on a test set of 100 known cards)

- **SC-004**: Time from user click to search result completes at least 5% faster than the current system

- **SC-005**: Initial page load time improves by at least 2 seconds compared to the current system

- **SC-006**: Zero system crashes or unhandled errors occur during normal card identification workflows

- **SC-007**: All error messages clearly explain the problem and suggest actionable next steps (verified by user testing)

- **SC-008**: Card images are preprocessed consistently between browser and Python pipelines (verified by developer visual inspection and identical search results)

- **SC-009**: Technical documentation accurately reflects the current system behavior and requirements

- **SC-010**: Migration documentation enables developers to upgrade existing deployments without data loss

- **SC-011**: Manual testing and visual inspection confirm browser and Python pipelines produce equivalent results

- **SC-012**: Users see clear loading feedback when the system is preparing for first-time card identification

## Assumptions

- The Python pipeline is the source of truth for preprocessing and model configuration
- Database regeneration is acceptable as a one-time migration cost
- Users have sufficient bandwidth to download larger ML models on demand
- The system can tolerate a brief loading delay on first card identification
- Existing 512-dimensional embeddings are considered deprecated and will be replaced

## Out of Scope

- Backward compatibility with old 512-dimensional embedding databases
- Real-time model switching between different CLIP variants
- Automatic database migration or conversion tools
- Performance optimizations beyond eliminating redundant operations
- Advanced search algorithms (e.g., approximate nearest neighbor)
- Multi-card batch processing or parallel queries

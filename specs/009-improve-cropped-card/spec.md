# Feature Specification: Improve Cropped Card Query Accuracy

**Feature Branch**: `009-improve-cropped-card`  
**Created**: 2025-10-16  
**Status**: Draft  
**Input**: User description: "Improve cropped card image query accuracy by fixing preprocessing pipeline mismatch between Python embeddings and browser queries"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accurate Card Identification from Webcam (Priority: P1)

A player is streaming their MTG game via webcam. They click on a card visible in the video stream to identify it. The system correctly identifies the card and displays its details, even when the card is at an angle, partially obscured, or in varying lighting conditions.

**Why this priority**: This is the core value proposition of the entire application. Without accurate card identification, the tool provides no value to users. Current accuracy issues make the tool unreliable and frustrating.

**Independent Test**: Can be fully tested by capturing a webcam image of a known MTG card, clicking on it, and verifying the top result matches the actual card. Success rate should be measurable and significantly improved.

**Acceptance Scenarios**:

1. **Given** a webcam stream showing a clear, front-facing MTG card, **When** the user clicks on the card, **Then** the correct card appears as the top result with high confidence score (>0.85)
2. **Given** a webcam stream showing a card at a 30-degree angle, **When** the user clicks on the card, **Then** the correct card appears in the top 3 results
3. **Given** a webcam stream showing a card with slight glare or shadow, **When** the user clicks on the card, **Then** the correct card appears in the top 5 results
4. **Given** the same card photographed and uploaded from the database source, **When** queried, **Then** it returns itself as the top match with near-perfect similarity score (>0.95)

---

### User Story 2 - Consistent Results Across Query Methods (Priority: P2)

A user queries the same card using different methods (webcam crop, file upload, direct image) and receives consistent identification results regardless of the input method used.

**Why this priority**: Consistency builds user trust. If the same card produces different results depending on how it's queried, users will lose confidence in the system.

**Independent Test**: Can be tested by querying the same card image through multiple input methods and comparing the top results. All methods should return the same top match.

**Acceptance Scenarios**:

1. **Given** a card image from the database, **When** queried via webcam crop and file upload, **Then** both methods return the same top result
2. **Given** a physical card captured via webcam, **When** the same card is photographed and uploaded, **Then** both queries return the same card in top 3 results
3. **Given** multiple crops of the same card from different angles, **When** all are queried, **Then** all return the same card as the top result

---

### User Story 3 - Helpful Feedback on Query Quality (Priority: P3)

When a user submits a low-quality crop or image that may produce poor results, the system provides helpful feedback about image quality issues and suggestions for improvement.

**Why this priority**: While not critical for core functionality, this improves user experience by helping users understand why results may be inaccurate and how to improve them.

**Independent Test**: Can be tested by submitting intentionally poor-quality images (blurry, too small, wrong aspect ratio) and verifying appropriate warnings are displayed.

**Acceptance Scenarios**:

1. **Given** a very small or low-resolution crop, **When** the user attempts to search, **Then** a warning indicates the image quality may affect results
2. **Given** a crop with incorrect aspect ratio (not square), **When** processed, **Then** a warning indicates preprocessing may reduce accuracy
3. **Given** a successful query with good image quality, **When** results are displayed, **Then** no warnings are shown

---

### Edge Cases

- What happens when a card is heavily foiled or has significant glare that obscures the image?
- How does the system handle double-faced cards or split cards where only one face is visible?
- What happens when multiple cards are detected but the user clicks between them?
- How does the system perform with foreign-language cards that have the same artwork?
- What happens when a card from a very recent set is not yet in the database?
- How does the system handle proxy cards or altered art cards that don't match the database exactly?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST preprocess webcam-cropped card images identically to how database card images were preprocessed during embedding generation
- **FR-002**: System MUST crop card images to square dimensions (using center-crop of the minimum dimension) before resizing for embedding
- **FR-003**: System MUST resize cropped card images to the same target dimensions used during database embedding generation (384×384 pixels)
- **FR-004**: System MUST validate that query images are preprocessed correctly before generating embeddings
- **FR-005**: System MUST provide warnings when image preprocessing deviates from expected pipeline
- **FR-006**: System MUST maintain L2-normalized embeddings for both database and query vectors
- **FR-007**: System MUST compute similarity scores using cosine similarity (dot product of normalized vectors)
- **FR-008**: System MUST preserve the full-resolution video frame before cropping to avoid quality degradation
- **FR-009**: System MUST document the preprocessing pipeline clearly for future maintainability
- **FR-010**: System MUST provide debugging capabilities to compare embeddings and validate preprocessing

### Assumptions

- The database embeddings were generated using square center-cropped images at 384×384 resolution
- The CLIP model (ViT-B/32) is consistent between Python and browser implementations
- Users have adequate lighting and camera quality for card recognition
- The database contains embeddings for all standard MTG cards with official artwork
- Video stream quality is sufficient to capture card details (minimum 720p recommended)

### Key Entities

- **Card Image**: The visual representation of an MTG card, either from the database (Scryfall) or captured via webcam. Key attributes include dimensions, aspect ratio, resolution, and preprocessing state (raw, cropped, resized, normalized).
- **Embedding Vector**: A 512-dimensional L2-normalized vector representing the semantic content of a card image. Generated by CLIP model and used for similarity comparison.
- **Preprocessing Pipeline**: The sequence of transformations applied to a card image before embedding generation, including crop strategy (center-crop to square), resize dimensions, and normalization steps.
- **Query Result**: The output of a card search, including matched card metadata, similarity score, and ranking. Contains card name, set, image URL, and confidence score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Top-1 accuracy (correct card as first result) improves by at least 30% compared to baseline measurements
- **SC-002**: Top-5 accuracy (correct card in top 5 results) improves by at least 50% compared to baseline measurements
- **SC-003**: When querying a card image directly from the database, the system returns itself as the top match with similarity score above 0.95
- **SC-004**: Preprocessing validation warnings are displayed when image dimensions deviate from expected square format
- **SC-005**: Query processing time remains under 3 seconds for typical card identification requests
- **SC-006**: The same card queried through different methods (webcam, upload) produces consistent top-3 results in at least 85% of cases
- **SC-007**: System successfully identifies cards at various angles (up to 30 degrees rotation) with the correct card appearing in top-5 results at least 70% of the time

### Baseline Measurements Required

Before implementation, establish baseline metrics:
- Current top-1 accuracy rate on a test set of 100 diverse cards
- Current top-5 accuracy rate on the same test set
- Current similarity scores for database self-queries
- Current consistency rate across query methods

These baselines will be used to validate the improvement percentages in SC-001 and SC-002.

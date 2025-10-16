# Feature Specification: Advanced Card Extraction with Corner Refinement, Perspective Warp, and Temporal Optimization

**Feature Branch**: `011-advanced-card-extraction`  
**Created**: 2025-10-16  
**Status**: Draft  
**Input**: User description: "Advanced Card Extraction with Corner Refinement, Perspective Warp, and Temporal Optimization"

## Clarifications

### Session 2025-10-16

- Q: When a card is partially covered by fingers, how should the system behave? → A: Attempt extraction anyway, fail gracefully if quad detection produces invalid geometry
- Q: How many frames should be buffered? → A: 6 frames
- Q: What should be the output dimensions of the extracted card image? → A: Square 384×384 to match embedding model input

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accurate Card Detection from Any Angle (Priority: P1)

As a player, when I click on a Magic card in my webcam feed, I want the system to accurately detect and extract the card image even when the card is held at an angle or has perspective distortion, so that I can reliably identify cards regardless of how I'm holding them.

**Why this priority**: This is the core value proposition. Without accurate extraction from angled cards, the feature fails its primary purpose. Most real-world usage involves cards at various angles.

**Independent Test**: Can be fully tested by clicking on cards held at 15°, 30°, and 45° angles and verifying the extracted image is properly corrected to a flat, rectangular view.

**Acceptance Scenarios**:

1. **Given** a card held at a 30° angle to the camera, **When** user clicks on the card, **Then** the extracted image shows a flat, rectangular card with corrected perspective
2. **Given** a card with visible perspective distortion (trapezoid shape), **When** user clicks on the card, **Then** the system applies homography transformation to produce a canonical rectangular view
3. **Given** a card rotated 15° clockwise, **When** user clicks on the card, **Then** the extracted corners are refined to match the actual card boundaries, not just an axis-aligned bounding box

---

### User Story 2 - Sharp Card Images from Video (Priority: P2)

As a player, when I click on a card, I want the system to automatically select the sharpest frame from recent video, so that the extracted card image is clear and readable even if my hand was moving slightly.

**Why this priority**: Improves extraction quality significantly but the feature still works without it. Adds robustness to real-world conditions where hands naturally move.

**Independent Test**: Can be tested by moving a card slightly while clicking, then verifying the extracted image is sharper than the frame at the exact moment of click.

**Acceptance Scenarios**:

1. **Given** a card being held with slight hand movement, **When** user clicks on the card, **Then** the system buffers the last 5-8 frames and selects the sharpest one for extraction
2. **Given** a slightly blurry frame at click time, **When** a sharper frame exists within ±150ms, **Then** the system uses the sharper frame for the final extraction
3. **Given** multiple frames with varying sharpness, **When** system evaluates frames, **Then** sharpness is measured using Laplacian variance and the highest scoring frame is selected

---

### User Story 3 - Adaptive Detection for Difficult Conditions (Priority: P3)

As a player, when the initial card detection doesn't find clear edges, I want the system to automatically expand its search area, so that cards are successfully detected even in challenging lighting or positioning.

**Why this priority**: Nice-to-have robustness feature. The system works without it, but this handles edge cases and difficult conditions more gracefully.

**Independent Test**: Can be tested by positioning a card at the edge of the frame or in poor lighting, verifying the system expands its region of interest (ROI) to successfully detect the card.

**Acceptance Scenarios**:

1. **Given** a card where initial edge detection fails, **When** system cannot find clear contours, **Then** the ROI expands from 1.0× to 1.5× expected card size
2. **Given** an expanded ROI that still doesn't find edges, **When** second attempt fails, **Then** the ROI expands to 2.0× expected card size
3. **Given** a successfully detected card after ROI expansion, **When** extraction completes, **Then** the system uses the refined quad from the expanded ROI

---

### Edge Cases

- **Partial occlusion**: When a card is partially covered by fingers or other objects, system attempts extraction and fails gracefully if quad detection produces invalid geometry
- How does the system handle multiple cards in the same frame?
- What happens when lighting creates strong glare or shadows on the card?
- How does the system behave when the card is too close or too far from the camera?
- What happens if the user clicks on a non-card object?
- How does the system handle cards with non-standard aspect ratios (oversized cards, tokens)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect card corners using contour detection and polygon approximation, not just axis-aligned bounding boxes
- **FR-002**: System MUST refine detected corners to match actual card boundaries within 5 pixels accuracy
- **FR-003**: System MUST compute homography transformation from detected quad to canonical rectangle
- **FR-004**: System MUST apply perspective warp to correct for angle and distortion
- **FR-005**: System MUST maintain a rolling buffer of the last 6 video frames
- **FR-006**: System MUST calculate sharpness score for each buffered frame using Laplacian variance
- **FR-007**: System MUST select the sharpest frame within ±150ms of user click for final extraction
- **FR-008**: System MUST start with ROI at 1.0× expected card size
- **FR-009**: System MUST expand ROI to 1.5× if initial edge detection fails
- **FR-010**: System MUST expand ROI to 2.0× if second edge detection attempt fails
- **FR-011**: System MUST validate detected quad has approximately correct aspect ratio (within 20% of expected MTG card ratio 63:88)
- **FR-012**: System MUST output extracted card as canonical 384×384 pixel square to match embedding model input
- **FR-013**: System MUST highlight selected quad on user click for visual feedback
- **FR-014**: System MUST show extracted preview immediately, then replace with sharper re-warped version once ready
- **FR-015**: System MUST attempt extraction even when card is partially occluded, failing gracefully if quad detection produces invalid geometry (e.g., non-convex polygon, extreme aspect ratio deviation)

### Key Entities

- **Card Quad**: Four corner points defining the card boundaries in the video frame, refined from segmentation mask contours
- **Frame Buffer**: Rolling collection of 6 recent video frames with associated metadata (timestamp, sharpness score)
- **Homography Matrix**: 3×3 transformation matrix mapping detected quad to canonical rectangle
- **ROI (Region of Interest)**: Bounding area around click point where edge detection is performed, with adaptive sizing
- **Sharpness Score**: Numerical measure of frame clarity using Laplacian variance

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully extract readable card images from cards held at angles up to 45° from camera plane
- **SC-002**: Extracted card images have perspective distortion corrected to within 2% of ideal rectangular geometry
- **SC-003**: System selects a sharper frame than the click-time frame in at least 70% of cases where hand movement is present
- **SC-004**: Card detection succeeds on first attempt in 85% of cases, and within 3 ROI expansion attempts in 95% of cases
- **SC-005**: Corner refinement improves boundary accuracy by at least 30% compared to simple bounding box approach
- **SC-006**: Users receive visual feedback (highlighted quad) within 100ms of clicking on a card
- **SC-007**: Final high-quality extraction completes within 500ms of user click

## Assumptions

- OpenCV.js library will be integrated for geometry operations (getPerspectiveTransform, warpPerspective, findContours)
- SlimSAM segmentation is already functional and provides initial masks
- SlimSAM model instance is reused between clicks (warm model) for performance
- Video feed runs at minimum 15 FPS for effective frame buffering
- MTG cards have standard aspect ratio of 63:88 (can be used for validation)
- Users typically hold cards within 30-60cm of camera
- Webcam provides minimum 720p resolution

## Dependencies

- Existing SlimSAM detector implementation
- OpenCV.js library (not currently integrated)
- Existing webcam infrastructure and canvas rendering
- Frame capture and buffering capability

## Out of Scope

- Automatic card detection without user click
- Real-time tracking of moving cards
- Detection of multiple cards simultaneously
- OCR or text recognition from extracted cards
- Handling of severely damaged or bent cards
- Support for non-standard card sizes beyond ±20% aspect ratio tolerance

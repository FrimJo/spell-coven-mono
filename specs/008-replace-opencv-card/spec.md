# Feature Specification: Replace OpenCV Card Detection with DETR Object Detection

**Feature Branch**: `008-replace-opencv-card`  
**Created**: 2025-10-15  
**Status**: Draft  
**Input**: User description: "Replace OpenCV card detection with DETR object detection model from Transformers.js"

## Clarifications

### Session 2025-10-15

- Q: What minimum confidence score should the system use to filter DETR detections before applying aspect ratio validation? → A: 0.5 (50%) confidence threshold

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable Card Detection in Varied Lighting (Priority: P1)

As a Magic: The Gathering player, I want the system to accurately detect cards in my webcam stream regardless of lighting conditions, background clutter, or card orientation, so that I can quickly identify cards without adjusting my environment.

**Why this priority**: This is the core functionality that directly impacts user experience. Without reliable detection, the entire card identification workflow fails. Current OpenCV edge detection struggles with varying lighting and complex backgrounds.

**Independent Test**: Can be fully tested by pointing a webcam at MTG cards in different lighting conditions (bright, dim, mixed) and verifying detection accuracy. Delivers immediate value by improving the detection success rate.

**Acceptance Scenarios**:

1. **Given** a webcam stream with a card in normal indoor lighting, **When** the card is held steady in view, **Then** the system detects the card within 2 seconds and highlights it with a bounding box
2. **Given** a webcam stream with a card in dim lighting, **When** the card is visible to the human eye, **Then** the system still detects the card with at least 80% confidence
3. **Given** a webcam stream with a card on a cluttered desk background, **When** the card is partially visible, **Then** the system detects only the card and ignores other rectangular objects like books or phones
4. **Given** a webcam stream with a card at an angle (not perpendicular to camera), **When** the card aspect ratio is recognizable, **Then** the system detects the card and applies perspective correction

---

### User Story 2 - Faster Model Loading and Initialization (Priority: P2)

As a user, I want the card detection system to initialize quickly when I open the application, so that I can start identifying cards without long wait times.

**Why this priority**: User experience is significantly impacted by initialization time. While not blocking core functionality, slow loading creates friction and may cause users to abandon the tool.

**Independent Test**: Can be tested by measuring time from application start to first successful card detection. Delivers value by reducing user wait time.

**Acceptance Scenarios**:

1. **Given** the application is opened for the first time, **When** the DETR model needs to be downloaded, **Then** a progress indicator shows download status
2. **Given** the application is opened on subsequent visits, **When** the model is cached, **Then** detection is ready within 3 seconds
3. **Given** the model is loading, **When** the user views the webcam interface, **Then** a clear status message indicates "Loading detection model..."

---

### User Story 3 - Accurate Aspect Ratio Filtering (Priority: P3)

As a user, I want the system to only detect objects that match MTG card proportions (63:88 aspect ratio), so that I don't accidentally trigger identification on non-card rectangular objects.

**Why this priority**: Enhances precision and reduces false positives, but the DETR model already provides semantic understanding that reduces this issue compared to OpenCV.

**Independent Test**: Can be tested by placing various rectangular objects (phones, books, credit cards) in view alongside MTG cards and verifying only cards are detected.

**Acceptance Scenarios**:

1. **Given** a webcam stream with both an MTG card and a smartphone visible, **When** both are rectangular, **Then** only the MTG card is highlighted for identification
2. **Given** a webcam stream with a book and an MTG card, **When** both objects are detected, **Then** the system filters out the book based on aspect ratio mismatch
3. **Given** a webcam stream with multiple MTG cards, **When** all cards are visible, **Then** all cards are detected and can be individually selected

---

### Edge Cases

- What happens when no cards are visible in the stream? System should show "No cards detected" without errors
- What happens when the DETR model fails to load? System should fall back gracefully with an error message and not crash
- What happens when multiple cards overlap? System should detect visible portions and allow user to reposition cards
- What happens when the webcam feed is very low resolution? System should detect cards but may have reduced accuracy
- What happens when a card is held upside down or rotated? System should still detect the rectangular shape and apply appropriate transformations
- What happens when network is offline and model isn't cached? System should show clear error: "Detection model unavailable - please connect to internet for first-time download"

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect rectangular objects in webcam video stream using a machine learning model with a minimum confidence threshold of 0.5 (50%)
- **FR-002**: System MUST filter detected objects by aspect ratio to match MTG card dimensions (63:88, ±20% tolerance)
- **FR-003**: System MUST display bounding boxes around detected cards in real-time on the video overlay
- **FR-004**: System MUST allow users to click on a detected card to select it for identification
- **FR-005**: System MUST apply perspective transformation to extract the selected card as a rectangular image
- **FR-006**: System MUST maintain the corrected aspect ratio (315x440 pixels) when cropping detected cards
- **FR-007**: System MUST load the detection model on application initialization with progress feedback
- **FR-008**: System MUST cache the detection model in browser storage to avoid re-downloading on subsequent visits
- **FR-009**: System MUST handle model loading failures gracefully with user-friendly error messages
- **FR-010**: System MUST process video frames continuously for detection without blocking the UI
- **FR-011**: System MUST provide visual feedback when detection is active (e.g., bounding boxes, status indicators)
- **FR-012**: System MUST work with the existing CLIP-based card identification pipeline without modifications

### Key Entities

- **Detection Result**: Represents an object detected in the video frame, containing bounding box coordinates (xmin, ymin, xmax, ymax), confidence score, and label
- **Bounding Box**: Rectangular region defining the location of a detected card in the video frame, with coordinates expressed as percentages or pixels
- **Detected Card**: A filtered detection result that matches MTG card criteria (aspect ratio, minimum confidence), ready for user selection and cropping
- **DETR Model**: Pre-trained object detection model (Xenova/detr-resnet-50) loaded via Transformers.js pipeline, responsible for identifying rectangular objects in video frames

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Card detection accuracy improves by at least 30% compared to OpenCV edge detection in varied lighting conditions (measured by detection success rate across 100 test images)
- **SC-002**: False positive rate for non-card rectangular objects decreases by at least 50% (measured by testing with phones, books, and other rectangular objects)
- **SC-003**: Detection model loads and becomes operational within 5 seconds on cached visits and within 30 seconds on first visit (measured from page load to first detection)
- **SC-004**: System maintains at least 15 frames per second for real-time detection without UI lag (measured during continuous operation)
- **SC-005**: Users can successfully detect and identify cards in at least 90% of attempts under normal indoor lighting conditions
- **SC-006**: Detection works reliably with cards held at angles up to 45 degrees from perpendicular (measured by testing various orientations)
- **SC-007**: System gracefully handles model loading failures with clear error messages in 100% of failure cases (no crashes or blank screens)

### Assumptions

- Users have modern browsers with WebGL support for running the DETR model
- Users have stable internet connection for first-time model download (~40MB)
- Webcam provides at least 720p resolution for adequate card visibility
- Cards are held within 1-3 feet of the camera for optimal detection
- The existing CLIP-based identification pipeline remains unchanged and compatible with cropped card images

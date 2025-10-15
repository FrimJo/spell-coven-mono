# Feature Specification: Card Cropping and Image Database Query Integration

**Feature Branch**: `007-refactor-card-cropping`  
**Created**: 2025-10-15  
**Status**: Draft  
**Input**: User description: "Refactor card cropping and image database query with visual debugging"

## Clarifications

### Session 2025-10-15

- Q: Where should the debug cropped image be displayed in the game room interface? → A: As base64 image in console
- Q: What similarity score threshold should trigger a low-confidence warning to users? → A: 0.70
- Q: How should the system handle multiple rapid card clicks before the first query completes? → A: Cancel pending query and start new one (latest click wins)
- Q: Where should error messages and user feedback be displayed? → A: Inline in the result area below player list
- Q: How should the system handle card clicks when the CLIP model or image database is still loading or failed to load? → A: Whole page loading indicator
- Q: What design system and component library should be used? → A: Follow current design and colors, use existing components in packages/ui or create new shadcn components

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identify Card from Video Stream (Priority: P1)

During an online MTG game session, a player sees a card in another player's video stream and wants to identify it. The player clicks on the green-bordered card detection box in the video stream, and the system automatically crops the card, queries the image database, and displays the identified card with its details below the player list.

**Why this priority**: This is the core value proposition - enabling players to quickly identify cards during gameplay without interrupting the game flow. This delivers immediate value and is the primary use case.

**Independent Test**: Can be fully tested by starting a game room, enabling webcam with card detection, clicking on a detected card, and verifying the identified card appears below the player list with correct card information.

**Acceptance Scenarios**:

1. **Given** a game room is active with webcam enabled and card detection running, **When** a player clicks on a green-bordered detected card in the video stream, **Then** the card is cropped, queried against the database, and the top match result is displayed below the player list with card name, set, score, and image.

2. **Given** the card identification has completed successfully, **When** the player views the result below the player list, **Then** the result shows the card name, set code, similarity score, card image, and a link to Scryfall for more details.

3. **Given** multiple cards are detected in the video stream, **When** the player clicks on different detected cards sequentially, **Then** each click triggers a new identification and updates the displayed result below the player list.

---

### User Story 2 - Debug Cropped Card Images (Priority: P2)

During development or troubleshooting, a developer needs to verify that the card cropping is working correctly. The system logs the cropped image as a base64-encoded data URL to the browser console, allowing visual inspection of the crop quality by copying and viewing the image.

**Why this priority**: This is essential for debugging and quality assurance but not required for basic functionality. It helps developers understand why certain cards may not be identified correctly.

**Independent Test**: Can be tested by clicking on a detected card, opening the browser console, and verifying that a base64 image data URL is logged, which can be copied and pasted into a browser address bar to view the cropped image.

**Acceptance Scenarios**:

1. **Given** a card has been clicked and cropped from the video stream, **When** the query is executed, **Then** the cropped image is logged to the browser console as a base64-encoded data URL so developers can visually verify the crop quality.

2. **Given** the base64 image is logged to console, **When** a developer copies and pastes the data URL into a browser, **Then** the image shows the perspective-corrected card crop at the expected dimensions (446x620 pixels).

---

### User Story 3 - Handle Empty or Invalid Crops (Priority: P3)

When a player accidentally clicks on an area without a valid card detection or the crop fails, the system provides clear feedback without breaking the user experience.

**Why this priority**: This improves user experience and prevents confusion, but the core functionality works without it. Users can simply try clicking again.

**Independent Test**: Can be tested by clicking on areas of the video stream where no card is detected or where detection quality is poor, and verifying appropriate feedback is shown.

**Acceptance Scenarios**:

1. **Given** the video stream is active, **When** a player clicks on an area where no card is detected or the cropped canvas is empty, **Then** the system displays an inline message in the result area below the player list indicating no valid card was found and does not attempt to query the database.

2. **Given** a query returns a similarity score below 0.70, **When** the result is displayed, **Then** the system shows the result with an inline warning in the result area indicating low confidence in the match and suggests trying a clearer view of the card.

---

### Edge Cases

- What happens when the webcam feed is lost during card detection?
- What happens when the image database is not loaded or fails to load? (Answer: Whole page loading indicator prevents interaction until ready; failure shows error)
- What happens when a card is detected but the perspective transform produces a distorted crop?
- What happens when the CLIP model is still loading when a user clicks on a card? (Answer: Whole page loading indicator prevents clicks until model is ready)
- What happens when multiple rapid clicks occur before the first query completes? (Answer: Cancel pending query, process latest click only)
- What happens when the detected card is partially obscured or at an extreme angle?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extract the card cropping logic from the prototype implementation and integrate it into the main game room video stream component.

- **FR-002**: System MUST trigger card cropping when a user clicks on a detected card (green-bordered area) in the video stream.

- **FR-003**: System MUST perform perspective-correct cropping to produce a normalized card image at 446x620 pixels.

- **FR-004**: System MUST query the image database using the cropped card image and retrieve the top 1 matching result.

- **FR-005**: System MUST display the query result below the player list in the left sidebar of the game room, showing card name, set code, similarity score, card image, and Scryfall link.

- **FR-006**: System MUST log the cropped image as a base64-encoded data URL to the browser console for testing and troubleshooting purposes.

- **FR-007**: System MUST validate that the cropped canvas contains actual image data before attempting to query the database.

- **FR-008**: System MUST handle query failures gracefully by displaying inline error messages in the result area below the player list without crashing the application.

- **FR-011**: System MUST cancel any pending query when a new card click occurs, ensuring only the most recent query is processed (latest click wins).

- **FR-012**: System MUST display a whole-page loading indicator while the CLIP model and image database are loading, preventing user interaction until the system is ready.

- **FR-009**: System MUST reuse the existing search library functions (`embedFromCanvas`, `top1`) from the prototype implementation.

- **FR-010**: System MUST maintain the existing card detection functionality (green border overlay) that is already working in the current implementation.

### Design & UI Requirements

- **DR-001**: All UI components MUST follow the existing design system, maintaining consistent colors, typography, spacing, and visual style with the current game room interface.

- **DR-002**: UI components MUST be sourced from the existing `packages/ui` component library when available.

- **DR-003**: When new UI components are needed, they MUST be created as shadcn components and added to `packages/ui` for reusability.

- **DR-004**: The card result display area below the player list MUST integrate seamlessly with the existing left sidebar layout without disrupting the current player list or turn tracker components.

- **DR-005**: Loading indicators and error messages MUST use the same visual patterns and styling as existing loading and error states in the application.

### Key Entities

- **Card Detection Result**: Represents a detected card in the video stream, including the quadrilateral boundary points used for perspective transformation.

- **Cropped Card Image**: A perspective-corrected, normalized image of a card extracted from the video stream, sized at 446x620 pixels, ready for embedding and querying.

- **Query Result**: The top matching card from the image database, including card name, set code, similarity score, image URL, card URL, and Scryfall URI.

- **Card Metadata**: Information about a card stored in the image database, including name, set, collector number, image URLs, and Scryfall links.

### Non-Functional Requirements

- **NFR-001**: The card identification feature MUST maintain the same performance characteristics as the prototype implementation (query completion within 3 seconds).

- **NFR-002**: The UI MUST remain responsive during card cropping and querying operations, with appropriate loading states visible to users.

- **NFR-003**: All new components MUST be reusable and maintainable, following the existing monorepo architecture with components in `packages/ui`.

- **NFR-004**: The implementation MUST not introduce breaking changes to existing game room functionality (player list, turn tracker, video streams).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully identify a card by clicking on it in the video stream, with results appearing below the player list within 3 seconds of clicking.

- **SC-002**: The cropped card image is logged to the browser console as a base64 data URL, allowing developers to verify crop quality by viewing the logged image.

- **SC-003**: The system correctly handles at least 95% of valid card detections (green-bordered cards) without errors or crashes.

- **SC-004**: Query results display complete card information including name, set, score (to 3 decimal places), image, and Scryfall link when available.

- **SC-005**: The refactored implementation maintains the same card detection accuracy and performance as the prototype while integrating cleanly into the game room interface.

- **SC-006**: All UI components visually match the existing game room design system, with no visual inconsistencies in colors, typography, spacing, or component styling.

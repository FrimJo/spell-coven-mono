# Feature Specification: Card Recognition via Webcam

**Feature Branch**: `001-enable-mtg-players`  
**Created**: 2025-10-13  
**Status**: Draft  
**Input**: User description: "Enable MTG players to identify physical cards via webcam using AI-powered visual search, running entirely in the browser for privacy and offline use"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Quick Card Identification (Priority: P1)

As an MTG player playing remotely, I want to click on a card visible in my webcam feed and instantly see its name and details, so I can quickly look up rulings or verify card information during gameplay without interrupting the flow of the game.

**Why this priority**: This is the core value proposition - enabling card identification during remote play. Without this, players must manually search for cards by name or use external tools, breaking immersion and slowing gameplay. This story alone delivers a complete, usable feature.

**Independent Test**: Can be fully tested by starting the webcam, pointing it at any MTG card, clicking on the card in the video feed, and verifying that the correct card name and Scryfall link appear within 3 seconds. Delivers immediate value for rules lookups during games.

**Acceptance Scenarios**:

1. **Given** I have opened the application in my browser, **When** I click "Start Webcam" and grant camera permissions, **Then** I see my webcam feed with detected card boundaries highlighted
2. **Given** a Magic card is visible in my webcam feed with a highlighted boundary, **When** I click on the card, **Then** the system crops and identifies the card within 3 seconds
3. **Given** a card has been identified, **When** I view the results, **Then** I see the card name, set information, thumbnail image, and a link to the full Scryfall page
4. **Given** I have identified one card, **When** I want to identify another card, **Then** I can click on a different card without restarting the webcam
5. **Given** the card is at an angle or partially obscured, **When** I click on it, **Then** the system still identifies it correctly using perspective correction

---

### User Story 2 - Offline Card Recognition (Priority: P2)

As an MTG player with unreliable internet or privacy concerns, I want the card recognition to work entirely in my browser after the initial load, so I can identify cards without sending my gameplay data to external servers and continue playing even if my connection drops.

**Why this priority**: Privacy and offline capability are key differentiators from competitors like SpellTable. This enables self-hosting and builds trust with privacy-conscious users. However, basic identification (P1) must work first.

**Independent Test**: Can be tested by loading the application once with internet, then disconnecting from the network and verifying that card identification still works. Delivers value for privacy-focused users and those with unstable connections.

**Acceptance Scenarios**:

1. **Given** I have loaded the application once with internet access, **When** I disconnect from the internet, **Then** I can still identify cards using my webcam
2. **Given** the application is running offline, **When** I identify a card, **Then** the card name and cached information display correctly (external links may not work)
3. **Given** I am using the application, **When** I check network activity, **Then** no card image data or query information is sent to external servers during identification
4. **Given** I close and reopen my browser while offline, **When** I load the application, **Then** the cached model and card database load from browser storage

---

### User Story 3 - Multi-Card Database Support (Priority: P3)

As an MTG player who plays different formats, I want the system to recognize cards from all MTG sets (50,000+ cards), so I can identify any card regardless of format, age, or rarity without maintaining multiple databases.

**Why this priority**: Comprehensive card coverage is important for user satisfaction but not critical for MVP. The system can launch with a subset of popular cards and expand coverage over time. P1 and P2 deliver core value even with limited card coverage.

**Independent Test**: Can be tested by attempting to identify cards from various sets (old/new, common/rare, different frames) and verifying >90% accuracy across the full database. Delivers value for players who use diverse card collections.

**Acceptance Scenarios**:

1. **Given** the card database contains 50,000+ unique card artworks, **When** I identify a card from any set, **Then** the system returns the correct match with >90% accuracy
2. **Given** I am identifying cards from different eras, **When** I test cards with old frames, modern frames, and special treatments, **Then** all frame types are recognized correctly
3. **Given** a card has multiple printings with different artwork, **When** I identify a specific printing, **Then** the system returns the exact artwork match, not just the card name
4. **Given** the card database is large, **When** the application loads, **Then** the initial load completes in under 30 seconds on modern browsers

---

### Edge Cases

- **What happens when no card is visible in the webcam?** System shows "No cards detected" message and prompts user to position a card in view
- **What happens when multiple cards overlap?** System highlights all detected card boundaries; user clicks on the specific card they want to identify
- **What happens when the card is blurry or out of focus?** System attempts identification but may return lower confidence results; user can retry with better positioning
- **What happens when the card is a token or custom proxy?** System may not find a match if the artwork isn't in the database; shows "No match found" with option to search by name
- **What happens when browser camera permissions are denied?** System displays clear error message explaining that camera access is required and provides instructions to enable it
- **What happens when the AI model fails to download?** System shows error message with troubleshooting steps (check internet connection, clear browser cache, try different browser)
- **What happens when the card database is corrupted or incomplete?** System validates data integrity on load and shows error if validation fails, preventing silent failures
- **What happens when identifying a double-faced card?** System identifies the visible face and provides information for that specific face
- **What happens on first load with slow internet?** System shows progress indicator for model download (~150MB) and allows user to cancel if needed

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST access the user's webcam and display a live video feed in the browser
- **FR-002**: System MUST detect rectangular card-like shapes in the webcam feed and highlight their boundaries visually
- **FR-003**: System MUST allow users to click on a detected card to select it for identification
- **FR-004**: System MUST crop the selected card area and apply perspective correction to normalize the image
- **FR-005**: System MUST identify the card by comparing it against a pre-loaded database of card images
- **FR-006**: System MUST display the identified card's name, set code, and image
- **FR-007**: System MUST provide a link to external card information (e.g., Scryfall page)
- **FR-008**: System MUST work entirely in the browser without requiring server-side processing for card identification
- **FR-009**: System MUST cache the AI model and card database in browser storage for offline use after initial load
- **FR-010**: System MUST validate data integrity of the card database on load to prevent silent failures
- **FR-011**: System MUST show progress indicators during model download and card database loading
- **FR-012**: System MUST handle camera permission denials gracefully with clear error messages
- **FR-013**: System MUST support identifying cards at various angles using perspective transformation
- **FR-014**: System MUST return identification results within 3 seconds of card selection under normal conditions
- **FR-015**: System MUST work on modern browsers (Chrome, Firefox, Safari) without requiring plugins or extensions

### Key Entities

- **Card**: Represents a Magic: The Gathering card with attributes including name, set code, artwork image, collector number, and external reference links. Each card may have multiple printings with different artwork.
- **Card Database**: A collection of pre-computed visual representations (embeddings) for all known card artworks, along with metadata for each card. Loaded once and cached in browser storage.
- **Detection Result**: Represents a detected card boundary in the webcam feed, including the polygon coordinates and confidence score.
- **Identification Result**: The output of matching a cropped card image against the database, including the matched card information and similarity score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify a card from webcam to results display in under 3 seconds (90th percentile)
- **SC-002**: System achieves >90% accuracy in identifying cards from the database when cards are clearly visible
- **SC-003**: System successfully loads and becomes operational in under 30 seconds on modern browsers with typical broadband connections
- **SC-004**: 90% of users successfully identify their first card on the first attempt without requiring help documentation
- **SC-005**: System works offline after initial load, with 100% of identification features functional without internet connectivity
- **SC-006**: System handles 50,000+ card database without degrading identification speed beyond the 3-second target
- **SC-007**: Card detection highlights boundaries correctly for 85% of cards positioned within the webcam frame
- **SC-008**: System provides clear, actionable error messages for 100% of failure scenarios (camera denied, model load failed, etc.)
- **SC-009**: Perspective correction successfully normalizes cards at angles up to 45 degrees from perpendicular
- **SC-010**: Browser cache successfully stores model and database, reducing subsequent load times to under 3 seconds

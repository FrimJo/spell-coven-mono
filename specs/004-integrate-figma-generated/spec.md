# Feature Specification: Integrate Figma UI into Web Application

**Feature Branch**: `004-integrate-figma-generated`  
**Created**: 2025-10-13  
**Status**: Draft  
**Input**: User description: "Integrate Figma-generated React UI code into apps/web with Vite and TanStack Router architecture, including shadcn/ui components, game room functionality, and Tailwind CSS styling"

**Source**: `code_from_figma_make/` directory (to be migrated and removed)

## Clarifications

### Session 2025-10-13

- Q: How should game state be persisted when users navigate or refresh the page? → A: Session storage only (cleared on browser close)
- Q: How should the migration handle potential conflicts with existing routes in apps/web? → A: Move existing routes to /prev
- Q: Should all 46 shadcn/ui components be migrated, or only the ones actually used? → A: Migrate used components to shared package
- Q: What level of granularity should error boundaries have? → A: Per-route error boundaries (landing page, game room)
- Q: Should theme switching (dark/light mode) be implemented as part of this migration? → A: No theme support - remove next-themes dependency

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

### User Story 1 - Access Game Interface (Priority: P1)

As a developer, I want the Figma-generated UI components integrated into the existing web application so that users can access the landing page, create/join games, and view the game room interface through the standard application routing.

**Why this priority**: This is the foundation - without the UI integrated into the application, users cannot access any game functionality. This delivers immediate visible value by making the designed interface accessible.

**Independent Test**: Can be fully tested by navigating to the root URL and verifying that the landing page renders correctly, then creating a game and confirming the game room interface loads. Delivers value by providing a functional UI that users can interact with.

**Acceptance Scenarios**:

1. **Given** I navigate to the application root URL, **When** the page loads, **Then** I see the Figma-designed landing page with options to create or join a game
2. **Given** I am on the landing page, **When** I enter my name and click "Create Game", **Then** I am routed to the game room interface with my player name displayed
3. **Given** I am on the landing page, **When** I enter my name and a game ID and click "Join Game", **Then** I am routed to the game room interface for that specific game
4. **Given** I am in a game room, **When** I click "Leave Game", **Then** I am routed back to the landing page
5. **Given** I navigate between pages, **When** the browser back/forward buttons are used, **Then** routing works correctly without page refreshes

---

### User Story 2 - Use Shared UI Components (Priority: P2)

As a developer, I want all shadcn/ui components (buttons, dialogs, cards, etc.) properly integrated and styled with Tailwind CSS so that the interface has a consistent, polished appearance and components are reusable across the application.

**Why this priority**: Component consistency and reusability are essential for maintainability and user experience, but the basic routing (P1) must work first. This ensures the UI looks professional and components can be reused in future features.

**Independent Test**: Can be tested by verifying that all UI components render with correct Tailwind styling, are interactive (buttons click, dialogs open/close), and maintain consistent design patterns. Delivers value by providing a professional, cohesive user interface.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** I interact with buttons, dialogs, and other UI components, **Then** they respond correctly with proper styling and animations
2. **Given** I view different pages, **When** I observe the UI components, **Then** they maintain consistent styling, spacing, and visual hierarchy
3. **Given** I resize the browser window, **When** the viewport changes, **Then** components respond appropriately with Tailwind's responsive classes
4. **Given** I inspect the component code, **When** I review the implementation, **Then** components use Tailwind utility classes instead of custom CSS
5. **Given** I need to reuse a component, **When** I import it in a new location, **Then** it works without requiring additional styling or configuration

---

### User Story 3 - Interact with Game Features (Priority: P3)

As a player, I want to interact with game-specific features (card scanner, game board, player stats, video panel, turn tracker) so that I can fully participate in remote MTG gameplay with a rich, feature-complete interface.

**Why this priority**: Game features provide the complete experience but depend on the basic routing (P1) and styled components (P2) working first. This completes the full game room functionality.

**Independent Test**: Can be tested by entering a game room and verifying that all game features (scanner, board, stats, video, turns) are accessible, interactive, and display correctly. Delivers value by providing the complete gameplay experience.

**Acceptance Scenarios**:

1. **Given** I am in a game room, **When** I view the interface, **Then** I see the card scanner, game board, player stats, video panel, and turn tracker components
2. **Given** I interact with the card scanner, **When** I activate it, **Then** it provides the expected functionality for card recognition
3. **Given** I view the game board, **When** cards are played, **Then** the board updates to reflect the game state
4. **Given** I view player stats, **When** game actions occur, **Then** stats (life total, card counts) update accordingly
5. **Given** I use the turn tracker, **When** turns progress, **Then** the current player and phase are clearly indicated
6. **Given** I use the video panel, **When** video features are active, **Then** player video feeds display correctly

### Edge Cases

- **What happens when navigating directly to a game room URL without going through the landing page?** System should check session storage for valid game state; if present, load the game room; otherwise redirect to landing page
- **What happens when a component fails to load or render?** Per-route error boundaries (one for landing page, one for game room) will catch errors and display fallback UI with error message and recovery options
- **What happens when Tailwind classes conflict with existing styles?** Migration should remove conflicting styles and ensure Tailwind takes precedence
- **What happens when shadcn/ui components have different versions than expected?** System should validate component compatibility and update dependencies if needed
- **What happens when the code_from_figma_make folder is not present?** Migration script should fail gracefully with clear error message
- **What happens when routes conflict with existing application routes?** System should move existing routes to /prev namespace to preserve them while new routes take precedence
- **What happens when responsive breakpoints don't match existing design?** Tailwind configuration should be updated to match Figma design breakpoints
- **What happens when dark mode or theme switching is needed?** Not applicable - theme switching is out of scope; next-themes dependency will be removed
- **What happens when accessibility features are missing?** Components should maintain ARIA labels and keyboard navigation from shadcn/ui defaults

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

**Migration & Integration**:
- **FR-001**: System MUST migrate all React components from `code_from_figma_make/src/components/` to `apps/web/src/components/`
- **FR-002**: System MUST integrate TanStack Router for client-side routing between landing page and game room
- **FR-003**: System MUST configure Vite to properly resolve imports for migrated components
- **FR-004**: System MUST remove the `code_from_figma_make/` directory after successful migration
- **FR-005**: System MUST merge dependencies from `code_from_figma_make/package.json` into `apps/web/package.json`

**UI Components**:
- **FR-006**: System MUST migrate only used shadcn/ui components to a shared package for monorepo-wide reuse
- **FR-007**: System MUST refactor all component styling to use Tailwind CSS utility classes
- **FR-008**: System MUST maintain component functionality while converting from custom CSS to Tailwind
- **FR-009**: System MUST configure Tailwind to support all required design tokens (colors, spacing, typography)
- **FR-010-NEW**: System MUST remove next-themes dependency and any theme-switching code

**Routing & Navigation**:
- **FR-011**: System MUST create routes for landing page ("/") and game room ("/game/:gameId")
- **FR-012**: System MUST move existing conflicting routes to /prev namespace
- **FR-013**: System MUST handle route parameters (gameId, playerName) correctly
- **FR-014**: System MUST support browser back/forward navigation without page refreshes
- **FR-015**: System MUST preserve game state in session storage (cleared on browser close)
- **FR-016**: System MUST implement per-route error boundaries for landing page and game room

**Game Features**:
- **FR-017**: System MUST integrate CardScanner component for card recognition functionality
- **FR-018**: System MUST integrate GameBoard component for displaying game state
- **FR-019**: System MUST integrate PlayerStats component for tracking player information
- **FR-020**: System MUST integrate VideoPanel component for video communication
- **FR-021**: System MUST integrate TurnTracker component for managing game turns

### Key Entities

- **Game Session**: Represents an active game with attributes including gameId (unique identifier), playerName (current player), and game state. Persisted in session storage (cleared on browser close). Manages the lifecycle of a game from creation/join to leave.
- **Route**: Represents a navigable page in the application including path, component, and parameters. New routes include landing page (/) and game room (/game/:gameId). Existing routes are moved to /prev namespace. Each route has its own error boundary.
- **UI Component**: Represents a reusable interface element from shadcn/ui library including buttons, dialogs, cards, and form elements. Only used components are migrated to a shared package for monorepo-wide reuse. Components are styled with Tailwind and follow consistent design patterns. No theme switching support.
- **Game Feature Component**: Represents game-specific functionality including CardScanner (card recognition), GameBoard (game state display), PlayerStats (player tracking), VideoPanel (video communication), and TurnTracker (turn management).

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: All components from `code_from_figma_make/` are successfully migrated to `apps/web/` with 100% functionality preserved
- **SC-002**: Users can navigate from landing page to game room and back without errors or page refreshes
- **SC-003**: Only used shadcn/ui components are migrated to shared package and render correctly with Tailwind styling
- **SC-004**: The `code_from_figma_make/` directory is completely removed after migration with no remaining references
- **SC-005**: Application builds successfully with Vite and all imports resolve correctly
- **SC-006**: All game feature components (scanner, board, stats, video, tracker) are accessible and functional in the game room
- **SC-007**: Routing handles edge cases (direct URLs, back/forward navigation, invalid game IDs) gracefully with session storage checks and per-route error boundaries
- **SC-008**: Component styling uses 100% Tailwind CSS with no custom CSS files remaining from Figma export
- **SC-009**: Application maintains responsive design across mobile, tablet, and desktop breakpoints
- **SC-010**: All dependencies are properly merged, next-themes is removed, and no duplicate packages exist
- **SC-011**: Existing routes are successfully moved to /prev namespace without breaking functionality
- **SC-012**: Game state persists correctly in session storage across route transitions and page refreshes within the same browser session

<!--
Sync Impact Report:
- Version change: 1.0.0 → 1.1.0
- Modified principles: Development Workflow
- Added sections: Continuous Verification (type checking, linting, Context7 usage)
- Templates requiring updates:
  ⏳ plan-template.md (may need review for continuous verification practices)
  ⏳ tasks-template.md (may need review for continuous verification practices)
- Follow-up TODOs: None
- Previous changes:
  - 1.0.0 (2025-10-13): Initial creation with all core principles
-->

# Spell Coven Constitution

## Core Principles

### I. Browser-First Architecture

All features MUST run entirely in the browser without backend dependencies for core functionality. This principle ensures accessibility, privacy, and offline capability.

**Rules:**
- Core features (card recognition, video chat, game tools) MUST work client-side
- Heavy computation MUST use browser-native APIs (WebGL, WebGPU, WebRTC, Web Workers)
- Models and data MUST be optimized for browser delivery (quantization, compression, CDN caching)
- Backend services are OPTIONAL and used only for matchmaking, room coordination, or social features
- Self-hosting MUST remain viable without cloud dependencies

**Rationale:** Spell Coven competes with SpellTable by offering privacy-focused, open-source remote MTG play. Browser-first architecture eliminates installation friction, enables offline use after initial load, and allows self-hosting without infrastructure costs.

### II. Data Contract Discipline

All data exchanges between systems, packages, or phases MUST have explicit, versioned contracts with validation and error handling.

**Rules:**
- Every exported artifact MUST include version metadata (e.g., `"version": "1.0"` in JSON)
- Binary formats MUST document byte order, layout, quantization, and validation rules
- Schema changes MUST follow semantic versioning (MAJOR for breaking changes, MINOR for additions, PATCH for clarifications)
- Consumers MUST validate inputs and provide clear error messages for contract violations
- Backward compatibility is NOT required; breaking changes are acceptable with version bumps and clear migration paths

**Rationale:** The project spans Python pipelines, browser JavaScript, and multiple data formats (FAISS, int8 binaries, JSON). Explicit contracts prevent silent failures and enable independent evolution of components. See `packages/mtg-image-db/SPEC.md` sections 6.2.1-6.2.2 for reference implementation.

### III. User-Centric Prioritization

Feature development MUST prioritize user-facing value over developer convenience or build-time optimization.

**Rules:**
- User priorities: 1) Accuracy/quality, 2) Runtime performance, 3) Resource efficiency (download size, memory)
- Build time and developer ergonomics are secondary concerns
- Features MUST be organized as independently testable user stories with clear acceptance criteria
- Each user story MUST deliver standalone value (MVP-first approach)
- Performance optimizations MUST target user-perceived metrics (query latency, FPS, load time)

**Rationale:** Spell Coven serves MTG players, not developers. Decisions like int8 quantization (75% smaller downloads), HNSW indexing (10-100x faster queries), and PNG image priority (better accuracy) all prioritize user experience. See `packages/mtg-image-db/IMPROVEMENTS.md` for priority framework.

### IV. Specification-Driven Development

Features MUST be specified before implementation, with clear requirements, data contracts, and acceptance criteria.

**Rules:**
- Every feature MUST have a `spec.md` with user scenarios, functional requirements, and success criteria
- Specifications MUST be technology-agnostic (describe WHAT, not HOW)
- Data contracts MUST be documented with schemas, validation rules, and error handling
- Acceptance criteria MUST be testable and measurable
- Specifications MUST be versioned and include changelogs

**Rationale:** The project has complex data pipelines (Scryfall → Python → FAISS → Browser) and multiple integration points. Specifications prevent misalignment, enable parallel development, and serve as living documentation. See `packages/mtg-image-db/SPEC.md` and `apps/web/SPEC.md` for examples.

### V. Monorepo Package Isolation

Packages MUST be self-contained with clear boundaries, independent versioning, and minimal coupling.

**Rules:**
- Each package MUST have its own README, SPEC (if applicable), and dependency manifest
- Packages MUST NOT share mutable state or side-effect-heavy code
- Cross-package dependencies MUST be explicit and versioned
- Data flows between packages via exported artifacts (files, APIs), not shared memory
- Each package MUST be independently buildable and testable

**Rationale:** Turborepo monorepo structure enables code sharing while maintaining modularity. `@repo/mtg-image-db` (Python pipeline) and `web` (React app) have different lifecycles, languages, and deployment targets. Clear boundaries enable independent evolution.

### VI. Performance Through Optimization, Not Complexity

Performance improvements MUST come from algorithmic optimization and data efficiency, not architectural complexity.

**Rules:**
- Prefer simple, optimized implementations over complex abstractions
- Use proven algorithms (HNSW for ANN, int8 quantization, CLIP embeddings)
- Optimize data formats for target platform (int8 for browser, FAISS for Python)
- Measure before optimizing; use profiling to identify bottlenecks
- Document performance characteristics and trade-offs

**Rationale:** The project achieves <1ms search over 50k+ cards through simple dot products on quantized embeddings, not complex infrastructure. HNSW indexing provides 10-100x speedup without distributed systems. See `apps/web/README.md` performance section.

### VII. Open Source and Community-Driven

Development MUST prioritize transparency, extensibility, and community contribution.

**Rules:**
- All code MUST be open source with permissive licensing
- Architecture MUST support self-hosting and customization
- Documentation MUST enable new contributors to understand and extend the system
- Breaking changes MUST include migration guides
- Community feedback MUST inform feature prioritization

**Rationale:** Spell Coven differentiates from SpellTable through open-source development and community ownership. Extensibility enables custom features, integrations, and self-hosted deployments.

## Browser-First Architecture Standards

### Client-Side Model Delivery

- Models MUST be served via CDN (Hugging Face) with browser caching (IndexedDB)
- Model downloads MUST be quantized (e.g., 147MB vs 578MB for CLIP)
- First-load experience MUST show progress indicators
- Offline functionality MUST work after initial asset download

### Data Pipeline Optimization

- Embeddings MUST be pre-computed server-side (Python pipeline)
- Browser artifacts MUST use optimal formats (int8 quantized binaries, not JSON)
- Metadata MUST be co-located with embeddings for atomic loading
- Export process MUST validate artifact integrity before shipping

### WebRTC and Real-Time Features

- Video/audio MUST use peer-to-peer WebRTC (no media servers for core functionality)
- Signaling MAY use lightweight backend (optional)
- Room state MUST support offline-first with eventual consistency
- Network failures MUST degrade gracefully (continue local game state)

## Data Contracts and Versioning

### Contract Requirements

All data contracts MUST include:
- Version field (semantic versioning)
- Schema documentation (JSON Schema, binary format specs)
- Validation rules and error messages
- Compatibility matrix showing supported versions

### Breaking Change Policy

- MAJOR version: Incompatible schema changes, removed fields, format changes
- MINOR version: New optional fields, expanded enums, additional metadata
- PATCH version: Documentation clarifications, typo fixes, non-semantic changes

### Error Handling Contract

Consumers MUST validate:
- File size matches expected dimensions
- Version compatibility
- Required fields presence
- Data type correctness

Errors MUST include:
- Clear field/constraint that failed
- Expected vs actual values
- Migration instructions for version mismatches

## Development Workflow

### Feature Development Lifecycle

1. **Specification** (`/speckit.specify`): Create `spec.md` with user stories, requirements, acceptance criteria
2. **Planning** (`/speckit.plan`): Generate `plan.md` with technical approach, data contracts, project structure
3. **Task Generation** (`/speckit.tasks`): Create `tasks.md` organized by user story priority
4. **Implementation** (`/speckit.implement`): Execute tasks in dependency order
5. **Validation**: Verify acceptance criteria and user story independence

### Testing Discipline

- Tests are OPTIONAL unless explicitly requested in feature specification
- When included, tests MUST be written FIRST and FAIL before implementation
- Each user story MUST be independently testable
- Contract tests MUST validate data format compliance
- Integration tests MUST verify end-to-end user journeys

### Continuous Verification

During development:
- Run type checking OFTEN (`pnpm check-types`) to catch type errors early
- Run linting OFTEN (`pnpm lint`) to maintain code quality and consistency
- Fix type and lint errors immediately rather than accumulating technical debt
- Use Context7 (`mcp1_resolve-library-id` and `mcp1_get-library-docs`) to get up-to-date documentation for any npm package

**Rationale:** Frequent type checking and linting prevents error accumulation and maintains code quality. Context7 provides accurate, version-specific documentation for npm packages, reducing reliance on potentially outdated information.

### Quality Gates

Before merging:
- TypeScript type checking MUST pass (`pnpm check-types`)
- Linting MUST pass (`pnpm lint`)
- Formatting MUST pass (`pnpm format`)
- Specifications MUST be updated if behavior changes
- Data contracts MUST be versioned if schemas change

## Governance

### Constitution Authority

This constitution supersedes all other development practices. When conflicts arise between this document and other guidance, the constitution takes precedence.

### Amendment Process

1. Propose amendment with rationale and impact analysis
2. Update affected templates (spec, plan, tasks, commands)
3. Document in Sync Impact Report (HTML comment at top of file)
4. Increment version according to semantic versioning rules
5. Update `LAST_AMENDED_DATE` to amendment date

### Complexity Justification

Any violation of simplicity principles (e.g., adding architectural layers, introducing new patterns) MUST be justified in `plan.md` Complexity Tracking section with:
- What principle is violated
- Why the complexity is necessary
- What simpler alternative was rejected and why

### Compliance Verification

- All feature specifications MUST include Constitution Check section
- Implementation plans MUST verify compliance before Phase 0 research
- Code reviews MUST check for unjustified complexity
- Specifications MUST align with user-centric prioritization

**Version**: 1.1.0 | **Ratified**: 2025-10-13 | **Last Amended**: 2025-10-14
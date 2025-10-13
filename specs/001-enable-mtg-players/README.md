# Feature: Card Recognition via Webcam

**Branch**: `001-enable-mtg-players`
**Status**: Specification Complete ✅
**Created**: 2025-10-13

## Overview

Enable MTG players to identify physical cards via webcam using AI-powered visual search, running entirely in the browser for privacy and offline use.

## Documentation Structure

This feature follows the SpecKit specification-driven development workflow:

### User-Focused Documents

- **[spec.md](./spec.md)** - Feature specification with user stories, acceptance criteria, and success metrics
  - 3 prioritized user stories (P1: Quick Identification, P2: Offline Support, P3: Full Database)
  - Edge cases and error scenarios
  - 15 functional requirements (FR-001 through FR-015)
  - 10 measurable success criteria (SC-001 through SC-010)

### Technical Documents

- **[plan.md](./plan.md)** - Implementation plan with technical approach and architecture
  - Technology stack (React, Vite, Transformers.js, OpenCV.js, Python/CLIP/FAISS)
  - Architecture diagrams and data flow
  - Performance optimizations (accuracy, speed, size)
  - Constitution compliance check (all principles satisfied ✅)

- **[contracts/](./contracts/)** - Data contract specifications
  - [browser-artifacts.md](./contracts/browser-artifacts.md) - Browser format (int8 embeddings + JSON metadata)
  - [python-artifacts.md](./contracts/python-artifacts.md) - Python format (NumPy + FAISS + JSONL)

### Quality Assurance

- **[checklists/requirements.md](./checklists/requirements.md)** - Specification quality validation
  - All checklist items passed ✅
  - Ready for planning phase

## Migration from Legacy SPEC.md Files

This feature was created by migrating content from existing technical specifications:

### Source Files

- `packages/mtg-image-db/SPEC.md` (v0.2.1) - Python pipeline specification
- `apps/web/SPEC.md` (v0.2.0) - Browser client specification

### Migration Mapping

| Legacy SPEC.md Section | SpecKit Location |
|------------------------|------------------|
| Summary | `spec.md` → User Stories |
| Goals/Non-Goals | `spec.md` → Success Criteria |
| Functional Requirements (user-facing) | `spec.md` → FR-001 through FR-015 |
| Functional Requirements (technical) | `plan.md` → Technical Context |
| Architecture Overview | `plan.md` → Architecture Overview |
| Data Contracts (Browser) | `contracts/browser-artifacts.md` |
| Data Contracts (Python) | `contracts/python-artifacts.md` |
| Acceptance Criteria (user) | `spec.md` → Acceptance Scenarios |
| Acceptance Criteria (technical) | `plan.md` → Validation Rules |

### Legacy Files Status

The original SPEC.md files remain in place as technical reference documentation:
- `packages/mtg-image-db/SPEC.md` - Detailed pipeline specification
- `apps/web/SPEC.md` - Detailed browser client specification

These can be deprecated in favor of SpecKit structure, or kept as supplementary technical docs.

## Next Steps

### 1. Create Remaining Planning Documents

```bash
# Generate tasks from spec and plan
/speckit.tasks
```

This will create:
- `tasks.md` - Implementation tasks organized by user story priority

### 2. Optional: Create Additional Documentation

- `data-model.md` - Entity relationship diagrams
- `quickstart.md` - Developer onboarding guide

### 3. Begin Implementation

```bash
# Execute tasks in dependency order
/speckit.implement
```

## Key Decisions

### Architecture

- **Browser-First**: All card identification runs client-side (Constitution Principle I)
- **Data Contracts**: Explicit versioned contracts between Python and browser (Constitution Principle II)
- **User-Centric**: Prioritizes accuracy > speed > size over build time (Constitution Principle III)

### Technology Choices

- **CLIP ViT-B/32**: Proven accuracy for visual similarity
- **int8 Quantization**: 75% size reduction with minimal accuracy loss
- **HNSW Index**: 10-100x query speedup
- **Transformers.js**: Browser-native AI inference
- **OpenCV.js**: Real-time card detection and perspective correction

### Performance Targets

- Card identification: <3 seconds (90th percentile)
- Initial load: <30 seconds on broadband
- Offline functionality: 100% after initial load
- Database scale: 50,000+ cards
- Accuracy: >90% for clearly visible cards

## Constitution Compliance

All 7 core principles satisfied:

- ✅ I. Browser-First Architecture
- ✅ II. Data Contract Discipline
- ✅ III. User-Centric Prioritization
- ✅ IV. Specification-Driven Development
- ✅ V. Monorepo Package Isolation
- ✅ VI. Performance Through Optimization, Not Complexity
- ✅ VII. Open Source and Community-Driven

No complexity justification required.

## References

- Constitution: `.specify/memory/constitution.md`
- Spec Template: `.specify/templates/spec-template.md`
- Plan Template: `.specify/templates/plan-template.md`
- Tasks Template: `.specify/templates/tasks-template.md`

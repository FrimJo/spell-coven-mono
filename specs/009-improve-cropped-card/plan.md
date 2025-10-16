# Implementation Plan: Improve Cropped Card Query Accuracy

**Branch**: `009-improve-cropped-card` | **Date**: 2025-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-improve-cropped-card/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix critical preprocessing pipeline mismatch between Python embedding generation and browser query processing. The database embeddings use square center-cropped images (384×384), but browser queries use rectangular card-aspect images (446×620), causing embeddings to exist in different spaces and resulting in poor similarity matching. This fix will align both pipelines to use identical square center-crop preprocessing, expected to improve top-1 accuracy by 30% and top-5 accuracy by 50%.

## Technical Context

**Language/Version**: TypeScript 5.x (browser), Python 3.11 (embedding pipeline - reference only)  
**Primary Dependencies**: 
- Browser: Transformers.js (CLIP ViT-B/32), Canvas API, existing detector infrastructure
- No new external dependencies required

**Storage**: N/A (client-side only, no persistence changes)  
**Testing**: Playwright (integration), manual validation with test card set  
**Target Platform**: Modern browsers (Chrome/Firefox/Safari) with Canvas API support
**Project Type**: Web application (monorepo package: `apps/web`)  
**Performance Goals**: 
- Query processing time <3 seconds (unchanged from current)
- Preprocessing overhead <100ms
- No impact on detection loop performance (500ms interval maintained)

**Constraints**: 
- MUST maintain compatibility with existing int8 quantized embeddings database
- MUST NOT require re-generation of embeddings (50k+ cards)
- MUST preserve existing CLIP model (Xenova/clip-vit-base-patch32)
- Browser-only changes (no Python pipeline modifications)

**Scale/Scope**: 
- Modify 2 files: `apps/web/src/lib/webcam.ts`, `apps/web/src/lib/detection-constants.ts`
- Add validation logic to `apps/web/src/lib/search.ts`
- Create test utilities for preprocessing validation
- Establish baseline accuracy measurements (100 card test set)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Browser-First Architecture ✅
- **Compliant**: All changes are client-side browser code
- **Compliant**: No backend dependencies introduced
- **Compliant**: Uses existing browser APIs (Canvas)
- **Compliant**: Maintains offline capability

### Data Contract Discipline ✅
- **Compliant**: No changes to data contracts (embeddings format unchanged)
- **Compliant**: Maintains compatibility with existing int8 quantized database
- **Compliant**: Validates preprocessing pipeline alignment

### User-Centric Prioritization ✅
- **Compliant**: Directly addresses user pain point (poor card identification accuracy)
- **Compliant**: Prioritizes accuracy improvement (30-50% gains)
- **Compliant**: Maintains performance constraints (<3s query time)
- **Compliant**: User stories organized by priority (P1: accuracy, P2: consistency, P3: feedback)

### Specification-Driven Development ✅
- **Compliant**: Feature has complete spec.md with user scenarios, requirements, success criteria
- **Compliant**: Acceptance criteria are testable and measurable
- **Compliant**: Technology-agnostic specification (describes WHAT, not HOW)

### Monorepo Package Isolation ✅
- **Compliant**: Changes isolated to `apps/web` package
- **Compliant**: No cross-package dependencies added
- **Compliant**: Python pipeline (`packages/mtg-image-db`) remains unchanged
- **Compliant**: Data flows via existing exported artifacts

### Performance Through Optimization ✅
- **Compliant**: Fixes algorithmic mismatch (preprocessing alignment)
- **Compliant**: No architectural complexity added
- **Compliant**: Simple implementation (crop strategy change)
- **Compliant**: Measurable performance characteristics documented

### Open Source and Community-Driven ✅
- **Compliant**: Changes are open source
- **Compliant**: Documentation enables understanding
- **Compliant**: No breaking changes to public APIs

**Result**: ✅ ALL GATES PASSED - No violations, proceed to Phase 0

---

### Post-Phase 1 Re-Check

**Date**: 2025-10-16  
**Status**: ✅ ALL GATES STILL PASSED

After completing Phase 1 (Design & Contracts), all constitution principles remain satisfied:

- **Browser-First**: ✅ No backend dependencies introduced in design
- **Data Contracts**: ✅ Preprocessing pipeline contract documented, no breaking changes
- **User-Centric**: ✅ Design prioritizes accuracy improvement
- **Specification-Driven**: ✅ Complete contracts and data model documented
- **Package Isolation**: ✅ Changes remain isolated to `apps/web`
- **Performance**: ✅ Simple algorithmic fix, no architectural complexity
- **Open Source**: ✅ All documentation open and accessible

**Conclusion**: Ready to proceed to Phase 2 (Task Generation via `/speckit.tasks`)

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
apps/web/
├── src/
│   ├── lib/
│   │   ├── webcam.ts                    # MODIFY: Update cropCardFromBoundingBox to use square center-crop
│   │   ├── detection-constants.ts       # MODIFY: Update CROPPED_CARD_WIDTH/HEIGHT to 384×384
│   │   ├── search.ts                    # MODIFY: Add preprocessing validation warnings
│   │   └── detectors/                   # NO CHANGES: Detection logic unchanged
│   └── components/                      # NO CHANGES: UI components unchanged
├── tests/
│   └── preprocessing-validation.spec.ts # NEW: Playwright test for preprocessing pipeline
└── public/
    └── data/mtg-embeddings/             # NO CHANGES: Existing embeddings database

packages/mtg-image-db/                   # NO CHANGES: Python pipeline reference only
├── build_embeddings.py                  # REFERENCE: Documents 384×384 target_size
└── build_mtg_faiss.py                   # REFERENCE: Documents center-crop strategy
```

**Structure Decision**: Web application structure (monorepo). Changes isolated to `apps/web/src/lib/` with focus on preprocessing alignment. No changes to Python pipeline (`packages/mtg-image-db`) - it serves as reference documentation for correct preprocessing behavior. Test utilities added to validate preprocessing correctness.

## Complexity Tracking

*No violations - section not applicable*

All constitution principles are satisfied. This is a straightforward bug fix that aligns preprocessing pipelines without introducing architectural complexity.

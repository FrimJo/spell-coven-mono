# Implementation Plan: Advanced Card Extraction with Corner Refinement, Perspective Warp, and Temporal Optimization

**Branch**: `011-advanced-card-extraction` | **Date**: 2025-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-advanced-card-extraction/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the existing SlimSAM-based card detection system with advanced geometry processing to accurately extract MTG cards from webcam video at any angle. The system will:

1. **Corner Refinement**: Replace simple bounding boxes with contour-detected quads that match actual card boundaries
2. **Perspective Warp**: Apply homography transformation to correct perspective distortion and produce canonical 384×384 pixel card images
3. **Temporal Optimization**: Buffer 6 video frames and select the sharpest using Laplacian variance for optimal extraction quality
4. **Adaptive ROI**: Expand region of interest (1.0× → 1.5× → 2.0×) when edge detection fails

This builds on the existing SlimSAM detector (already functional) and integrates OpenCV.js for geometry operations.

## Technical Context

**Language/Version**: TypeScript 5.x (React/Vite frontend)  
**Primary Dependencies**: 
- OpenCV.js (geometry operations: getPerspectiveTransform, warpPerspective, findContours)
- @huggingface/transformers.js (existing SlimSAM integration)
- Existing webcam infrastructure (`apps/web/src/lib/webcam.ts`)

**Storage**: Browser IndexedDB (model caching), in-memory frame buffer  
**Testing**: Playwright (existing setup), manual testing with physical MTG cards  
**Target Platform**: Modern browsers with WebGL/WebGPU support (Chrome, Firefox, Safari)  
**Project Type**: Web application (monorepo package `apps/web`)  
**Performance Goals**: 
- Visual feedback (highlighted quad) within 100ms of click
- Final extraction within 500ms of click
- Frame buffer management without memory leaks
- Maintain existing SlimSAM inference time (~1.2-1.7s)

**Constraints**: 
- Browser-only (no backend for core functionality)
- Must work with existing 720p webcam feed at 15+ FPS
- OpenCV.js bundle size impact (NEEDS CLARIFICATION: size and loading strategy)
- Memory usage for 6-frame buffer (NEEDS CLARIFICATION: cleanup strategy)

**Scale/Scope**: 
- Single-user, client-side processing
- ~15 new functions across 3-4 files
- OpenCV.js integration (new dependency)
- Extends existing SlimSAM detector class

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Browser-First Architecture ✅

- **Core functionality**: All geometry processing runs client-side using OpenCV.js (WASM)
- **No backend dependencies**: Feature works entirely in browser
- **Model reuse**: SlimSAM model instance already loaded and warm
- **Compliance**: PASS - Extends existing browser-first card detection

### II. Data Contract Discipline ✅

- **Input contract**: SlimSAM mask output (already validated)
- **Output contract**: 384×384 pixel PNG (matches existing embedding pipeline)
- **No new external data**: All processing on in-memory video frames
- **Compliance**: PASS - Maintains existing data contracts

### III. User-Centric Prioritization ✅

- **User priorities addressed**:
  1. Accuracy: Corner refinement + perspective warp improve extraction quality
  2. Performance: Temporal optimization selects sharpest frame
  3. Resource efficiency: Frame buffer limited to 6 frames
- **Feature organization**: 3 independent user stories (P1-P3)
- **Compliance**: PASS - P1 (corner refinement) delivers core value independently

### IV. Specification-Driven Development ✅

- **Specification**: Complete with user scenarios, 15 functional requirements, measurable success criteria
- **Technology-agnostic**: Spec describes WHAT (perspective correction), not HOW (OpenCV.js)
- **Testable criteria**: All acceptance scenarios use Given/When/Then format
- **Compliance**: PASS - Specification complete before implementation

### V. Monorepo Package Isolation ✅

- **Package scope**: Changes isolated to `apps/web` package
- **No cross-package changes**: Extends existing webcam infrastructure
- **Dependencies**: OpenCV.js added to `apps/web/package.json` only
- **Compliance**: PASS - Single package modification

### VI. Performance Through Optimization, Not Complexity ✅

- **Algorithmic approach**: Proven OpenCV algorithms (findContours, getPerspectiveTransform)
- **Simple implementation**: Extends existing SlimSAMDetector class
- **No new architectural layers**: Direct integration with existing webcam.ts
- **Compliance**: PASS - Uses established computer vision algorithms

### VII. Open Source and Community-Driven ✅

- **Open source**: OpenCV.js is Apache 2.0 licensed
- **Self-hosting**: No external services required
- **Documentation**: Plan includes quickstart and data model docs
- **Compliance**: PASS - Maintains open-source, self-hostable architecture

**Overall Status**: ✅ **PASS** - All constitution principles satisfied

## Project Structure

### Documentation (this feature)

```
specs/011-advanced-card-extraction/
├── spec.md              # Feature specification (already complete)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (OpenCV.js integration research)
├── data-model.md        # Phase 1 output (Frame buffer, quad geometry)
├── quickstart.md        # Phase 1 output (Developer setup guide)
├── contracts/           # Phase 1 output (TypeScript interfaces)
│   └── geometry.ts      # Card quad, homography matrix types
├── checklists/
│   └── requirements.md  # Specification quality checklist (complete)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
apps/web/
├── src/
│   ├── lib/
│   │   ├── detectors/
│   │   │   ├── slimsam-detector.ts          # MODIFY: Add corner refinement
│   │   │   ├── geometry/                    # NEW: Geometry utilities
│   │   │   │   ├── contours.ts              # findContours, polygon approximation
│   │   │   │   ├── perspective.ts           # homography, warpPerspective
│   │   │   │   └── validation.ts            # quad validation, aspect ratio
│   │   │   └── types.ts                     # MODIFY: Add CardQuad type
│   │   ├── webcam.ts                        # MODIFY: Add frame buffering
│   │   └── opencv-loader.ts                 # NEW: OpenCV.js lazy loading
│   └── hooks/
│       └── useWebcam.ts                     # MODIFY: Frame buffer management
├── package.json                             # MODIFY: Add opencv.js dependency
└── public/
    └── opencv/                              # NEW: OpenCV.js WASM files
        └── opencv.js                        # Loaded on demand

tests/ (optional, not required by spec)
└── e2e/
    └── card-extraction.spec.ts              # Playwright tests for angled cards
```

**Structure Decision**: Web application structure (monorepo `apps/web` package). Changes are isolated to the existing card detection system with a new `geometry/` module for OpenCV.js operations. OpenCV.js is loaded lazily to avoid impacting initial bundle size.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - All constitution principles satisfied. No complexity justification required.

---

## Phase 0: Research ✅ COMPLETE

**Output**: [research.md](./research.md)

All technical unknowns resolved:
- ✅ OpenCV.js integration strategy (lazy loading)
- ✅ Frame buffer memory management (circular buffer + WeakMap)
- ✅ Sharpness calculation method (Laplacian variance)
- ✅ Contour detection approach (findContours + approxPolyDP)
- ✅ Perspective transformation (getPerspectiveTransform + warpPerspective)
- ✅ ROI expansion strategy (progressive 1.0× → 1.5× → 2.0×)

---

## Phase 1: Design & Contracts ✅ COMPLETE

**Outputs**:
- [data-model.md](./data-model.md) - Core entities and data flow
- [contracts/geometry.ts](./contracts/geometry.ts) - TypeScript type definitions
- [quickstart.md](./quickstart.md) - Developer setup guide
- Agent context updated (Windsurf rules)

**Key Artifacts**:
- 5 core entities defined (CardQuad, FrameBuffer, HomographyMatrix, ROI, SharpnessScore)
- 15+ TypeScript interfaces and type guards
- Performance characteristics documented
- Memory management strategy defined

**Constitution Re-check**: ✅ PASS - Design maintains all constitution principles

---

## Phase 2: Task Generation

**Next Step**: Run `/speckit.tasks` to generate `tasks.md` with implementation tasks organized by user story priority.

**Expected Output**:
- P1 tasks: Corner refinement and perspective warp (core value)
- P2 tasks: Temporal optimization (quality improvement)
- P3 tasks: Adaptive ROI (robustness)

---

## Summary

**Planning Complete** ✅

This implementation plan provides:
- ✅ Complete technical research with all unknowns resolved
- ✅ Comprehensive data model with 5 core entities
- ✅ Type-safe contracts (TypeScript interfaces)
- ✅ Developer quickstart guide
- ✅ Constitution compliance verified
- ✅ Clear project structure and file organization

**Ready for**: `/speckit.tasks` to generate implementation tasks

**Branch**: `011-advanced-card-extraction`  
**Spec**: [spec.md](./spec.md)  
**Plan**: This file  
**Research**: [research.md](./research.md)  
**Data Model**: [data-model.md](./data-model.md)  
**Contracts**: [contracts/geometry.ts](./contracts/geometry.ts)  
**Quickstart**: [quickstart.md](./quickstart.md)

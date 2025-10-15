# Implementation Plan: Replace OpenCV Card Detection with DETR

**Branch**: `008-replace-opencv-card` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-replace-opencv-card/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Replace the current OpenCV edge detection system with DETR (DEtection TRansformer) object detection model from Transformers.js to improve card detection accuracy in varied lighting conditions and reduce false positives. The implementation will use the Xenova/detr-resnet-50 model with 0.5 confidence threshold, running inference at 500ms intervals (2 FPS) while maintaining smooth video overlay rendering. The system will filter detections by MTG card aspect ratio (63:88 ±20%) and integrate seamlessly with the existing CLIP-based card identification pipeline.

## Technical Context

**Language/Version**: TypeScript 5.x (existing project standard)  
**Primary Dependencies**: @huggingface/transformers ^3.7.5 (already installed), React 19, Vite 7  
**Storage**: Browser IndexedDB (for DETR model caching via Transformers.js), existing canvas-based video processing  
**Testing**: Playwright (e2e), Vitest (unit) - existing test infrastructure  
**Target Platform**: Modern browsers with WebGL support (Chrome, Firefox, Safari, Edge)  
**Project Type**: Web application (monorepo package: apps/web)  
**Performance Goals**: 
- Detection inference: 500ms intervals (2 FPS)
- Video overlay rendering: 30+ FPS (unchanged)
- Model load time: <5s cached, <30s first load
- Detection latency: <2s from card appearance to bounding box display

**Constraints**: 
- Must maintain existing CLIP identification pipeline (no breaking changes)
- Model size: ~40MB download (DETR resnet-50)
- Memory: Additional ~200MB for DETR model in browser
- Must work offline after initial model download
- No backend dependencies (browser-first architecture)

**Scale/Scope**: 
- Single feature modification in existing webcam.ts module (~365 lines)
- Affects detection loop only, not cropping or identification
- Estimated 200-300 lines of new/modified code
- 3 user stories (P1-P3) with independent test slices

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Browser-First Architecture ✅ PASS
- DETR model runs entirely client-side via Transformers.js
- Uses browser-native WebGL for model inference
- Model cached in IndexedDB (no backend required)
- Works offline after initial download
- No cloud dependencies for core detection functionality

### II. Data Contract Discipline ✅ PASS
- Detection results follow standard DETR output format: `{label, score, box: {xmin, ymin, xmax, ymax}}`
- Confidence threshold (0.5) and aspect ratio tolerance (±20%) explicitly defined
- Cropped canvas maintains existing 315x440px contract for CLIP pipeline
- No breaking changes to downstream identification system

### III. User-Centric Prioritization ✅ PASS
- P1 user story: Reliable detection (core value)
- P2 user story: Fast loading (UX improvement)
- P3 user story: Precision filtering (quality enhancement)
- Performance targets user-perceived metrics (2s detection, 15 FPS)
- 30% accuracy improvement and 50% false positive reduction directly benefit users

### IV. Specification-Driven Development ✅ PASS
- Complete spec.md with user scenarios, functional requirements, success criteria
- Clarifications documented (confidence threshold, detection frame rate)
- Acceptance criteria are testable and measurable
- Technology-agnostic specification (describes WHAT, not HOW)

### V. Monorepo Package Isolation ✅ PASS
- Changes isolated to apps/web package
- No cross-package dependencies added
- Existing @huggingface/transformers dependency already in package.json
- No shared state modifications

### VI. Performance Through Optimization ✅ PASS
- Uses proven DETR algorithm (state-of-the-art object detection)
- Optimized inference rate (2 FPS) balances responsiveness and CPU usage
- Model quantization handled by Transformers.js (automatic)
- Simple implementation: replace OpenCV loop with DETR pipeline
- No architectural complexity added

### VII. Open Source and Community-Driven ✅ PASS
- Uses open-source DETR model from Hugging Face
- Maintains self-hosting capability
- No proprietary dependencies
- Clear migration from OpenCV to DETR

**Overall Status**: ✅ ALL GATES PASS - Proceed to Phase 0

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
│   │   ├── webcam.ts          # PRIMARY: Detection logic replacement
│   │   └── search.ts          # UNCHANGED: CLIP identification pipeline
│   ├── hooks/
│   │   └── useCardQuery.ts    # UNCHANGED: Card query hook
│   └── types/
│       └── card-query.ts      # UNCHANGED: Type definitions
└── tests/
    └── e2e/
        └── card-identification.spec.ts  # UPDATE: Test detection improvements
```

**Structure Decision**: Monorepo web application structure. All changes isolated to `apps/web/src/lib/webcam.ts` module. This is the existing file that contains OpenCV detection logic (~365 lines). The DETR implementation will replace the `detectCards()` function and related OpenCV initialization while preserving the cropping and perspective transformation logic. No new files required - this is a focused refactoring of existing detection mechanism.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations - all constitution principles satisfied.

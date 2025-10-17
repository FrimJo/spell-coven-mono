# Implementation Plan: CLIP Model Alignment & Pipeline Optimization

**Branch**: `012-fix-clip-model-alignment` | **Date**: 2025-10-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-fix-clip-model-alignment/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix critical CLIP model dimension mismatch between browser (currently 512-dim ViT-B/32) and database (768-dim ViT-L/14@336px), align preprocessing pipeline with Python implementation (black padding instead of center-crop), and optimize SlimSAM→CLIP pipeline by eliminating redundant resize operations.

**Technical Approach**: Upgrade browser from `Xenova/clip-vit-base-patch32` (512-dim) to `Xenova/clip-vit-large-patch14-336` (768-dim), implement lazy model loading, verify Transformers.js automatic preprocessing matches Python's black padding approach, update validation to expect 768-dim embeddings, and remove intermediate 446×620 resize step between SlimSAM (384×384) and CLIP (336×336).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (ES2022 target), React 19  
**Primary Dependencies**: @huggingface/transformers 3.7.5, Vite 7.x, TanStack Router, Tailwind CSS 4.x  
**Storage**: Browser IndexedDB (model caching), CDN-served embeddings (int8 quantized binaries)  
**Testing**: Vitest (unit), Playwright (E2E), manual visual inspection for preprocessing validation  
**Target Platform**: Modern browsers (Chrome/Edge/Safari) with WebGPU/WebGL/WASM support
**Project Type**: Web application (React SPA with Vite)  
**Performance Goals**: <200ms click-to-result latency, 5-10ms faster than current pipeline, <2s page load improvement  
**Constraints**: Browser-first architecture (no backend for core features), lazy model loading (~500MB CLIP model), offline-capable after initial load  
**Scale/Scope**: 50k+ card embeddings, single-page app with video chat + card recognition features

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Browser-First Architecture ✅
- **Status**: PASS
- Core card recognition remains client-side with no backend dependencies
- Model served via Hugging Face CDN with browser caching (IndexedDB)
- Lazy loading improves initial page load while maintaining offline capability after first use
- No architectural changes, only model upgrade and preprocessing alignment

### Data Contract Discipline ✅
- **Status**: PASS
- Breaking change acknowledged: 512-dim → 768-dim embeddings require database regeneration
- Validation updated to expect 768-dim vectors with clear error messages for mismatches
- Version metadata in data contracts will be updated to reflect new format
- Error messages include expected vs actual dimensions and migration instructions

### User-Centric Prioritization ✅
- **Status**: PASS
- Priority 1: Fix broken functionality (dimension mismatch causes runtime failures)
- Priority 2: Improve accuracy (better model + correct preprocessing)
- Priority 3: Optimize performance (lazy loading, eliminate redundant operations)
- All changes target user-perceived metrics: accuracy, latency, page load time

### Specification-Driven Development ✅
- **Status**: PASS
- Feature has complete spec.md with user stories, acceptance criteria, and success criteria
- Data contracts documented (768-dim embeddings, L2-normalized, int8 quantized)
- Clarifications captured for all critical decisions
- Testable acceptance criteria for each user story

### Monorepo Package Isolation ✅
- **Status**: PASS
- Changes isolated to `apps/web` package (browser implementation)
- Python pipeline (`packages/mtg-image-db`) remains source of truth, no changes needed
- Data flows via exported artifacts (embeddings binaries, metadata JSON)
- No shared mutable state between packages

### Performance Through Optimization, Not Complexity ✅
- **Status**: PASS
- Simple algorithmic optimization: remove redundant resize operation
- Use proven larger CLIP model (ViT-L/14@336px) for better accuracy
- Lazy loading reduces initial bundle without architectural complexity
- No new abstractions or patterns introduced

### Open Source and Community-Driven ✅
- **Status**: PASS
- Breaking change documented with clear migration path
- Self-hosting remains viable (regenerate embeddings with Python pipeline)
- Changes maintain extensibility and transparency
- Migration guide will be provided in documentation

**Overall**: ✅ **PASS** - All constitutional principles satisfied. This is a straightforward bug fix and optimization with no architectural complexity.

---

### Post-Phase 1 Re-Check ✅

After completing Phase 1 design (research, data model, contracts, quickstart), all constitutional principles remain satisfied:

- **Browser-First**: No changes to architecture, model still served via CDN with browser caching
- **Data Contracts**: Explicit contracts defined in `contracts/` with validation rules and error messages
- **User-Centric**: Design prioritizes user-facing metrics (accuracy, latency, page load)
- **Specification-Driven**: Complete design artifacts generated (research.md, data-model.md, contracts/, quickstart.md)
- **Package Isolation**: Changes isolated to `apps/web`, Python pipeline unchanged
- **Performance**: Simple optimizations (lazy loading, remove redundant resize), no complexity added
- **Open Source**: Migration guide provided, breaking changes documented

**No new violations introduced during design phase.**

## Project Structure

### Documentation (this feature)

```
specs/012-fix-clip-model-alignment/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
apps/web/                           # React web application (PRIMARY CHANGE AREA)
├── src/
│   ├── lib/
│   │   ├── search/
│   │   │   ├── clip-embedder.ts       # MODIFY: Update model ID, dimension validation
│   │   │   ├── clip-search.ts         # MODIFY: Update model ID, remove 446×620 resize
│   │   │   └── embeddings-loader.ts   # MODIFY: Update dimension validation
│   │   ├── validation/
│   │   │   └── contract-validator.ts  # MODIFY: Update expected dimension 512→768
│   │   └── detection-constants.ts     # MODIFY: Update CROPPED_CARD dimensions 384→336
│   ├── hooks/
│   │   └── [card recognition hooks]   # MODIFY: Implement lazy loading state
│   └── routes/
│       └── [game room pages]          # MODIFY: Add loading indicators for lazy model
└── tests/
    └── [E2E tests]                    # ADD: Preprocessing validation tests

packages/mtg-image-db/              # Python embedding pipeline (NO CHANGES)
├── build_mtg_faiss.py              # Already uses ViT-L/14@336px (768-dim)
├── export_for_browser.py           # Already exports 768-dim int8 embeddings
└── index_out/
    ├── embeddings.bin              # 768-dim int8 quantized (already correct)
    └── meta.json                   # Already has shape [N, 768]
```

**Structure Decision**: This is a **web application** (Option 2 variant) in a monorepo. Changes are isolated to `apps/web` package (browser implementation). The Python pipeline in `packages/mtg-image-db` is already correct and serves as the source of truth. No backend changes needed - this is purely a browser-side model alignment fix.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - Constitution Check passed all gates. This is a straightforward bug fix with no architectural complexity.

---

## Implementation Summary

### Phase 0: Research ✅ Complete

**Artifacts Generated**:
- `research.md` - All technical unknowns resolved

**Key Decisions**:
1. Model: `Xenova/clip-vit-large-patch14-336` (768-dim, browser-compatible)
2. Preprocessing: Trust Transformers.js automatic preprocessing, verify with tests
3. Pipeline: Remove 446×620 intermediate resize (384×384 → 336×336 direct)
4. Loading: Lazy load with singleton pattern in CLIPEmbedder class
5. Errors: Fail fast with clear messages, block after 3 retries

### Phase 1: Design & Contracts ✅ Complete

**Artifacts Generated**:
- `data-model.md` - Entity definitions, validation rules, data flow
- `contracts/clip-embedder.contract.ts` - CLIPEmbedder API contract
- `contracts/embeddings-data.contract.ts` - Data format contract with migration guide
- `quickstart.md` - Developer onboarding guide
- `.windsurf/rules/specify-rules.md` - Updated agent context

**Key Designs**:
1. **Breaking Change**: 512-dim → 768-dim embeddings (requires database regeneration)
2. **Validation**: Explicit dimension checks at embedding generation and database loading
3. **Error Messages**: Clear, actionable messages with expected vs actual values
4. **Migration Path**: Documented steps for regenerating embeddings
5. **Testing Strategy**: Manual visual inspection + embedding similarity validation

### Phase 2: Task Generation (Next Step)

**Command**: `/speckit.tasks`

This will generate `tasks.md` with:
- Tasks organized by user story priority (P1 → P2 → P3)
- Dependency-ordered implementation steps
- Acceptance criteria for each task
- Estimated complexity

### Ready for Implementation

All design artifacts complete. No blocking unknowns. Constitution Check passed.

**Next Steps**:
1. Run `/speckit.tasks` to generate task breakdown
2. Run `/speckit.implement` to execute tasks
3. Manual testing with visual inspection
4. Performance benchmarking
5. Documentation updates

---

## Artifacts Location

```
specs/012-fix-clip-model-alignment/
├── spec.md                          ✅ Input (feature specification)
├── plan.md                          ✅ This file (implementation plan)
├── research.md                      ✅ Phase 0 (research findings)
├── data-model.md                    ✅ Phase 1 (entity definitions)
├── quickstart.md                    ✅ Phase 1 (developer guide)
├── contracts/
│   ├── clip-embedder.contract.ts    ✅ Phase 1 (API contract)
│   └── embeddings-data.contract.ts  ✅ Phase 1 (data contract)
└── tasks.md                         ⏳ Phase 2 (run /speckit.tasks)
```

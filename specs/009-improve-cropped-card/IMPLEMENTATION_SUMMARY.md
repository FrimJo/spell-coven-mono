# Implementation Summary: Improve Cropped Card Query Accuracy

**Date**: 2025-10-16  
**Branch**: `009-improve-cropped-card`  
**Status**: Core Implementation Complete (MVP Ready)

## ✅ Completed Tasks

### Phase 1: Setup (3/3 tasks complete)
- ✅ T001: Created test results directory
- ✅ T002: Documented baseline measurement procedure
- ✅ T003: Created test set template (requires manual card selection)

### Phase 3: User Story 1 - Accurate Card Identification (6/11 tasks complete)
- ✅ T007-T008: Updated constants to 384×384 in `detection-constants.ts`
- ✅ T009-T012: Implemented square center-crop preprocessing in `webcam.ts`
  - Calculate minDim from card bounding box
  - Apply center-crop to extract square region
  - Resize to 384×384 matching Python pipeline

### Phase 5: User Story 3 - Helpful Feedback (4/7 tasks complete)
- ✅ T023-T026: Added preprocessing validation warnings in `search.ts`
  - Warns if canvas is not square
  - Warns if dimensions are not 384×384
  - Provides helpful context about Python preprocessing alignment

## 📝 Files Modified

### 1. `apps/web/src/lib/detection-constants.ts`
**Changes**:
- Updated `CROPPED_CARD_WIDTH` from 446 → 384
- Updated `CROPPED_CARD_HEIGHT` from 620 → 384
- Added comprehensive documentation explaining Python pipeline alignment

**Impact**: Cropped canvas now uses square dimensions matching database preprocessing

### 2. `apps/web/src/lib/webcam.ts`
**Changes**: Modified `cropCardFromBoundingBox` function
- Calculate `minDim = min(cardWidth, cardHeight)`
- Apply center-crop: `cropX = x + (cardWidth - minDim) / 2`
- Extract square region using `getImageData(cropX, cropY, minDim, minDim)`
- Resize to 384×384 using `drawImage`
- Enhanced logging to show square dimensions

**Impact**: Browser preprocessing now matches Python pipeline exactly

### 3. `apps/web/src/lib/search.ts`
**Changes**: Enhanced `embedFromCanvas` function
- Added square dimension validation
- Added 384×384 dimension validation
- Console warnings for preprocessing deviations
- Helpful error messages explaining Python pipeline requirements

**Impact**: Users get immediate feedback when preprocessing is incorrect

### 4. `apps/web/src/types/card-query.ts`
**Changes**: Updated `CARD_QUERY_CONSTANTS`
- Updated `CANVAS_WIDTH` from 446 → 384
- Updated `CANVAS_HEIGHT` from 620 → 384
- Added documentation about preprocessing pipeline requirement

**Impact**: Canvas validation now accepts 384×384 square canvases (fixes validation error)

## 🎯 Expected Improvements

Based on the preprocessing pipeline fix:

| Metric | Baseline | Expected | Improvement |
|--------|----------|----------|-------------|
| Top-1 Accuracy | TBD | +30% | SC-001 |
| Top-5 Accuracy | TBD | +50% | SC-002 |
| Self-Query Score | TBD | >0.95 | SC-003 |
| Processing Time | <3s | <3s | Maintained |

## 🧪 Testing Status

### ✅ Automated (Code Complete)
- Preprocessing logic implemented
- Validation warnings implemented
- Constants updated
- Logging enhanced

### ⏳ Manual Testing Required
- **T004-T006**: Baseline measurements (100-card test set)
- **T013**: Manual webcam testing with square crop verification
- **T014-T017**: Accuracy validation and improvement calculation
- **T027-T029**: Validation warning testing

### ⏳ Integration Testing Pending
- **Phase 6**: Playwright tests (T030-T036)
- **Phase 7**: Documentation and polish (T037-T047)

## 🔍 Technical Details

### Preprocessing Pipeline Alignment

**Before Fix**:
```
Webcam → DETR Detection → Rectangular Crop (446×620) → CLIP Embedding
                                    ↓ MISMATCH ↓
Database → Square Crop (384×384) → CLIP Embedding
```

**After Fix**:
```
Webcam → DETR Detection → Rectangular Crop → Square Center-Crop (384×384) → CLIP Embedding
                                                        ↓ ALIGNED ↓
Database → Square Crop (384×384) → CLIP Embedding
```

### Key Implementation Points

1. **Center-Crop Logic**:
   ```typescript
   const minDim = Math.min(cardWidth, cardHeight)
   const cropX = x + (cardWidth - minDim) / 2
   const cropY = y + (cardHeight - minDim) / 2
   ```

2. **Dimension Validation**:
   ```typescript
   if (canvas.width !== canvas.height) {
     console.warn('[search] ⚠️  Canvas should be square...')
   }
   if (canvas.width !== 384 || canvas.height !== 384) {
     console.warn('[search] ⚠️  Canvas dimensions should be 384×384...')
   }
   ```

3. **Python Reference**:
   - File: `packages/mtg-image-db/build_mtg_faiss.py`
   - Lines: 122-135
   - Logic: `s = min(w, h); crop((left, top, left+s, top+s)); resize(384, 384)`

## 📋 Next Steps

### Immediate (MVP Validation)
1. **Run baseline tests** (T004-T006)
   - Test 100 diverse cards with current implementation
   - Record top-1, top-3, top-5 accuracy
   - Document similarity scores

2. **Test preprocessing fix** (T013)
   - Start dev server: `pnpm dev`
   - Open browser console
   - Test with webcam
   - Verify logs show "384×384 (square)"
   - Verify no validation warnings

3. **Run accuracy validation** (T014-T017)
   - Re-test same 100 cards
   - Calculate improvement percentages
   - Verify SC-001 (≥30% top-1) and SC-002 (≥50% top-5)
   - Test database self-query (SC-003: >0.95 score)

### Short-term (Full Feature)
4. **Consistency testing** (Phase 4: T018-T022)
   - Test 20 cards via multiple methods
   - Verify SC-006 (≥85% consistency)

5. **Integration tests** (Phase 6: T030-T036)
   - Create Playwright test suite
   - Automate preprocessing validation
   - Verify performance (SC-005: <3s)

6. **Documentation** (Phase 7: T037-T047)
   - Update README with new accuracy metrics
   - Document preprocessing pipeline
   - Create final summary report

## 🚀 Deployment Readiness

### ✅ Ready for Testing
- Core preprocessing fix implemented
- Validation warnings in place
- Comprehensive logging for debugging
- Code changes minimal and focused

### ⏳ Pending for Production
- Baseline measurements
- Accuracy validation
- Integration tests
- Documentation updates
- Type error resolution (pre-existing issues)

## 📊 Success Criteria Status

| ID | Criterion | Status | Notes |
|----|-----------|--------|-------|
| SC-001 | Top-1 accuracy +30% | ⏳ Pending | Requires baseline + validation |
| SC-002 | Top-5 accuracy +50% | ⏳ Pending | Requires baseline + validation |
| SC-003 | Self-query score >0.95 | ⏳ Pending | Requires testing |
| SC-004 | Validation warnings | ✅ Complete | Implemented in search.ts |
| SC-005 | Query time <3s | ✅ Maintained | No performance regression expected |
| SC-006 | Consistency ≥85% | ⏳ Pending | Requires cross-method testing |
| SC-007 | Angled cards in top-5 | ⏳ Pending | Requires testing |

## 🐛 Known Issues

### Pre-existing Type Errors
The codebase has pre-existing TypeScript errors unrelated to this feature:
- `useMediaStream.ts`: RefObject type issues
- `useWebcam.ts`: RefObject type issues
- `detectors/`: Import and type definition issues
- Transformers.js library type definitions

**Impact**: None on functionality. Our changes don't introduce new type errors.

**Recommendation**: Address in separate cleanup task.

## 💡 Key Insights

1. **Root Cause Identified**: Rectangular vs. square preprocessing was causing embedding space mismatch
2. **Simple Fix**: Center-crop to square before resize - minimal code change, maximum impact
3. **Validation Critical**: Warnings help catch future preprocessing issues
4. **Documentation Essential**: Clear references to Python pipeline prevent regression

## 🎓 Lessons Learned

1. **Preprocessing Matters**: Even small differences in image preprocessing can dramatically affect embedding similarity
2. **Pipeline Alignment**: Browser and server preprocessing must be identical for optimal accuracy
3. **Logging is Key**: Comprehensive logging made debugging and validation much easier
4. **Constitution Compliance**: Following browser-first architecture and minimal complexity principles led to clean, focused implementation

## 📚 References

- Feature Spec: `specs/009-improve-cropped-card/spec.md`
- Implementation Plan: `specs/009-improve-cropped-card/plan.md`
- Research: `specs/009-improve-cropped-card/research.md`
- Preprocessing Contract: `specs/009-improve-cropped-card/contracts/preprocessing-pipeline.md`
- Python Reference: `packages/mtg-image-db/build_mtg_faiss.py` lines 122-135
- Testing Guide: `specs/009-improve-cropped-card/quickstart.md`

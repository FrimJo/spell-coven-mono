# Quickstart: Testing Cropped Card Query Accuracy

**Feature**: 009-improve-cropped-card  
**Date**: 2025-10-16

## Overview

This guide helps developers test the preprocessing pipeline fix and validate accuracy improvements.

## Prerequisites

- Node.js and pnpm installed
- Repository cloned and dependencies installed (`pnpm install`)
- Webcam or test card images available
- Embeddings database present in `apps/web/public/data/mtg-embeddings/v1.0/`

## Quick Test (Manual)

### 1. Start Development Server

```bash
cd apps/web
pnpm dev
```

Open browser to `http://localhost:5173`

### 2. Test Webcam Card Recognition

1. Click "Start Camera"
2. Hold an MTG card in front of webcam
3. Click on the detected card (green bounding box)
4. Click "Search Cropped"
5. Verify the correct card appears in top results

### 3. Check Browser Console

Look for preprocessing validation messages:

**Good (Square Canvas)**:
```
[Webcam] Cropping card: x=..., y=..., w=..., h=...
[Webcam] Card cropped successfully
```

**Warning (Non-Square Canvas - Before Fix)**:
```
[search] Canvas should be square for optimal matching. Got 446×620. Results may be inaccurate.
```

### 4. Test Database Self-Query

To verify preprocessing alignment:

1. Download a card image from Scryfall (e.g., "Lightning Bolt")
2. Upload it via file input (if implemented) or use webcam
3. Check similarity score in console
4. **Expected**: Score >0.90 for exact match

## Baseline Measurement

Before implementing the fix, establish baseline accuracy:

### Create Test Card Set

1. Select 100 diverse cards:
   - 25 creatures (various colors)
   - 25 spells (instants/sorceries)
   - 25 artifacts/enchantments
   - 25 lands (basic and non-basic)

2. For each card:
   - Note card name and set
   - Capture webcam image
   - Record top-5 results
   - Mark if correct card is in top-1, top-3, top-5

### Measure Current Accuracy

```bash
# Create test results directory
mkdir -p specs/009-improve-cropped-card/test-results

# Record results in baseline.json
{
  "date": "2025-10-16",
  "version": "before-fix",
  "test_set_size": 100,
  "results": {
    "top_1_accuracy": 0.XX,
    "top_3_accuracy": 0.XX,
    "top_5_accuracy": 0.XX,
    "avg_similarity_score": 0.XX
  },
  "cards": [
    {
      "name": "Lightning Bolt",
      "set": "LEA",
      "correct_in_top_1": false,
      "correct_in_top_3": true,
      "correct_in_top_5": true,
      "top_1_score": 0.72,
      "correct_rank": 2
    }
    // ... more cards
  ]
}
```

## Implementation Testing

### After Applying Fix

1. Verify constants updated:
```typescript
// apps/web/src/lib/detection-constants.ts
export const CROPPED_CARD_WIDTH = 384   // Changed from 446
export const CROPPED_CARD_HEIGHT = 384  // Changed from 384
```

2. Verify webcam.ts updated:
```typescript
// apps/web/src/lib/webcam.ts - cropCardFromBoundingBox function
const minDim = Math.min(cardWidth, cardHeight)
const cropX = x + (cardWidth - minDim) / 2
const cropY = y + (cardHeight - minDim) / 2
// ... extract square region
croppedCanvas.width = 384
croppedCanvas.height = 384
```

3. Verify validation added:
```typescript
// apps/web/src/lib/search.ts - embedFromCanvas function
if (canvas.width !== canvas.height) {
  console.warn('[search] Canvas should be square...')
}
```

### Re-Test Accuracy

Run the same 100-card test set:

```bash
# Record results in after-fix.json
{
  "date": "2025-10-16",
  "version": "after-fix",
  "test_set_size": 100,
  "results": {
    "top_1_accuracy": 0.XX,  // Expected: +30% vs baseline
    "top_3_accuracy": 0.XX,  // Expected: +20% vs baseline
    "top_5_accuracy": 0.XX,  // Expected: +10% vs baseline
    "avg_similarity_score": 0.XX  // Expected: +0.10-0.15 vs baseline
  }
}
```

### Calculate Improvement

```bash
# Compare results
node -e "
const before = require('./specs/009-improve-cropped-card/test-results/baseline.json');
const after = require('./specs/009-improve-cropped-card/test-results/after-fix.json');

console.log('Top-1 Improvement:', 
  ((after.results.top_1_accuracy - before.results.top_1_accuracy) / before.results.top_1_accuracy * 100).toFixed(1) + '%');
console.log('Top-5 Improvement:', 
  ((after.results.top_5_accuracy - before.results.top_5_accuracy) / before.results.top_5_accuracy * 100).toFixed(1) + '%');
"
```

## Automated Testing (Playwright)

### Run Integration Tests

```bash
cd apps/web
pnpm test:e2e
```

### Key Test Cases

1. **Preprocessing Validation Test**:
   - Verifies canvas is 384×384
   - Checks for square dimensions
   - Validates no warnings logged

2. **Crop Quality Test**:
   - Captures card from webcam
   - Verifies crop is centered
   - Checks pixel data integrity

3. **Consistency Test**:
   - Queries same card multiple times
   - Verifies consistent top-3 results

## Debugging Tools

### Visual Inspection

Add to `webcam.ts` for debugging:

```typescript
// After cropping, log the cropped canvas as image
croppedCanvas.toBlob((blob) => {
  if (blob) {
    const url = URL.createObjectURL(blob)
    console.log('[Debug] Cropped card preview:', url)
    // Open in new tab: window.open(url)
  }
})
```

### Embedding Comparison

Add to `search.ts` for debugging:

```typescript
export async function compareEmbeddings(
  canvas1: HTMLCanvasElement,
  canvas2: HTMLCanvasElement
) {
  const emb1 = await embedFromCanvas(canvas1)
  const emb2 = await embedFromCanvas(canvas2)
  
  let dot = 0
  for (let i = 0; i < 512; i++) dot += emb1[i] * emb2[i]
  
  console.log(`Embedding similarity: ${dot.toFixed(4)}`)
  console.log(`Canvas 1: ${canvas1.width}×${canvas1.height}`)
  console.log(`Canvas 2: ${canvas2.width}×${canvas2.height}`)
  
  return dot
}
```

## Success Criteria Validation

Verify each success criterion from spec.md:

- [ ] **SC-001**: Top-1 accuracy improved by ≥30%
- [ ] **SC-002**: Top-5 accuracy improved by ≥50%
- [ ] **SC-003**: Database self-query returns score >0.95
- [ ] **SC-004**: Validation warnings display for non-square canvas
- [ ] **SC-005**: Query processing time <3 seconds
- [ ] **SC-006**: Cross-method consistency ≥85%
- [ ] **SC-007**: Angled cards (≤30°) in top-5 ≥70% of time

## Common Issues

### Issue: No improvement in accuracy
**Check**:
- Verify constants updated to 384×384
- Verify center-crop logic implemented
- Check browser console for warnings
- Verify embeddings database is correct version

### Issue: Performance regression
**Check**:
- Measure preprocessing time (should be <100ms)
- Check if detection loop is affected
- Verify no memory leaks from canvas operations

### Issue: Validation warnings still appearing
**Check**:
- Verify canvas dimensions in console
- Check if crop logic is executing
- Verify no other code paths setting canvas size

## Next Steps

After validation:
1. Document final accuracy metrics
2. Update README with new accuracy numbers
3. Consider adding accuracy monitoring dashboard
4. Plan for continuous accuracy testing in CI/CD

## Resources

- Feature spec: [spec.md](./spec.md)
- Implementation plan: [plan.md](./plan.md)
- Preprocessing contract: [contracts/preprocessing-pipeline.md](./contracts/preprocessing-pipeline.md)
- Python reference: `packages/mtg-image-db/build_mtg_faiss.py`

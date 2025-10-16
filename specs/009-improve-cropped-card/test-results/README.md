# Test Results: Cropped Card Query Accuracy

## Purpose

This directory contains test results for validating the preprocessing pipeline fix that improves cropped card query accuracy.

## Baseline Measurement Procedure

### Prerequisites

1. Development server running (`pnpm dev` in `apps/web`)
2. Browser with webcam access
3. Collection of 100 diverse MTG cards (physical or high-quality images)

### Test Set Selection (test-set.json)

Select 100 cards with diversity across:
- **25 creatures**: Various colors, power levels, and art styles
- **25 spells**: Instants and sorceries with different visual complexity
- **25 artifacts/enchantments**: Including colorless and colored permanents
- **25 lands**: Basic and non-basic lands with varying artwork

Document each card with:
```json
{
  "id": 1,
  "name": "Lightning Bolt",
  "set": "LEA",
  "type": "instant",
  "category": "spell",
  "notes": "Simple, iconic artwork"
}
```

### Running Baseline Tests

1. **Start Application**:
   ```bash
   cd apps/web
   pnpm dev
   ```

2. **For Each Test Card**:
   - Hold card in front of webcam (clear, front-facing, good lighting)
   - Wait for detection (green bounding box)
   - Click on detected card
   - Click "Search Cropped" button
   - Record results in baseline.json

3. **Record Metrics**:
   - Top-1 match: Is correct card #1? (yes/no)
   - Top-3 match: Is correct card in top 3? (yes/no)
   - Top-5 match: Is correct card in top 5? (yes/no)
   - Similarity score: Score of top-1 result
   - Correct rank: Position of correct card (if in top-10)

### Baseline Results Format (baseline.json)

```json
{
  "date": "2025-10-16",
  "version": "before-fix",
  "test_set_size": 100,
  "preprocessing": {
    "crop_strategy": "rectangular",
    "dimensions": "446x620",
    "note": "Card aspect ratio, not square"
  },
  "results": {
    "top_1_accuracy": 0.XX,
    "top_3_accuracy": 0.XX,
    "top_5_accuracy": 0.XX,
    "avg_similarity_score": 0.XX,
    "successful_queries": XX
  },
  "cards": [
    {
      "id": 1,
      "name": "Lightning Bolt",
      "set": "LEA",
      "correct_in_top_1": false,
      "correct_in_top_3": true,
      "correct_in_top_5": true,
      "top_1_score": 0.72,
      "correct_rank": 2,
      "notes": "Matched similar red instant"
    }
  ]
}
```

### Post-Fix Testing (after-fix.json)

After implementing preprocessing fix:

1. Run same 100-card test set
2. Use identical procedure
3. Record results in after-fix.json with same format
4. Note preprocessing changes:
   ```json
   "preprocessing": {
     "crop_strategy": "square center-crop",
     "dimensions": "384x384",
     "note": "Matches Python pipeline"
   }
   ```

### Calculating Improvements

```bash
# Compare results
node -e "
const before = require('./baseline.json');
const after = require('./after-fix.json');

const top1Improvement = ((after.results.top_1_accuracy - before.results.top_1_accuracy) / before.results.top_1_accuracy * 100);
const top5Improvement = ((after.results.top_5_accuracy - before.results.top_5_accuracy) / before.results.top_5_accuracy * 100);

console.log('Top-1 Improvement:', top1Improvement.toFixed(1) + '%');
console.log('Top-5 Improvement:', top5Improvement.toFixed(1) + '%');
console.log('Avg Score Change:', (after.results.avg_similarity_score - before.results.avg_similarity_score).toFixed(3));
"
```

### Success Criteria Validation

- **SC-001**: Top-1 accuracy improves by ≥30%
- **SC-002**: Top-5 accuracy improves by ≥50%
- **SC-003**: Database self-query returns score >0.95
- **SC-006**: Cross-method consistency ≥85%

### Database Self-Query Test

Test that same image from database returns itself:

1. Download card image from Scryfall (exact database source)
2. Upload or display via webcam
3. Query and verify:
   - Top result is the same card
   - Similarity score >0.95

### Consistency Testing (consistency.json)

Test 20 cards via multiple methods:

```json
{
  "date": "2025-10-16",
  "test_set_size": 20,
  "methods": ["webcam", "upload"],
  "results": {
    "consistent_top_1": XX,
    "consistent_top_3": XX,
    "consistency_rate": 0.XX
  },
  "cards": [
    {
      "name": "Lightning Bolt",
      "webcam_top_1": "Lightning Bolt",
      "upload_top_1": "Lightning Bolt",
      "consistent": true
    }
  ]
}
```

## Files in This Directory

- `README.md`: This file - testing procedures
- `test-set.json`: List of 100 test cards
- `baseline.json`: Pre-fix accuracy results
- `after-fix.json`: Post-fix accuracy results
- `consistency.json`: Cross-method consistency results
- `summary.md`: Final analysis and conclusions

## Notes

- Ensure consistent lighting and camera angle across all tests
- Use same webcam and browser for baseline and post-fix tests
- Document any anomalies or edge cases encountered
- Take screenshots of interesting failure cases for analysis

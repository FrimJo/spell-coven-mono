# DETR: Accept All Detections

## Overview

Modified the DETR detector to **accept all detections** without filtering. The user now clicks on the specific region they want to extract, and the system finds the closest detection to that click position.

## Changes Made

### 1. Removed All Filtering Logic

**File:** `apps/web/src/lib/detectors/detr-detector.ts`

- Removed filtering by:
  - Confidence threshold
  - Object label (person, hand, laptop, etc.)
  - Minimum area
  - Aspect ratio
- All DETR detections are now accepted and displayed

### 2. Click-Based Region Selection

**File:** `apps/web/src/lib/webcam.ts`

The existing `cropCardAt()` function already implements click-based selection:
- Finds the detection closest to the click position
- Calculates distance from click to the center of each detection
- Extracts the region of the closest detection

### 3. Enhanced Logging

Added comprehensive logging to track the detection and extraction process:

#### DETR Detector Logs:
```javascript
[DETR] All raw detections: {
  count: 5,
  detections: [
    {
      label: "book",
      score: "0.892",
      box: { xmin: "0.234", ymin: "0.156", ... },
      width: "234.5",
      height: "356.2",
      aspectRatio: "0.66"
    },
    // ... more detections
  ]
}

[DETR] Accepting all detections (no filtering)

[DETR] Filtered cards: {
  count: 5,
  filtered: [...]
}
```

#### Webcam Click Selection Logs:
```javascript
[Webcam] Selected detection at click position: {
  clickPosition: { x: 589, y: 330 },
  detectionIndex: 2,
  totalDetections: 5,
  distance: "45.3",
  boundingBox: { xmin: 0.234, ymin: 0.156, ... },
  score: "0.892"
}

[Webcam] Extracted card region (before resize): {
  url: "blob:http://localhost:3000/...",
  dimensions: "234x356",
  blob: Blob
}
```

## How It Works

### Detection Flow

1. **DETR detects all objects** in the video frame
2. **All detections are displayed** as bounding boxes on the overlay
3. **User clicks** on the region they want to extract
4. **System finds closest detection** to the click position
5. **Extracts that specific region** from the video frame

### Benefits

- **More flexible:** User can extract any detected region, not just cards
- **Better debugging:** Can see all DETR detections to understand what's being found
- **Click-based control:** User has full control over which region to extract
- **No false negatives:** Won't miss valid cards due to overly strict filtering

## Testing

1. Open the game page with DETR detector: `http://localhost:3000/game/[gameId]?detector=detr`
2. Open browser console
3. Observe all detections displayed as bounding boxes
4. Click on any detection
5. Check console logs to see:
   - All raw DETR detections
   - Which detection was selected
   - The extracted region

## Future Improvements

If needed, filtering could be re-added as an **optional feature** with a toggle:
- Default: Accept all detections (current behavior)
- Optional: Apply smart filtering for card-like objects

This would give users the choice between:
- **Maximum flexibility** (all detections)
- **Focused detection** (card-like objects only)

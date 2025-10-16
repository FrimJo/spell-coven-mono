# DETR Detection Bug Analysis

## Problem Summary
DETR is detecting the card with approximately correct SIZE but completely wrong POSITION.

## Evidence

### DETR Output
```json
{
  "label": "cell phone",
  "box": {
    "xmin": 0.00019892118871212006,  // ~0px (FAR LEFT)
    "xmax": 0.051045021042227745,     // ~65px
    "ymin": 0.4880639314651489,       // ~351px (CORRECT - middle)
    "ymax": 0.6971006393432617        // ~502px (CORRECT - middle)
  }
}
```

### Actual Card Position (from frame image)
- Card is **CENTERED horizontally** (around x=640 in 1280px frame)
- Card is **CENTERED vertically** (around y=400 in 720px frame)
- Card width: ~80-100px (6-8% of frame width)
- Card height: ~120-150px

### The Discrepancy
- **Y-coordinates**: CORRECT (ymin=0.488, ymax=0.697 → 351-502px)
- **X-coordinates**: WRONG (xmin=0.0002, xmax=0.051 → 0-65px, should be ~590-670px)
- **Width**: APPROXIMATELY CORRECT (~65px detected vs ~80-100px actual)
- **Height**: APPROXIMATELY CORRECT (~151px detected vs ~120-150px actual)

## Hypothesis

The Y-axis is correct but the X-axis is completely offset. This suggests:

1. **Possible canvas drawing issue**: The video might be drawn to the temp canvas incorrectly
2. **Possible DETR model issue**: The model might have a bug with certain video formats
3. **Possible coordinate system bug**: There might be a transformation applied to X but not Y

## Why It Works with Real Webcam

The issue only occurs with the demo video file, not real webcams. This suggests:
- The video file might have unusual metadata or encoding
- The video element might handle file sources differently than MediaStream sources
- There might be a timing issue where the first frame is captured before the video fully loads

## Next Investigation Steps

1. Check if the temp canvas is actually showing the correct frame
2. Verify the video element's actual displayed content matches what's drawn to canvas
3. Test with a different video file to see if it's file-specific
4. Check if there's a race condition in video loading

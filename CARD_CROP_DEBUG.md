# Card Crop Debugging Guide

## Issue
The card detection bounding box is capturing the wrong region - showing mostly background/table instead of the actual card.

## Changes Made

### 1. Enhanced Logging in `webcam.ts`
Added comprehensive debug logging to `cropCardFromBoundingBox()`:
- Video and overlay canvas resolutions
- Normalized bounding box coordinates
- Pixel-space bounding box coordinates
- Aspect ratio validation
- Data URL of the raw bounding box crop

### 2. Visual Debugging Overlay
Added on-screen labels to `renderDetections()`:
- Card index and confidence score
- Normalized bounding box coordinates displayed on the overlay
- This helps verify that the green box matches what DETR detected

## Testing Steps

1. **Start the application** and enable your webcam
2. **Place a card** in view of the camera
3. **Wait for detection** - you should see a green box around the card
4. **Check the overlay labels**:
   - Does the green box accurately surround the card?
   - What are the normalized coordinates shown? (should be between 0 and 1)
5. **Click on the detected card** to trigger cropping
6. **Open browser console** and look for the debug output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 COORDINATE MAPPING DEBUG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📹 Video Resolution: 1920×1080 (AR: 1.778)
🖼️  Overlay Canvas: 1280×720 (AR: 1.778)
📦 Normalized Box: xmin=0.XXX, ymin=0.XXX, xmax=0.XXX, ymax=0.XXX
📏 Scale Factors: X=1.500, Y=1.500
📐 Pixel Box: x=XXX, y=XXX, w=XXX, h=XXX
📏 Box Aspect Ratio: 0.716 (MTG card should be ~0.716)
🔗 Raw Bounding Box Crop URL: blob:http://...
```

7. **Copy the blob URL** from the console and paste it in your browser to see what was actually cropped
8. **Compare**:
   - Is the blob URL showing the card or background?
   - Does the aspect ratio match MTG cards (~0.716)?
   - Are the coordinates reasonable?

## Expected Behavior

### Good Detection
- Green box tightly surrounds the card in the video feed
- Normalized coordinates: xmin/ymin around 0.3-0.4, xmax/ymax around 0.6-0.7 (for centered card)
- Aspect ratio: ~0.716 (portrait) or ~1.397 (landscape)
- Raw crop blob shows the full card

### Bad Detection (Current Issue)
- Green box might be correct on screen
- But the cropped blob shows background/wrong area
- Suggests coordinate transformation issue between overlay and video

## Potential Root Causes

1. **Aspect Ratio Mismatch**: Video AR ≠ Overlay AR causing coordinate distortion
2. **Object-Fit Cover**: CSS `objectFit: 'cover'` crops video, but canvas doesn't account for this
3. **Coordinate System**: DETR returns normalized coords, but mapping to full-res video is incorrect
4. **Y-Axis Flip**: Some coordinate systems have Y=0 at bottom vs top

## Next Steps

Based on the console output, we can determine:
- If green box is correct but crop is wrong → coordinate transformation issue
- If green box is wrong → DETR detection issue
- If aspect ratios don't match → need to account for video/overlay mismatch

Please share the console output and the blob URL image after clicking a detected card.

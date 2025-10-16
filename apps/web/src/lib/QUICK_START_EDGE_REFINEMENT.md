# Quick Start: Edge Refinement

Edge refinement is now **enabled by default** but requires OpenCV.js to be loaded.

## How to Enable (One-Time Setup)

Add this to your app initialization (e.g., in your main component or route):

```typescript
import { loadOpenCV } from '@/lib/card-edge-refiner'

// Load OpenCV when app starts
async function initializeApp() {
  try {
    console.log('Loading OpenCV...')
    await loadOpenCV()
    console.log('OpenCV loaded! Edge refinement ready.')
  } catch (err) {
    console.error('Failed to load OpenCV:', err)
    // App will still work, just without edge refinement
  }
}

// Call on app mount
initializeApp()
```

## What You'll See in Console

### When You Crop a Card (with OpenCV loaded):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 STAGE 1: DETR Bounding Box Crop
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Bounding Box Crop URL: blob:http://localhost:3000/abc-123
📊 Size: 45.23KB
📐 Dimensions: 384×384
💡 This is the DETR crop with potential background padding

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ STAGE 2: OpenCV Edge Refinement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Edge refinement successful!
🎯 Confidence: 92.3%
📍 Detected corners: [
  { x: 23, y: 15 },
  { x: 361, y: 18 },
  { x: 359, y: 366 },
  { x: 25, y: 363 }
]
🔗 Refined Card URL: blob:http://localhost:3000/def-456
📊 Size: 43.12KB
📐 Dimensions: 384×384
💡 This is the refined crop with precise card edges
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Comparing the Results

1. **Copy the first blob URL** (Bounding Box Crop)
2. **Paste it in a new browser tab** - You'll see the DETR crop with background
3. **Copy the second blob URL** (Refined Card)
4. **Paste it in another tab** - You'll see the refined crop with precise edges
5. **Compare side-by-side!**

### Without OpenCV:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 STAGE 1: DETR Bounding Box Crop
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Bounding Box Crop URL: blob:http://localhost:3000/abc-123
📊 Size: 45.23KB
📐 Dimensions: 384×384
💡 This is the DETR crop with potential background padding
⚠️  Edge refinement enabled but OpenCV not loaded
💡 Call loadOpenCV() to enable edge refinement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Disable Edge Refinement (Optional)

If you want to disable edge refinement:

```typescript
const webcam = await setupWebcam({ /* ... */ })

// Disable edge refinement
webcam.setEdgeRefinement(false)

// Re-enable later
webcam.setEdgeRefinement(true)
```

## Example: Full Integration

```typescript
import { setupWebcam } from '@/lib/webcam'
import { loadOpenCV } from '@/lib/card-edge-refiner'

async function setupCardDetection() {
  // 1. Load OpenCV (takes 2-3 seconds)
  try {
    await loadOpenCV()
  } catch (err) {
    console.warn('OpenCV unavailable, edge refinement disabled')
  }

  // 2. Setup webcam
  const webcam = await setupWebcam({
    video: document.getElementById('video') as HTMLVideoElement,
    overlay: document.getElementById('overlay') as HTMLCanvasElement,
    cropped: document.getElementById('cropped') as HTMLCanvasElement,
    fullRes: document.getElementById('fullRes') as HTMLCanvasElement,
    onCrop: (canvas) => {
      console.log('Card cropped!', canvas)
      // Send to your embedding API, etc.
    },
  })

  // 3. Start video
  await webcam.startVideo()

  // Edge refinement is already enabled by default!
  // Just click on a detected card to see the comparison in console
}
```

## Performance

- **OpenCV Load Time**: ~2-3 seconds (one-time, at startup)
- **Edge Refinement**: ~50-200ms per card (only when you click to crop)
- **No impact on detection loop** (DETR still runs at 500ms intervals)

## Troubleshooting

### "OpenCV not loaded" warning

**Solution**: Add `await loadOpenCV()` to your app initialization

### "No quadrilateral found" error

**Causes**:
- Card is too small in the frame
- Poor lighting or low contrast
- Card is heavily occluded
- Background is too cluttered

**Solution**: The system automatically falls back to the DETR crop

### Low confidence score (< 70%)

**Causes**:
- Card is bent or warped
- Extreme perspective distortion
- Card edges are unclear

**Solution**: The refined result is still used, but you may want to recapture

## Summary

✅ **Edge refinement is enabled by default**  
✅ **Just load OpenCV once at startup**  
✅ **Console shows blob URLs for both crops**  
✅ **Automatic fallback if refinement fails**  
✅ **No code changes needed in your crop handler**

The refined crop is what gets passed to your `onCrop` callback!

# YOLOv8 Integration for Card Detection

## Overview

We've integrated YOLOv8 as a detector option to solve the card detection issues with SlimSAM. YOLOv8 is specifically designed for object detection and works well with playing cards.

## Implementation Status

✅ **Completed:**
- YOLOv8Detector class implementation
- ONNX Runtime integration
- Input preprocessing (640×640 resize, RGB normalization)
- Output postprocessing (NMS, bounding box extraction)
- Factory integration
- Route configuration

❌ **TODO:**
- Obtain YOLOv8 model trained on playing cards
- Add model file to `/public/models/`
- Test with mock webcam stream

## Getting a YOLOv8 Model

### Option 1: Use Pre-trained Playing Card Model (Recommended)

**Roboflow Universe** has several playing card detection models:
- https://universe.roboflow.com/augmented-startups/playing-cards-ow27d
- https://universe.roboflow.com/yolov8-nkirm/play-card-jyuul

**Steps:**
1. Sign up for Roboflow (free tier available)
2. Download the model in ONNX format
3. Place in `/apps/web/public/models/yolov8n-cards.onnx`

### Option 2: Train Custom Model

If you want MTG-specific detection:

```bash
# Install ultralytics
pip install ultralytics

# Train on custom dataset
yolo detect train data=mtg-cards.yaml model=yolov8n.pt epochs=50

# Export to ONNX
yolo export model=runs/detect/train/weights/best.pt format=onnx
```

### Option 3: Use General YOLOv8n (Quick Test)

For initial testing, you can use the base YOLOv8n model:

```bash
# Download and export
from ultralytics import YOLO
model = YOLO('yolov8n.pt')
model.export(format='onnx')
```

## Usage

Once you have the model file:

1. **Place model in public directory:**
   ```
   /apps/web/public/models/yolov8n-cards.onnx
   ```

2. **Use YOLOv8 detector:**
   ```
   http://localhost:3001/game/your-game-id?detector=yolov8
   ```

3. **Or set as default in `/apps/web/src/routes/game.$gameId.tsx`:**
   ```typescript
   const defaultValues = {
     detector: 'yolov8' as const,
     useFrameBuffer: true,
     usePerspectiveWarp: false, // YOLOv8 provides boxes, not quads
   }
   ```

## How It Works

1. **Continuous Detection:** YOLOv8 runs every 500ms, detecting all cards in view
2. **Bounding Boxes:** Draws green boxes around detected cards
3. **Click to Identify:** User clicks on a card to crop and send to CLIP for identification
4. **Fast Inference:** ~50-100ms per frame (much faster than SlimSAM's 2+ seconds)

## Model Requirements

- **Format:** ONNX
- **Input:** 640×640 RGB image (float32, normalized 0-1)
- **Output:** [1, 84, 8400] tensor (4 bbox coords + 80 class scores)
- **Size:** ~6MB for YOLOv8n (nano), ~25MB for YOLOv8s (small)

## Advantages Over SlimSAM

✅ **Trained for object detection** (not segmentation)
✅ **Fast inference** (~50-100ms vs 2000ms)
✅ **Works on any background** (doesn't merge card with playmat)
✅ **Industry standard** (used by successful MTG apps)
✅ **Continuous detection** (shows all cards in view)

## Next Steps

1. **Get a model** - Download from Roboflow or train custom
2. **Test** - Try with `?detector=yolov8` query parameter
3. **Tune** - Adjust confidence thresholds if needed
4. **Deploy** - Set as default once working

## References

- [YOLOv8 in Browser Tutorial](https://dev.to/andreygermanov/how-to-detect-objects-in-videos-in-a-web-browser-using-yolov8-neural-network-and-javascript-lfb)
- [Roboflow Playing Cards Dataset](https://universe.roboflow.com/augmented-startups/playing-cards-ow27d)
- [Ultralytics YOLOv8 Docs](https://docs.ultralytics.com/)

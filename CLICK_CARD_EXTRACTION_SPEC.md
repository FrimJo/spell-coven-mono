# Click-Based Card Extraction Specification

## Goal
When a user clicks on a card visible in a live video stream, the system extracts and rectifies the clicked card into a flat, perspective-correct image with a known width/height ratio.

We know that the user always clicks **on** a card.  
The video may vary in quality, angle, lighting, and distance. The camera may not be perfectly top-down.

---

## 1. High-Level Flow
1. **User clicks** somewhere on the live stream.  
2. **Crop ROI** (region of interest) around the click.  
3. **Detect the card region** within that ROI using **SlimSAM** via `transformers.js`.  
4. **Refine card corners** and enforce the known aspect ratio.  
5. **Warp (rectify)** the card to a canonical `W×H` output image.  
6. **Display / return** the rectified card.

---

## 2. Detection Mode — SlimSAM via Transformers.js (Recommended)

### Model
Use the **SlimSAM** model — a lightweight, community-optimized version of Segment Anything — loaded through [Transformers.js](https://github.com/xenova/transformers.js).

- **Backend:** WebGPU (auto-fallback to WebGL/WASM)
- **Precision:** `fp16` (half precision) for speed and memory efficiency
- **Model size:** ~30–40 MB
- **Runtime:** 25–40 FPS on modern laptops at 720p ROI

### Steps
1. Crop a square ROI (≈512×512 px) centered on the click.
2. Run SlimSAM with the click as a **positive point prompt**.
3. Keep the **largest connected component** that contains the click.
4. Simplify the mask to a **polygon** and fit a **minimum-area rectangle (quad)**.
5. Proceed to Corner Refinement (Section 3).

---

## 2.1 Example (Transformers.js Integration)

```javascript
import { pipeline, env } from '@xenova/transformers';

// Enable WebGPU with fp16 precision
env.backends.onnx.wasm.wasmPaths = 'wasm/';
env.allowLocalModels = false;
env.useWebGPU = true;
env.webgpu.defaultDtype = 'fp16';

// Load SlimSAM once at startup (warm load)
const segmenter = await pipeline(
  'image-segmentation',
  'Xenova/slimsam', // or another SlimSAM variant from Hugging Face
  { dtype: 'fp16' }
);

// Handle click event
async function extractCardFromClick(frame, clickPoint) {
  const roi = cropAround(frame, clickPoint, 512);

  // Run point-prompt segmentation
  const result = await segmenter(roi.image, {
    points: [[clickPoint.x - roi.origin.x, clickPoint.y - roi.origin.y]],
    labels: [1], // 1 = foreground
  });

  // Extract binary mask
  const mask = result.masks?.[0];
  if (!mask) return null;

  // Continue with post-processing pipeline
  const comp = largestComponentContainingPoint(mask, clickPoint - roi.origin);
  const poly = contourApprox(comp);
  const quad = minAreaRectOrQuad(poly);
  const refinedQuad = refineCorners(roi.image, quad);
  const warped = warpPerspective(frame, mapToFrameCoords(roi, refinedQuad), W, H);

  return warped;
}
```

**Notes:**
- `Xenova/slimsam` is a community-optimized SAM variant for Transformers.js.
- For low-power devices, load smaller checkpoints (e.g. `slimsam-tiny`).
- Always reuse the `segmenter` instance between clicks (warm model).

---

## 3. Corner Refinement
Applies after any detection step.

1. **Sub-pixel Refinement**  
   Use Harris or GoodFeaturesToTrack near each provisional corner.
2. **Line Re-fit**  
   Re-estimate edges using nearby line segments and intersect them.
3. **Aspect Ratio Enforcement**  
   Adjust corners so width/height ≈ known card ratio (±10–15%).
4. **Corner Ordering**  
   Sort corners (top-left → top-right → bottom-right → bottom-left).

---

## 4. Perspective Warp
1. Compute a **homography** from the refined quad to a canonical rectangle of size `W×H`.
2. Apply `warpPerspective` (OpenCV.js or equivalent).
3. Optionally rotate the result upright via a quick orientation classifier.

Output: a flat, top-down card image with known geometry.

---

## 5. Temporal Optimization (Optional)
- Keep a small buffer of recent frames (e.g., last 5–8).
- Compute a **sharpness score** (variance of Laplacian).
- After a click, re-warp from the **sharpest** frame in ±150 ms.

---

## 6. Implementation Notes

### 6.1 Runtime
- Use **Transformers.js** with **WebGPU + fp16** for inference.
- Use **OpenCV.js** for geometry:  
  `getPerspectiveTransform`, `warpPerspective`, `findContours`, etc.
- Run segmentation at ~25–30 FPS for 720p; tracking at full frame rate.

### 6.2 ROI Scaling
- Start ROI ~1× expected card size.  
- If edges not found, grow ROI (1.0× → 1.5× → 2.0×).

### 6.3 UX
- Highlight selected quad on click.
- Allow manual corner tweak.
- Show extracted preview immediately, replace with sharper re-warp once ready.

---

## 7. Pseudocode Overview

```javascript
function onClick(clickPoint) {
  const roi = cropAround(clickPoint, 512);
  const mask = runSlimSAMPointPrompt(roi.image, clickPoint - roi.origin);
  const comp = largestComponentContainingPoint(mask, clickPoint - roi.origin);
  const poly = contourApprox(comp);
  let quad = minAreaRectOrQuad(poly);

  quad = refineCorners(roi.image, quad);
  quad = enforceAspectRatio(quad, targetRatio);

  const rectified = warpPerspective(fullFrame, mapToFrameCoords(roi, quad), W, H);
  showOverlay(quad);
  displayExtractedCard(rectified);
}
```

---

## 8. Data & Models
- **Aspect ratio:** known constant (e.g., 88.9 mm × 63.5 mm = 1.4 ratio).  
- **Model:** `Xenova/slimsam` (or `slimsam-tiny`) for best browser performance.  
- **Augmentations (if fine-tuning):** rotation, blur, exposure, JPEG artifacts, perspective.

---

## 9. Summary
| Method | Model | Backend | Speed | Quality | Notes |
|--------|--------|----------|--------|----------|-------|
| **SlimSAM via Transformers.js** | `Xenova/slimsam` | WebGPU + fp16 | ★★★★☆ | ★★★★☆ | Best web trade-off |
| SAM-Base | `facebook/sam-vit-base` | WebGPU | ★★☆☆☆ | ★★★★★ | Heavy but precise |
| SAM-Huge | `facebook/sam-vit-huge` | WebGPU | ★☆☆☆☆ | ★★★★★ | Impractical for web |

**Recommended default:**  
→ `SlimSAM` via `Transformers.js` (WebGPU + fp16) + Corner Refinement + Perspective Warp.

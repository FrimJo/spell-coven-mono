# Detector Comparison Guide

This guide helps you choose the right detector for your use case.

## Quick Comparison

| Feature | OpenCV | DETR | OWL-ViT |
|---------|--------|------|---------|
| **Speed** | ⚡️ Very Fast (50-100ms) | 🐢 Moderate (200-500ms) | 🐌 Slow (300-700ms) |
| **Model Size** | 📦 Tiny (~1MB) | 📦 Large (~160MB) | 📦 Large (~200MB) |
| **First Load** | ⚡️ Instant | ⏳ 10-30s download | ⏳ 15-40s download |
| **Offline** | ✅ Works immediately | ✅ After first load | ✅ After first load |
| **Lighting** | ⚠️ Very sensitive | ✅ Robust | ✅ Very robust |
| **False Positives** | ⚠️ Many | ✅ Few | ✅ Very few |
| **Accuracy** | 🎯 60-70% | 🎯 85-90% | 🎯 90-95% (expected) |
| **GPU Required** | ❌ No | ⚠️ Recommended | ⚠️ Recommended |
| **Status** | ✅ Production | ✅ Production | 🚧 Not implemented |

## Detailed Comparison

### OpenCV Detector

**Best for:**
- 🚀 Prototyping and quick testing
- 💻 Low-end devices without GPU
- 📶 Offline-first applications
- 🎬 Controlled lighting environments

**Strengths:**
- Extremely fast inference (~50-100ms)
- No model download required
- Works immediately on first load
- Low memory footprint
- CPU-only, no GPU needed

**Weaknesses:**
- Very sensitive to lighting conditions
- Many false positives (books, phones, papers)
- Requires clear, high-contrast edges
- Struggles with shadows and reflections
- No confidence scores

**When to use:**
```typescript
// Use OpenCV for fast prototyping
export const ACTIVE_DETECTOR: DetectorType = 'opencv'
```

**Configuration:**
```typescript
opencv: {
  minCardArea: 4000,        // Minimum area in pixels
  cannyLowThreshold: 75,    // Edge detection sensitivity
  cannyHighThreshold: 200,  // Edge detection sensitivity
  blurKernelSize: 5,        // Noise reduction
}
```

---

### DETR Detector (Default)

**Best for:**
- 🎯 Production applications
- 🌈 Varied lighting conditions
- 🖼️ Cluttered backgrounds
- 📱 Modern devices with GPU

**Strengths:**
- Robust to lighting variations
- Filters out non-card objects
- Provides confidence scores
- GPU-accelerated (WebGPU/WebGL)
- Good balance of speed and accuracy

**Weaknesses:**
- Requires model download (~160MB)
- Slower than OpenCV (~200-500ms)
- Needs GPU for best performance
- May detect books as cards

**When to use:**
```typescript
// Use DETR for production (default)
export const ACTIVE_DETECTOR: DetectorType = 'detr'
```

**Configuration:**
```typescript
detr: {
  confidenceThreshold: 0.5,  // Minimum confidence (0.0-1.0)
  device: 'auto',            // 'auto', 'webgpu', 'wasm'
  dtype: 'fp32',             // 'fp32' or 'fp16'
}
```

---

### OWL-ViT Detector (Coming Soon)

**Best for:**
- 🎯 Maximum accuracy requirements
- 🔍 Specific object detection
- 🏆 Competition/tournament use
- 📊 Data collection and analysis

**Strengths:**
- Text-guided detection ("Magic card")
- Highest accuracy expected
- Fewest false positives
- Can be fine-tuned with prompts

**Weaknesses:**
- Slowest inference (~300-700ms)
- Largest model (~200MB)
- Not yet implemented
- Requires GPU

**When to use:**
```typescript
// Use OWL-ViT for maximum accuracy (when implemented)
export const ACTIVE_DETECTOR: DetectorType = 'owl-vit'
```

**Configuration:**
```typescript
'owl-vit': {
  confidenceThreshold: 0.3,
  prompts: [
    'Magic: The Gathering card',
    'trading card',
    'collectible card game card'
  ],
}
```

## Use Case Recommendations

### 🎮 Casual Play
**Recommended: DETR**
- Good balance of speed and accuracy
- Works in varied lighting
- Handles cluttered play areas

### 🏆 Tournament Play
**Recommended: OWL-ViT (when available)**
- Maximum accuracy
- Minimal false positives
- Worth the extra latency

### 💻 Low-End Devices
**Recommended: OpenCV**
- No GPU required
- Fast on any device
- Instant startup

### 🚀 Development/Testing
**Recommended: OpenCV → DETR**
- Start with OpenCV for quick iteration
- Switch to DETR for production testing

### 📶 Offline-First
**Recommended: OpenCV**
- No model download
- Works immediately
- Smallest footprint

### 🌙 Low Light Conditions
**Recommended: DETR or OWL-ViT**
- ML models handle low light better
- OpenCV struggles without clear edges

## Switching Between Detectors

### Quick Switch
Edit `src/lib/detector-config.ts`:
```typescript
export const ACTIVE_DETECTOR: DetectorType = 'opencv' // or 'detr' or 'owl-vit'
```

### Runtime Comparison
```typescript
import { createDetector } from '@/lib/detectors'

// Test all detectors
const opencv = createDetector('opencv')
const detr = createDetector('detr')

await opencv.initialize()
await detr.initialize()

// Compare performance
const opencvResult = await opencv.detect(canvas, width, height)
const detrResult = await detr.detect(canvas, width, height)

console.log('OpenCV:', opencvResult.cards.length, 'cards in', opencvResult.inferenceTimeMs, 'ms')
console.log('DETR:', detrResult.cards.length, 'cards in', detrResult.inferenceTimeMs, 'ms')
```

### Hybrid Approach
```typescript
// Use OpenCV for real-time preview, DETR for final capture
const fastDetector = createDetector('opencv')
const accurateDetector = createDetector('detr')

// Fast preview at 30 FPS
setInterval(() => {
  const preview = await fastDetector.detect(canvas, width, height)
  renderPreview(preview.cards)
}, 33)

// Accurate capture on click
button.onclick = async () => {
  const final = await accurateDetector.detect(canvas, width, height)
  processFinalCapture(final.cards)
}
```

## Performance Tips

### OpenCV
- Use good lighting
- Avoid shadows
- Place cards on solid background
- Increase `minCardArea` to reduce false positives

### DETR
- Enable GPU acceleration (WebGPU)
- Increase `confidenceThreshold` to reduce false positives
- Use lower resolution for faster inference
- Cache model after first load

### OWL-ViT
- Use specific text prompts
- Lower `confidenceThreshold` if missing cards
- Batch multiple detections when possible
- Consider using DETR for preview, OWL-ViT for verification

## Migration Path

### From OpenCV to DETR
1. Change config: `ACTIVE_DETECTOR = 'detr'`
2. Wait for model download (~160MB)
3. Test with your cards
4. Adjust `confidenceThreshold` if needed

### From DETR to OWL-ViT
1. Wait for OWL-ViT implementation
2. Change config: `ACTIVE_DETECTOR = 'owl-vit'`
3. Customize text prompts
4. Test and compare accuracy

### Rollback
Simply change `ACTIVE_DETECTOR` back to previous value.

## Troubleshooting

### OpenCV not detecting cards
- Check lighting (needs bright, even light)
- Ensure cards have clear edges
- Adjust `cannyLowThreshold` and `cannyHighThreshold`
- Increase contrast in environment

### DETR too slow
- Enable GPU acceleration
- Reduce detection interval
- Use lower resolution canvas
- Consider switching to OpenCV for preview

### Too many false positives
- **OpenCV**: Increase `minCardArea`
- **DETR**: Increase `confidenceThreshold`
- **All**: Use better lighting and cleaner background

### Model not loading
- Check internet connection (first load only)
- Clear browser cache
- Check console for errors
- Try different browser

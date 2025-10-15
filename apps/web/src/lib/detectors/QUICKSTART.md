# Detector Quick Start Guide

Get started with card detection in 3 easy steps.

## 1. Choose Your Detector

Edit `src/lib/detector-config.ts`:

```typescript
// Option 1: OpenCV (Fast, no download, lighting-sensitive)
export const ACTIVE_DETECTOR: DetectorType = 'opencv'

// Option 2: DETR (Balanced, ML-based, robust) - DEFAULT
export const ACTIVE_DETECTOR: DetectorType = 'detr'

// Option 3: OWL-ViT (Most accurate, not yet implemented)
export const ACTIVE_DETECTOR: DetectorType = 'owl-vit'
```

## 2. Customize Settings (Optional)

In the same file, uncomment and adjust settings:

```typescript
export const DETECTOR_OVERRIDES = {
  opencv: {
    minCardArea: 4000,        // Adjust for card size
    cannyLowThreshold: 75,    // Lower = more sensitive
    cannyHighThreshold: 200,  // Higher = less noise
  },
  detr: {
    confidenceThreshold: 0.5, // Higher = fewer false positives
    device: 'auto',           // 'webgpu' for GPU, 'wasm' for CPU
  },
}
```

## 3. Use in Your App

The detector is automatically used by `setupWebcam()`:

```typescript
import { setupWebcam } from '@/lib/webcam'

const webcam = await setupWebcam({
  video: videoElement,
  overlay: overlayCanvas,
  cropped: croppedCanvas,
  fullRes: fullResCanvas,
  onProgress: (msg) => console.log(msg),
  onCrop: () => console.log('Card captured!')
})

// Start detection
await webcam.startVideo()
```

## That's It!

The active detector from your config will be used automatically.

## Switching Detectors

To switch detectors, just change `ACTIVE_DETECTOR` and reload:

```typescript
// Before
export const ACTIVE_DETECTOR: DetectorType = 'opencv'

// After
export const ACTIVE_DETECTOR: DetectorType = 'detr'
```

Refresh your browser - that's it!

## Advanced Usage

### Manual Detector Creation

```typescript
import { createDetector } from '@/lib/detectors'

// Create specific detector
const detector = createDetector('opencv', {
  minCardArea: 5000,
  onProgress: (msg) => console.log(msg)
})

await detector.initialize()
const result = await detector.detect(canvas, width, height)
console.log(`Found ${result.cards.length} cards in ${result.inferenceTimeMs}ms`)
```

### Compare Detectors

```typescript
import { createDetector } from '@/lib/detectors'

const opencv = createDetector('opencv')
const detr = createDetector('detr')

await Promise.all([opencv.initialize(), detr.initialize()])

// Run both
const [opencvResult, detrResult] = await Promise.all([
  opencv.detect(canvas, width, height),
  detr.detect(canvas, width, height)
])

console.log('OpenCV:', opencvResult.cards.length, 'cards')
console.log('DETR:', detrResult.cards.length, 'cards')
```

## Troubleshooting

### OpenCV not detecting?
- Improve lighting
- Use solid background
- Adjust `cannyLowThreshold` (lower = more sensitive)

### DETR too slow?
- Enable GPU: `device: 'webgpu'`
- Reduce detection interval
- Use OpenCV for preview, DETR for capture

### Too many false positives?
- **OpenCV**: Increase `minCardArea`
- **DETR**: Increase `confidenceThreshold`

## Next Steps

- Read [COMPARISON.md](./COMPARISON.md) for detailed comparison
- Read [README.md](./README.md) for architecture details
- Read [MIGRATION.md](./MIGRATION.md) for switching to OWL-ViT

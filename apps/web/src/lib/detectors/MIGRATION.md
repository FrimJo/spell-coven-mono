# Migration Guide: Switching to OWL-ViT

This guide explains how to switch from DETR to OWL-ViT detector once it's implemented.

## Quick Switch (1 line change)

Edit `apps/web/src/lib/detector-config.ts`:

```typescript
// Change from:
export const ACTIVE_DETECTOR: DetectorType = 'detr'

// To:
export const ACTIVE_DETECTOR: DetectorType = 'owl-vit'
```

That's it! The application will now use OWL-ViT for card detection.

## Customizing OWL-ViT Settings

You can customize OWL-ViT behavior in `detector-config.ts`:

```typescript
export const DETECTOR_OVERRIDES = {
  'owl-vit': {
    confidenceThreshold: 0.3,
    prompts: [
      'Magic: The Gathering card',
      'trading card',
      'collectible card'
    ],
  },
}
```

## Comparing Detectors

To compare DETR vs OWL-ViT performance:

### Option 1: A/B Testing

```typescript
// In your test file
import { createDetector } from '@/lib/detectors'

const detrDetector = createDetector('detr')
const owlDetector = createDetector('owl-vit')

// Run both and compare results
const detrResults = await detrDetector.detect(canvas, width, height)
const owlResults = await owlDetector.detect(canvas, width, height)

console.log('DETR:', detrResults.cards.length, 'cards in', detrResults.inferenceTimeMs, 'ms')
console.log('OWL-ViT:', owlResults.cards.length, 'cards in', owlResults.inferenceTimeMs, 'ms')
```

### Option 2: Runtime Switching

```typescript
// Allow users to choose detector
const detectorType = userPreference === 'fast' ? 'detr' : 'owl-vit'
const detector = createDetector(detectorType)
```

## Rollback

If OWL-ViT doesn't work as expected, simply change back:

```typescript
export const ACTIVE_DETECTOR: DetectorType = 'detr'
```

No code changes needed - just update the config and reload.

## Expected Differences

### DETR
- **Speed**: Faster (~200-500ms)
- **Accuracy**: Good for general objects
- **False Positives**: May detect books, phones as cards
- **Model Size**: ~160MB

### OWL-ViT (Expected)
- **Speed**: Slower (~300-700ms)
- **Accuracy**: Better with text prompts
- **False Positives**: Fewer (text-guided detection)
- **Model Size**: ~200MB

## Troubleshooting

### OWL-ViT not detecting cards

Try adjusting the confidence threshold:

```typescript
export const DETECTOR_OVERRIDES = {
  'owl-vit': {
    confidenceThreshold: 0.2, // Lower threshold
  },
}
```

### OWL-ViT too slow

Use DETR for real-time detection, OWL-ViT for accuracy:

```typescript
// Fast detection with DETR
const fastDetector = createDetector('detr')

// Accurate verification with OWL-ViT
const accurateDetector = createDetector('owl-vit')
```

## Implementation Checklist

Before switching to OWL-ViT, ensure:

- [ ] OWL-ViT detector is fully implemented
- [ ] Unit tests pass
- [ ] Performance is acceptable
- [ ] False positive rate is lower than DETR
- [ ] Model loads successfully in browser
- [ ] GPU acceleration works

# Detector Query Parameter

You can now select the card detector dynamically using a URL query parameter on the game route.

## Usage

Add `?detector=<type>` to your game URL:

```
/game/ga-abc123?detector=opencv
/game/ga-abc123?detector=owl-vit
```

**Note:** DETR is the default detector, so `?detector=detr` is automatically stripped from the URL to keep URLs clean.

## Examples

### DETR (Default, ML-based)

```
http://localhost:5173/game/ga-abc123
```

- **No query parameter needed** - DETR is the default
- Robust detection
- ~160MB model download (first time only)
- Best for production

### OpenCV (Fast, no download)

```
http://localhost:5173/game/ga-abc123?detector=opencv
```

- Instant startup
- No model download
- Best for testing and low-end devices

### OWL-ViT (Not yet implemented)

```
http://localhost:5173/game/ga-abc123?detector=owl-vit
```

- Will show error until implemented
- Reserved for future use

## No Query Parameter

If no `detector` parameter is provided, the system uses **DETR** as the default:

```
/game/ga-abc123  →  Uses DETR detector
```

This default is configured in the route file (`src/routes/game.$gameId.tsx`):

```typescript
const defaultValues = {
  detector: 'detr' as const,
}
```

The URL will automatically strip `?detector=detr` to keep URLs clean, so these are equivalent:

- `/game/ga-abc123`
- `/game/ga-abc123?detector=detr` (automatically becomes `/game/ga-abc123`)

## Implementation Details

The query parameter flows through the application like this:

```
Route (/game/$gameId)
  ↓ reads ?detector=<type>
GameRoom component
  ↓ passes detectorType prop
VideoStreamGrid component
  ↓ passes detectorType prop
useWebcam hook
  ↓ passes detectorType option
setupWebcam function
  ↓ creates detector with type
CardDetector (OpenCV/DETR/OWL-ViT)
```

## Use Cases

### Testing Different Detectors

```typescript
// Compare performance
const urls = ['/game/ga-test?detector=opencv', '/game/ga-test?detector=detr']

// Open in different tabs and compare
```

### User Preferences

```typescript
// Allow users to choose their detector
const detectorSelect = document.querySelector('select')
detectorSelect.addEventListener('change', (e) => {
  const detector = e.target.value
  window.location.href = `/game/${gameId}?detector=${detector}`
})
```

### A/B Testing

```typescript
// Randomly assign detector for testing
const detectors = ['opencv', 'detr']
const randomDetector = detectors[Math.floor(Math.random() * detectors.length)]
window.location.href = `/game/${gameId}?detector=${randomDetector}`
```

### Device-Based Selection

```typescript
// Use OpenCV on mobile, DETR on desktop
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
const detector = isMobile ? 'opencv' : 'detr'
window.location.href = `/game/${gameId}?detector=${detector}`
```

## Validation

The query parameter is validated using Zod schema:

```typescript
const gameSearchSchema = z.object({
  detector: z.enum(['opencv', 'detr', 'owl-vit']).optional(),
})
```

Invalid values will be ignored and the default detector will be used.

## Priority Order

The detector is selected in this order:

1. **Query parameter** (`?detector=opencv` or `?detector=owl-vit`) - Highest priority
2. **Route default** (DETR - defined in `game.$gameId.tsx`)

**Note:** The default value (`detr`) is automatically stripped from the URL, so navigating to `/game/ga-abc123?detector=detr` will redirect to `/game/ga-abc123` while still using DETR.

## Combining with Other Parameters

You can combine the detector parameter with other query parameters:

```
/game/ga-abc123?detector=opencv&debug=true&fps=30
```

## Sharing Links

When sharing game links, you can include the detector preference:

```typescript
// Share link with specific detector
const shareLink = `${window.location.origin}/game/${gameId}?detector=opencv`
navigator.clipboard.writeText(shareLink)
```

## Development Tips

### Quick Switching

Bookmark different URLs for quick testing:

- `http://localhost:5173/game/test?detector=opencv` (Fast)
- `http://localhost:5173/game/test?detector=detr` (Accurate)

### Console Logging

Check which detector is active:

```typescript
// In browser console
console.log(window.location.search) // ?detector=opencv
```

### URL Builder Helper

```typescript
function buildGameUrl(gameId: string, detector?: DetectorType): string {
  const base = `/game/${gameId}`
  return detector ? `${base}?detector=${detector}` : base
}

// Usage
const url = buildGameUrl('ga-abc123', 'opencv')
// Result: /game/ga-abc123?detector=opencv
```

## Troubleshooting

### Detector not changing

- Check browser console for errors
- Verify the query parameter is correct
- Clear browser cache
- Reload the page

### Invalid detector value

- Only `opencv`, `detr`, and `owl-vit` are valid
- Case-sensitive (use lowercase)
- Check for typos in URL

### OWL-ViT not working

- OWL-ViT is not yet implemented
- Use `opencv` or `detr` instead
- See `owl-vit-detector.ts` for implementation status

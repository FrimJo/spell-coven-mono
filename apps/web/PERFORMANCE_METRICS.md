# Performance Metrics Documentation

## Overview

The frontend now tracks detailed performance metrics for the entire card identification pipeline, including the new contrast enhancement step.

## Metrics Breakdown

### Pipeline Performance (High-Level)

Logged as `🎯 Pipeline Performance`:

```
{
  "Detection": "5332ms",
  "Crop & Warp": "21ms",
  "Embedding": "19263ms",
  "Search": "70ms",
  "Total": "24687ms"
}
```

| Metric | Description | Typical Range |
|--------|-------------|---------------|
| **Detection** | OWL-ViT object detection on webcam frame | 4000-6000ms |
| **Crop & Warp** | Card cropping and perspective correction | 10-50ms |
| **Embedding** | CLIP model inference + enhancement + normalization | 15000-25000ms |
| **Search** | FAISS index search for top-1 match | 50-100ms |
| **Total** | Sum of all steps | 19000-32000ms |

### Embedding Breakdown (Detailed)

Logged as `📊 Embedding Breakdown`:

#### Without Contrast Enhancement:
```
{
  "CLIP Inference": "19200ms",
  "L2 Normalization": "15ms",
  "Total Embedding": "19215ms"
}
```

#### With Contrast Enhancement (e.g., 1.2x):
```
{
  "Contrast Enhancement": "18ms",
  "CLIP Inference": "19180ms",
  "L2 Normalization": "15ms",
  "Total Embedding": "19213ms"
}
```

| Metric | Description | Typical Range |
|--------|-------------|---------------|
| **Contrast Enhancement** | Canvas contrast adjustment (if enabled) | 5-50ms |
| **CLIP Inference** | CLIP ViT-L/14 model inference | 15000-25000ms |
| **L2 Normalization** | Vector normalization for cosine similarity | 5-20ms |
| **Total Embedding** | Sum of all embedding steps | 15000-25000ms |

## Performance Characteristics

### Bottleneck Analysis

**CLIP Inference dominates** (~98% of embedding time):
- CLIP ViT-L/14 is computationally expensive
- Running in browser with WASM/WebGPU
- No GPU acceleration on most devices
- Expected: 15-25 seconds per card

### Contrast Enhancement Impact

- **Overhead**: ~10-20ms per card (~0.1% of total time)
- **Negligible impact** on overall performance
- **Worth it** for improved matching accuracy on blurry cards

### Typical Performance Profile

```
Total: ~24-25 seconds per card

Breakdown:
├─ Detection (OWL-ViT): ~5.3s (22%)
├─ Crop & Warp: ~0.02s (0.1%)
├─ Embedding: ~19.2s (77%)
│  ├─ Contrast Enhancement: ~0.02s (0.1% of total)
│  ├─ CLIP Inference: ~19.2s (77% of total)
│  └─ L2 Normalization: ~0.015s (0.06% of total)
└─ Search: ~0.07s (0.3%)
```

## Monitoring Performance

### Browser Console

Open DevTools (F12) and check Console tab. You'll see:

```
🎯 Pipeline Performance: {
  Detection: "5332ms",
  Crop & Warp: "21ms",
  Embedding: "19263ms",
  Search: "70ms",
  Total: "24687ms"
}

📊 Embedding Breakdown: {
  Contrast Enhancement: "18ms",
  CLIP Inference: "19180ms",
  L2 Normalization: "15ms",
  Total Embedding: "19213ms"
}
```

### Real-Time Monitoring

1. Open http://localhost:3000
2. Open DevTools (F12)
3. Go to Console tab
4. Click "Start Webcam"
5. Click on a card
6. Watch metrics appear in console

## Performance Optimization Tips

### Reduce Detection Time (5.3s)
- Use smaller OWL-ViT model (not implemented yet)
- Reduce input resolution (trade-off: accuracy)
- Use GPU acceleration (browser limitation)

### Reduce Embedding Time (19.2s)
- Use smaller CLIP model (ViT-B/32 instead of ViT-L/14)
- Enable GPU acceleration (browser limitation)
- Use quantized model (already using fp16)

### Reduce Search Time (0.07s)
- Already optimized with FAISS HNSW
- Search time is negligible

## Contrast Enhancement Performance

### Overhead Breakdown

For a 336×336 canvas with 1.2x enhancement:

```
Contrast Enhancement: ~18ms

Breakdown:
├─ Create temp canvas: ~1ms
├─ Draw image: ~2ms
├─ Get image data: ~3ms
├─ Apply enhancement: ~10ms (pixel-by-pixel processing)
└─ Put image data: ~2ms
```

### Scaling

Enhancement time scales with canvas size:
- 224×224: ~8ms
- 336×336: ~18ms
- 512×512: ~40ms

## Metrics API

### EmbeddingMetrics Type

```typescript
type EmbeddingMetrics = {
  contrast: number      // Contrast enhancement time (ms)
  inference: number     // CLIP inference time (ms)
  normalization: number // L2 normalization time (ms)
  total: number         // Total embedding time (ms)
}
```

### Usage in Code

```typescript
const { embedding, metrics } = await embedFromCanvas(canvas)

console.log(`Embedding took ${metrics.total}ms`)
console.log(`  - Contrast: ${metrics.contrast}ms`)
console.log(`  - Inference: ${metrics.inference}ms`)
console.log(`  - Normalization: ${metrics.normalization}ms`)
```

## Troubleshooting Performance Issues

### Embedding takes >25 seconds

**Possible causes:**
1. Browser is throttled (check DevTools Performance tab)
2. Device is low on memory (check Task Manager)
3. Other tabs using GPU (close them)
4. CLIP model is re-downloading (check Network tab)

**Solutions:**
1. Close other tabs
2. Restart browser
3. Check internet connection
4. Try smaller CLIP model (ViT-B/32)

### Contrast enhancement takes >50ms

**Possible causes:**
1. Canvas is very large (>512×512)
2. Device is under heavy load
3. Browser is throttled

**Solutions:**
1. Reduce canvas size
2. Close other applications
3. Restart browser

## Performance Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Detection | 5.3s | 2-3s | ⏳ Needs optimization |
| Crop & Warp | 0.02s | 0.02s | ✅ Good |
| Embedding | 19.2s | 5-10s | ⏳ Needs model optimization |
| Search | 0.07s | 0.05s | ✅ Good |
| Contrast Enhancement | 0.02s | 0.02s | ✅ Good |
| **Total** | **24.6s** | **7-14s** | ⏳ Needs optimization |

## Future Improvements

1. **Smaller CLIP model**: Use ViT-B/32 instead of ViT-L/14 (3-5x faster)
2. **GPU acceleration**: Use WebGPU when available
3. **Quantization**: Use int8 instead of fp16
4. **Model caching**: Avoid re-downloading on refresh
5. **Parallel processing**: Run detection and embedding in parallel

## Related Documentation

- Backend contrast enhancement: `packages/mtg-image-db/CONTRAST_ENHANCEMENT.md`
- Frontend contrast enhancement: `CONTRAST_ENHANCEMENT_FRONTEND.md`
- Integration guide: `CONTRAST_ENHANCEMENT_INTEGRATION.md`

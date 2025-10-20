# Contrast Enhancement Quick Start

## TL;DR

To enable contrast enhancement for blurry cards:

### Step 1: Build Database with Enhancement
```bash
cd packages/mtg-image-db
python build_embeddings.py --kind unique_artwork --contrast 1.2
```

### Step 2: Start Frontend with Matching Factor
```bash
VITE_QUERY_CONTRAST=1.2 pnpm --filter @repo/web dev
```

### Step 3: Test
- Open http://localhost:3000
- Click "Start Webcam"
- Test with blurry cards
- Check browser console for enhancement logs

## Configuration Values

| Factor | Effect | Use Case |
|--------|--------|----------|
| 1.0 | No enhancement | Default, crisp cards |
| 1.2 | 20% boost | Recommended for typical webcam blur |
| 1.5 | 50% boost | Aggressive, very blurry conditions |

## Important Rules

1. **Frontend factor MUST match backend factor**
   - If backend: `--contrast 1.2`
   - Then frontend: `VITE_QUERY_CONTRAST=1.2`

2. **Both must be set or both must be 1.0**
   - Mismatches cause poor matching

## Verify Configuration

### Backend
```bash
cat packages/mtg-image-db/index_out/build_manifest.json | grep enhance_contrast
# Should show: "enhance_contrast": 1.2
```

### Frontend
```bash
# In browser console after loading
console.log('Query contrast enhancement:', QUERY_CONTRAST_ENHANCEMENT)
# Should show: 1.2
```

## Troubleshooting

**Cards not matching well?**
- Check factors match: `echo $VITE_QUERY_CONTRAST` and build manifest
- Try disabling (both 1.0) to confirm it's the issue

**Enhancement not applied?**
- Verify env var: `echo $VITE_QUERY_CONTRAST`
- Check browser console for logs
- Rebuild if needed

## Performance

- Backend build: ~5-10% slower
- Frontend query: ~10-20ms per card (~2-5% slower)
- No index size change

## Documentation

- Full backend docs: `packages/mtg-image-db/CONTRAST_ENHANCEMENT.md`
- Full frontend docs: `apps/web/CONTRAST_ENHANCEMENT_FRONTEND.md`
- Integration guide: `CONTRAST_ENHANCEMENT_INTEGRATION.md`

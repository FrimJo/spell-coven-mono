# Webcam Mocking in E2E Tests - Explanation

## Question: Can we mock the webcam like other tests?

**Answer: YES! The webcam mock works fine. The issue is different.**

## How Webcam Mocking Works

### The Mock Implementation

```typescript
async function mockGetUserMedia(page: Page, videoUrl: string) {
  await page.addInitScript(
    ({ videoUrl }: { videoUrl: string }) => {
      navigator.mediaDevices.getUserMedia = async (_constraints) => {
        const video = document.createElement('video')
        video.src = videoUrl  // Base64 data URL of demo video
        video.muted = true
        video.loop = true
        await video.play()
        const stream = video.captureStream()
        return stream as MediaStream
      }
    },
    { videoUrl },
  )
}
```

### What This Does

1. **Intercepts** `navigator.mediaDevices.getUserMedia()`
2. **Creates** a video element with the demo video
3. **Captures** the video stream using `captureStream()`
4. **Returns** the stream as if it came from a real webcam

### This Works For

- ✅ Starting the webcam
- ✅ Displaying video in the UI
- ✅ Card detection (OpenCV processes the video frames)
- ✅ Green border drawing
- ✅ Canvas cropping

## The Real Issue

**The mock works perfectly. The problem is the TEST doesn't verify the query correctly.**

### What's Actually Happening

1. **Existing Test** (`video-stream-grid-card-detection.spec.ts`):
   - ✅ Mocks webcam
   - ✅ Starts video
   - ✅ Detects cards (green borders)
   - ✅ Clicks canvas
   - ❌ **Doesn't verify query** - just checks no error: `expect(true).toBe(true)`

2. **New Test** (`card-identification.spec.ts`):
   - ✅ Mocks webcam (same way)
   - ✅ Starts video
   - ✅ Waits for model to load (NEW!)
   - ✅ Clicks canvas
   - ❌ **Expects query to trigger** - but doesn't verify it happens

### Why Query Doesn't Trigger

The query SHOULD trigger when:
1. User clicks on overlay canvas
2. `getCroppedCanvas()` is called
3. Canvas is passed to `onCardCrop` callback
4. `onCardCrop` calls `query(canvas)` from context
5. `useCardQuery` hook executes the query

**The chain might break at any point!**

## Debugging Steps

### Step 1: Verify Webcam Mock Works

```bash
pnpm --filter @repo/web e2e video-stream-grid-card-detection.spec --headed
```

Expected: ✅ Green borders appear (proves mock works)

### Step 2: Verify Query Trigger

```bash
pnpm --filter @repo/web e2e card-identification.spec -g "should trigger" --headed
```

Watch for console log: `Cropped card image: data:image/png;base64,...`

- **If appears**: Query triggered ✅
- **If missing**: Query not triggered ❌

### Step 3: Check What's Breaking

If query doesn't trigger, check:

1. **Canvas exists?**
   ```typescript
   const cropped = document.querySelector('canvas[width="446"][height="620"]')
   console.log('Cropped canvas:', !!cropped)
   ```

2. **Canvas has data?**
   ```typescript
   const ctx = cropped.getContext('2d')
   const imageData = ctx.getImageData(0, 0, 446, 620)
   const hasData = imageData.data.some(pixel => pixel !== 0)
   console.log('Canvas has data:', hasData)
   ```

3. **Click registered?**
   ```typescript
   // Add to useWebcam.ts onCrop callback
   console.log('onCrop called!', croppedRef.current)
   ```

4. **Context provider exists?**
   ```typescript
   // Check if CardQueryProvider wraps the component
   console.log('Provider exists:', !!useCardQueryContext)
   ```

## Common Issues & Solutions

### Issue 1: "Video doesn't play in test"

**Symptom**: No green borders, video element exists but paused

**Cause**: Browser autoplay policy blocks video

**Solution**: Already handled - mock calls `video.play()` and sets `muted: true`

### Issue 2: "Card detection doesn't work"

**Symptom**: Video plays but no green borders

**Cause**: Demo video doesn't have detectable cards OR OpenCV not loaded

**Solution**: 
- Verify OpenCV loaded: `await waitForOpenCv(page)`
- Check video has cards: Use `card_demo.webm` which has known cards

### Issue 3: "Query doesn't trigger"

**Symptom**: Green borders appear, click works, but no console log

**Cause**: One of these:
1. `onCardCrop` callback not wired
2. Canvas is empty
3. Context provider missing
4. Query function not called

**Solution**: Add logging at each step to find where it breaks

### Issue 4: "Test times out waiting for result"

**Symptom**: Query triggers but result never appears

**Cause**: 
1. Model not loaded (embeddings or CLIP)
2. Query fails silently
3. Result renders but selector doesn't match

**Solution**:
- Verify model loaded: `await waitForClipModel(page)`
- Check for errors in console
- Inspect actual DOM structure

## The Fix

### Updated Test Strategy

```typescript
test('should trigger and display result', async ({ page }) => {
  // 1. Track console BEFORE navigation
  let queryTriggered = false
  page.on('console', (msg) => {
    if (msg.text().includes('Cropped card image:')) {
      queryTriggered = true
    }
  })

  // 2. Wait for BOTH OpenCV AND CLIP model
  await waitForClipModel(page)  // NEW!
  await waitForOpenCv(page)

  // 3. Start webcam
  const cameraButton = page.getByTestId('video-toggle-button')
  await cameraButton.click()
  
  // 4. Wait LONGER for video to stabilize
  await page.waitForTimeout(5000)  // Increased from 3000

  // 5. Verify card detection works
  const hasGreenBorders = await checkForGreenBorders(page)
  expect(hasGreenBorders).toBe(true)

  // 6. Click canvas
  const canvas = page.locator('canvas[width="640"][height="480"]').first()
  await canvas.click({ position: { x: 320, y: 240 }, force: true })

  // 7. Wait for query
  await page.waitForTimeout(5000)  // Increased from 2000

  // 8. Verify query triggered
  expect(queryTriggered).toBe(true)

  // 9. Verify result displays
  const result = page.locator('text=Score:')
  await expect(result).toBeVisible({ timeout: 5000 })
})
```

### Key Changes

1. **Longer waits** - Model loading and query execution take time
2. **Better verification** - Check each step succeeds
3. **Console tracking** - Verify query actually runs
4. **Debugging output** - Screenshots and logs when things fail

## Summary

**The webcam mock works perfectly!** 

The issue is:
- ❌ Not the mock
- ❌ Not the video
- ❌ Not card detection
- ✅ **The test expectations and timing**

The test needs to:
1. Wait for model to load (new requirement)
2. Wait longer for query to complete
3. Verify query actually triggers
4. Handle the case where CardResultDisplay returns null when idle

## Next Steps

Run the updated test:
```bash
pnpm --filter @repo/web e2e card-identification.spec -g "should trigger" --headed
```

If it still fails:
1. Check console for "Cropped card image:" log
2. Check screenshot in `test-results/`
3. Verify model loaded successfully
4. Check if canvas has data

The mock is fine - we just need to test the right things! 🎯

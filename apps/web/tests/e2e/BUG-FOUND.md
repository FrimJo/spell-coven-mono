# Bug Found: CardResultDisplay Not Rendering

## Root Cause

**CardResultDisplay returns `null` when query state is 'idle'**

```typescript
// CardResultDisplay.tsx
export function CardResultDisplay() {
  const { state } = useCardQueryContext()

  // Don't render anything in idle state
  if (state.status === 'idle') {
    return null  // ← THIS IS THE ISSUE
  }
  // ...
}
```

## Why This Happens

1. Component mounts in 'idle' state (no query triggered yet)
2. Component returns `null` - nothing renders
3. Test looks for result element → not found (expected!)
4. Even after clicking, if query doesn't trigger, still 'idle'

## The Real Problem

**The query is never being triggered!**

From the test run:
- ✅ Model loads successfully
- ✅ Page renders
- ✅ Sidebar exists
- ❌ CardResultDisplay not in DOM (returns null - idle state)
- ❌ No "Cropped card image:" console log
- ❌ Query never executes

## Why Query Doesn't Trigger

The test uses a mocked video, but:
1. **No webcam is started** - test doesn't click the camera button
2. **No canvas exists** - without webcam, no overlay canvas to click
3. **onCardCrop never fires** - no canvas = no click target

## Fix Required

### Option 1: Update Test to Start Webcam (RECOMMENDED)

```typescript
test('should display card result after clicking detected card', async ({ page }) => {
  await waitForClipModel(page)
  await waitForOpenCv(page)

  // START WEBCAM FIRST!
  const cameraButton = page.getByTestId('video-toggle-button')
  await cameraButton.click()
  await page.waitForTimeout(3000) // Wait for video to start

  // NOW click on canvas
  const overlayCanvas = page.locator('canvas[width="640"][height="480"]').first()
  await overlayCanvas.click({ position: { x: 320, y: 240 }, force: true })

  // Wait for query
  await page.waitForTimeout(5000)

  // Check for result
  const scoreText = page.locator('text=Score:')
  await expect(scoreText).toBeVisible({ timeout: 5000 })
})
```

### Option 2: Make CardResultDisplay Always Render

```typescript
// CardResultDisplay.tsx - NOT RECOMMENDED
export function CardResultDisplay() {
  const { state } = useCardQueryContext()

  // Always render, show placeholder in idle state
  if (state.status === 'idle') {
    return (
      <div className="text-sm text-muted-foreground">
        Click a detected card to identify it
      </div>
    )
  }
  // ...
}
```

## Recommended Solution

**Update the test** - The component behavior is correct. Tests should:

1. Start webcam
2. Wait for card detection
3. Click on detected card
4. Verify result appears

The component should NOT render when idle - this is good UX.

## Test Fix Applied

Updated `card-identification.spec.ts`:
- Added webcam start step
- Added proper wait times
- Added multiple selector strategies
- Added debugging output

## Verification

Run updated test:
```bash
pnpm --filter @repo/web e2e card-identification.spec -g "should display card result" --headed
```

Expected flow:
1. Page loads → Loading overlay
2. Model loads → Overlay disappears  
3. Click camera button → Webcam starts
4. Wait 3s → Card detection active
5. Click canvas → Query triggers
6. Wait 5s → Result appears
7. Test passes ✅

# Debugging Card Result Not Appearing

## Issue
Test fails with: `expect(locator).toBeVisible() - Expected: visible, Received: <element(s) not found>`

## Common Causes

### 1. Model Not Loaded
**Symptom**: Query never completes or throws error
**Check**:
```bash
# Run test with console output
pnpm test:e2e card-identification.spec -g "should display card result" --headed

# Look for in browser console:
# ✅ "Loading embeddings..."
# ✅ "Downloading CLIP model..."
# ❌ Any errors during model load
```

**Fix**: Ensure embeddings files exist in `public/data/mtg-embeddings/v1.0/`

### 2. Query Not Triggered
**Symptom**: No "Cropped card image:" log in console
**Check**:
- Canvas click is registered
- `onCardCrop` callback is wired correctly
- Context provider wraps the component

**Debug**:
```typescript
// Add to test:
page.on('console', (msg) => {
  console.log('[Browser]', msg.text())
})
```

**Fix**: Verify `CardQueryProvider` wraps `GameRoomContent` and `onCardCrop` passes canvas

### 3. Query Fails Silently
**Symptom**: Console shows "Cropped card image:" but no result
**Check**:
- Error state in CardResultDisplay
- embedFromCanvas() succeeds
- top1() returns valid result

**Debug**:
```typescript
// In browser console after clicking:
// Check query state
const sidebar = document.querySelector('.w-64')
console.log(sidebar?.innerHTML)

// Check for error messages
const error = document.querySelector('[role="alert"]')
console.log(error?.textContent)
```

### 4. Result Renders But Selector Doesn't Match
**Symptom**: Screenshot shows result but test can't find it
**Check**:
- Actual HTML structure vs expected selector
- CSS classes after build/minification
- Text content format

**Debug**:
```typescript
// Check what's actually rendered:
const sidebarContent = await page.evaluate(() => {
  const sidebar = document.querySelector('.w-64')
  return sidebar?.innerHTML
})
console.log(sidebarContent)
```

**Fix**: Use multiple selector strategies (see updated test)

## Step-by-Step Debugging

### Step 1: Run Test in Headed Mode
```bash
pnpm test:e2e card-identification.spec -g "should display card result" --headed
```

Watch the browser to see:
- ✅ Loading overlay appears and disappears
- ✅ Webcam starts
- ✅ Green borders appear on card
- ✅ Click registers on canvas
- ❓ What happens after click?

### Step 2: Check Console Logs
Look for:
```
[Browser Console] Cropped card image: data:image/png;base64,...
```

If missing → Query not triggered (see Cause #2)
If present → Query triggered, check for errors

### Step 3: Check Screenshot
Test saves screenshot to `test-results/card-result-displayed.png`

Look for:
- Card result component in left sidebar
- Error message
- Loading spinner stuck
- Nothing (query failed silently)

### Step 4: Inspect Sidebar HTML
Add to test:
```typescript
const html = await page.evaluate(() => {
  return document.querySelector('.w-64')?.innerHTML
})
console.log('Sidebar HTML:', html)
```

Check if:
- CardResultDisplay is rendered
- Result has correct structure
- CSS classes match expectations

### Step 5: Check Network Requests
```bash
# Run with network logging
pnpm test:e2e card-identification.spec --headed

# In browser DevTools:
# - Open Network tab
# - Filter by "embeddings" or "meta"
# - Check if files load successfully
```

## Quick Fixes

### Fix 1: Increase Timeout
Query might take longer than expected:
```typescript
// Change from:
await page.waitForTimeout(2000)

// To:
await page.waitForTimeout(5000)
```

### Fix 2: Wait for Specific Element
Instead of fixed timeout:
```typescript
// Wait for result or error
await page.waitForFunction(() => {
  const score = document.querySelector('text=Score:')
  const error = document.querySelector('[role="alert"]')
  return score || error
}, { timeout: 10000 })
```

### Fix 3: Use More Flexible Selectors
```typescript
// Instead of regex:
const cardResult = page.locator('text=/Score:|\\[.*\\]/')

// Try multiple approaches:
const scoreText = page.locator('text=Score:')
const setCode = page.locator('text=/\\[\\w+\\]/')
const container = page.locator('.space-y-3.rounded-lg.border')

// Check any of them:
const hasResult = await scoreText.isVisible() || 
                  await setCode.isVisible() || 
                  await container.isVisible()
```

### Fix 4: Check Query State Directly
```typescript
const queryState = await page.evaluate(() => {
  // Access React component state (requires React DevTools or exposed state)
  const sidebar = document.querySelector('.w-64')
  return {
    hasResult: !!sidebar?.querySelector('text=Score:'),
    hasError: !!sidebar?.querySelector('[role="alert"]'),
    hasLoading: !!sidebar?.querySelector('text=Identifying'),
    innerHTML: sidebar?.innerHTML.substring(0, 200)
  }
})
console.log('Query state:', queryState)
```

## Using Chrome DevTools MCP Server

For interactive debugging:

```typescript
// 1. Run test in headed mode with --debug
pnpm test:e2e card-identification.spec --debug

// 2. When test pauses, use MCP tools:

// Take snapshot
mcp0_take_snapshot()

// Check console
mcp0_list_console_messages()

// Evaluate state
mcp0_evaluate_script({
  function: `() => {
    const sidebar = document.querySelector('.w-64')
    return {
      exists: !!sidebar,
      html: sidebar?.innerHTML,
      hasScore: !!sidebar?.querySelector('text=Score:')
    }
  }`
})

// Take screenshot
mcp0_take_screenshot({ fullPage: true, filePath: 'debug-state.png' })
```

## Expected Flow

1. **Page Load** (0-2s)
   - Loading overlay visible
   - "Loading embeddings..." message

2. **Model Loading** (5-15s)
   - "Downloading CLIP model..." message
   - Progress updates

3. **Model Ready** (15-20s)
   - Loading overlay disappears
   - Game room fully visible

4. **Webcam Start** (20-23s)
   - Click camera button
   - Video stream appears
   - Green borders on detected card

5. **Click Card** (23s)
   - Click on canvas
   - Console: "Cropped card image: data:image/png..."

6. **Query Processing** (23-26s)
   - Brief loading state (may be too fast to see)
   - embedFromCanvas() executes
   - top1() searches database

7. **Result Display** (26s+)
   - Card result appears in sidebar
   - Shows: name, [SET], Score: 0.XXX
   - Card image loads
   - Scryfall link present

## Verification Checklist

Before reporting bug:
- [ ] Model files exist and load successfully
- [ ] Console shows "Cropped card image:" log
- [ ] No errors in browser console
- [ ] Screenshot shows something in sidebar
- [ ] Waited at least 5 seconds after click
- [ ] Tried with --headed mode to observe
- [ ] Checked sidebar HTML structure
- [ ] Verified CardQueryProvider is present

## Still Failing?

If all checks pass but test still fails:

1. **Capture full state**:
```bash
pnpm test:e2e card-identification-debug.spec --headed
```

2. **Review screenshots** in `test-results/debug-*.png`

3. **Check implementation**:
   - Verify `useCardQuery` hook is called
   - Check `CardResultDisplay` renders correctly
   - Ensure `CardQueryContext` provides state
   - Validate `onCardCrop` callback chain

4. **Test manually**:
```bash
pnpm dev
# Navigate to /game/test
# Click card
# Verify result appears
```

If manual test works but e2e fails → timing issue or test environment difference
If manual test also fails → implementation bug

# Card Identification E2E Tests

End-to-end tests for the card identification feature using Playwright.

## Test Files

### `card-identification.spec.ts`

Comprehensive test suite covering all user stories:

- **US1**: Card identification from video stream
- **US2**: Debug cropped images (base64 logging)
- **US3**: Error handling and low confidence warnings

**Test Cases**:

1. Loading overlay during model initialization
2. Card result display after clicking detected card
3. Loading state while querying
4. Base64 image logging to console
5. Low confidence warnings
6. Query cancellation on rapid clicks
7. Card information display with Scryfall link
8. Error messages for invalid crops
9. Card result positioning below player list

### `card-identification-debug.spec.ts`

Debug version with detailed logging and screenshots for interactive debugging.

**Features**:

- Console message logging
- Network request tracking
- Screenshots at each step
- Detailed state inspection
- Slower execution for observation

**Test Cases**:

1. Full flow with detailed logging
2. Rapid click cancellation test

## Running Tests

### Standard Tests

```bash
# Run all card identification tests
pnpm test:e2e card-identification.spec

# Run specific test
pnpm test:e2e -g "should display card result"

# Run in headed mode (see browser)
pnpm test:e2e card-identification.spec --headed

# Run in debug mode (step through)
pnpm test:e2e card-identification.spec --debug
```

### Debug Tests

```bash
# Run debug tests with detailed logging
pnpm test:e2e card-identification-debug.spec --headed

# Run specific debug test
pnpm test:e2e card-identification-debug.spec -g "full card identification flow"
```

## Using Chrome DevTools MCP Server for Debugging

The chrome-devtools MCP server can be used to inspect the browser state during test execution.

### Setup

1. Install the chrome-devtools MCP server (if not already installed)
2. Run tests in headed mode: `pnpm test:e2e --headed`
3. Use MCP tools to inspect:

```typescript
// Example MCP server usage (from your AI assistant)
// Take snapshot of page
mcp0_take_snapshot()

// Take screenshot
mcp0_take_screenshot({ fullPage: true })

// List console messages
mcp0_list_console_messages()

// List network requests
mcp0_list_network_requests()

// Evaluate JavaScript
mcp0_evaluate_script({
  function: `() => {
    const overlay = document.querySelector('canvas[width="640"][height="480"]')
    return { exists: !!overlay, dimensions: { width: overlay?.width, height: overlay?.height } }
  }`,
})
```

## Test Artifacts

Tests generate screenshots in `test-results/`:

### Standard Tests

- `card-result-displayed.png` - Card result after query
- `card-result-layout.png` - Layout verification

### Debug Tests

- `debug-01-page-load.png` - Initial page load
- `debug-02-model-loaded.png` - After CLIP model loads
- `debug-03-video-active.png` - Video stream active
- `debug-04-query-started.png` - Query in progress
- `debug-05-query-complete.png` - Query complete
- `debug-06-final-state.png` - Final state
- `debug-rapid-01/02/03.png` - Rapid click sequence
- `debug-rapid-final.png` - After rapid clicks

## Debugging Tips

### Model Not Loading

If tests timeout waiting for model:

1. Check network requests for `embeddings.i8bin` and `meta.json`
2. Verify files exist in `public/data/mtg-embeddings/v1.0/`
3. Check browser console for errors

### Card Not Detected

If green borders don't appear:

1. Verify OpenCV loaded: Check console for `cv` object
2. Check video is playing: Inspect video element state
3. Verify demo video has card visible

### Query Fails

If card identification fails:

1. Check console for base64 image log
2. Verify canvas dimensions (446x620)
3. Check CLIP model loaded successfully
4. Inspect network for embedding requests

### No Results Displayed

If card result doesn't appear:

1. Check React component tree in devtools
2. Verify CardResultDisplay is rendered
3. Check query state in React devtools
4. Look for error messages in console

## Expected Behavior

### Successful Flow

1. **Page Load** → Loading overlay appears
2. **Model Loading** → Progress messages shown
3. **Model Ready** → Loading overlay disappears
4. **Webcam Start** → Video stream appears
5. **Card Detection** → Green borders drawn
6. **Click Card** → Loading state briefly shown
7. **Query Complete** → Card result displayed with:
   - Card name
   - Set code (e.g., [LEA])
   - Similarity score (3 decimals)
   - Card image
   - Scryfall link

### Debug Logging

Console should show:

```
Cropped card image: data:image/png;base64,iVBORw0KG...
```

### Low Confidence

If score < 0.70:

```
Low confidence match. Try a clearer view of the card.
```

## Troubleshooting

### Test Hangs on Model Loading

- Increase timeout in `waitForClipModel()`
- Check if embeddings files are accessible
- Verify network is not blocking requests

### Flaky Tests

- Increase wait times in debug version
- Use `page.waitForFunction()` instead of `waitForTimeout()`
- Check for race conditions in query cancellation

### Screenshots Not Generated

- Ensure `test-results/` directory exists
- Check file permissions
- Verify screenshot path is correct

## CI/CD Integration

For continuous integration:

```yaml
# .github/workflows/e2e-tests.yml
- name: Run E2E Tests
  run: pnpm test:e2e card-identification.spec

- name: Upload Screenshots
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: test-screenshots
    path: test-results/
```

## Performance Benchmarks

Expected timings:

- Model loading: 5-15 seconds
- Card detection: < 1 second
- Query execution: 1-3 seconds
- Total test duration: 30-60 seconds

## Related Documentation

- [Feature Specification](../../../specs/007-refactor-card-cropping/spec.md)
- [Implementation Plan](../../../specs/007-refactor-card-cropping/plan.md)
- [Quickstart Guide](../../../specs/007-refactor-card-cropping/quickstart.md)

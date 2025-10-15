# Playwright Test Setup with Model Caching

This directory contains Playwright end-to-end tests with an optimized setup that caches the CLIP model and embeddings to significantly speed up test execution.

## Overview

The test suite now uses a **global setup** approach that:

1. **Initializes the model once** before all tests run
2. **Caches the model** in the browser's IndexedDB 
3. **Reuses the cached model** across all test runs
4. **Reduces test execution time** from ~60-120 seconds per test to ~5-10 seconds

## Architecture

### Global Setup (`global-setup.ts`)
- Runs once before all tests
- Navigates to a game page to trigger model initialization
- Waits for the CLIP model and embeddings to fully load
- Stores completion flags in localStorage
- Caches model files in browser IndexedDB

### Model Helpers (`helpers/model-helpers.ts`)
- `waitForModelReady()` - Fast model readiness check (uses cache when available)
- `waitForAllDependencies()` - Combined model + OpenCV readiness check
- `logModelCacheStatus()` - Debug logging for cache status
- `canUseCachedModel()` - Check if cached model can be used

### Updated Tests
All existing tests in `card-identification.spec.ts` have been updated to:
- Use `waitForAllDependencies()` instead of separate model/OpenCV waits
- Handle both cached and fresh model scenarios
- Log cache status for debugging

## Performance Benefits

| Scenario | Before | After |
|----------|--------|-------|
| First test run | 60-120s | 60-120s (one-time setup) |
| Subsequent tests | 60-120s each | 5-10s each |
| Full test suite | 10-20 minutes | 2-5 minutes |

## Usage

### Running Tests
```bash
# Run all tests (global setup runs automatically)
pnpm test:e2e

# Run specific test file
pnpm playwright test card-identification.spec.ts

# Run validation tests
pnpm playwright test validate-setup.spec.ts
```

### Debugging
The tests include extensive logging to help debug cache behavior:

```bash
# Run with debug output
DEBUG=pw:api pnpm playwright test --headed
```

Look for log messages like:
- `📊 Model Cache Status: { setupComplete: true, canUseCache: true }`
- `✅ Model ready from cache!`
- `🔄 Model loading in progress, waiting for completion...`

## Files

- `global-setup.ts` - Global setup that initializes and caches the model
- `helpers/model-helpers.ts` - Helper functions for model state management
- `card-identification.spec.ts` - Updated main test suite
- `validate-setup.spec.ts` - Tests to validate the caching system works
- `README.md` - This documentation

## Configuration

The global setup is configured in `playwright.config.ts`:

```typescript
export default defineConfig({
  globalSetup: require.resolve('./tests/global-setup.ts'),
  // ... other config
})
```

## Troubleshooting

### Cache Not Working
If tests are still slow, check:
1. Global setup completed successfully (check console logs)
2. localStorage flags are set (`playwright-model-setup-complete`)
3. IndexedDB contains transformers cache
4. Network requests aren't re-downloading model files

### Model Loading Failures
If model loading fails:
1. Check network connectivity to Hugging Face CDN
2. Verify CORS settings allow model downloads
3. Check browser console for detailed error messages
4. Try clearing browser cache and re-running

### Test Flakiness
If tests become flaky:
1. Increase timeouts in model helpers if needed
2. Check that video assets are properly loaded
3. Verify OpenCV initialization isn't interfering with model cache

## Future Improvements

- Add global teardown to clean up cache if needed
- Implement cache versioning for model updates
- Add metrics collection for cache hit rates
- Consider pre-warming additional browser contexts

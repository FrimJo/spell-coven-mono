import { test, expect } from '@playwright/test';
import path from 'path';

// Option B: Override getUserMedia to stream from a prerecorded video via captureStream().
// Place your file at tests/assets/card_demo.webm (or .mp4) and update videoUrl if needed.
const VIDEO_RELATIVE = 'tests/assets/card_demo.webm';

// Helper to wait for OpenCV readiness via window.cvReadyPromise
async function waitForOpenCv(page) {
  await page.waitForFunction(() => (window as any).cvReadyPromise?.then?.(() => true));
}

// Add an init script that monkey-patches getUserMedia
async function mockGetUserMedia(page, videoUrl: string) {
  await page.addInitScript(({ videoUrl }) => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (_constraints: MediaStreamConstraints) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      (video as any).playsInline = true;
      await video.play();
      const stream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
      if (!stream) {
        return original(_constraints);
      }
      return stream as MediaStream;
    };
  }, { videoUrl });
}

// Main E2E test
test.describe('Webcam click-and-search (mocked getUserMedia)', () => {
  test.use({ permissions: ['camera'] });

  test('click a detected card and search', async ({ page, baseURL }) => {
    const videoUrl = `${baseURL}/${VIDEO_RELATIVE}`;

    await mockGetUserMedia(page, videoUrl);

    await page.goto(`${baseURL}/index.html`);
    await waitForOpenCv(page);

    // Start webcam via UI
    await page.locator('#startCamBtn').click();

    // Allow some frames for detection
    await page.waitForTimeout(1000);

    // Click near expected card position (tweak after you add the real video)
    await page.mouse.click(320, 240);

    // Trigger search
    await page.locator('#searchCroppedBtn').click();

    // Verify at least one result appears
    await expect(page.locator('[data-test="result-item"]').first()).toBeVisible({ timeout: 20_000 });
  });
});

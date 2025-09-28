import { test, expect, Page } from '@playwright/test';
import { readFile } from 'fs/promises';
import path from 'path';

// Load the demo video from the local filesystem and pass it to the page as a data URL.
// Place your file at tests/assets/card_demo.webm
const VIDEO_RELATIVE = 'tests/assets/card_demo.webm';

// Helper to wait for app readiness by checking status text rendered by the app.
async function waitForOpenCv(page: Page) {
  await expect(page.getByText('OpenCV ready')).toBeVisible({ timeout: 180_000 });
}

// Add an init script that monkey-patches getUserMedia
async function mockGetUserMedia(page: Page, videoUrl: string) {
  await page.addInitScript(({ videoUrl }: { videoUrl: string }) => {
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
    // Build a data URL for the demo video to avoid relying on server static paths
    const videoPath = path.join(process.cwd(), VIDEO_RELATIVE);
    const bytes = await readFile(videoPath);
    const base64 = bytes.toString('base64');
    const videoUrl = `data:video/webm;base64,${base64}`;

    await mockGetUserMedia(page, videoUrl);

    await page.goto(`${baseURL}/`);
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

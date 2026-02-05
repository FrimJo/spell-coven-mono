import { expect, test } from '@playwright/test'

import {
  AUTH_STATE_PATH,
  getRoomId,
  hasAuthStorageState,
  mockGetUserMedia,
  mockMediaDevices,
  navigateToTestGame,
} from '../helpers/test-utils'

/**
 * Duplicate session dialog e2e tests.
 */
test.describe('Duplicate Session Dialog', () => {
  test.use({ permissions: ['camera', 'microphone'] })

  test('transfer here keeps the new tab and closes the original', async ({
    browser,
    baseURL,
  }) => {
    if (!hasAuthStorageState()) {
      test.skip(
        'Auth storage state missing. Run auth.setup.ts or the full Playwright project chain.',
      )
    }
    if (!baseURL) {
      test.skip('Playwright baseURL is not configured.')
    }

    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      baseURL,
    })
    const page1 = await context.newPage()
    const page2 = await context.newPage()

    await mockMediaDevices(page1)
    await mockGetUserMedia(page1)
    await mockMediaDevices(page2)
    await mockGetUserMedia(page2)

    const roomId = getRoomId()

    await navigateToTestGame(page1, roomId)
    await navigateToTestGame(page2, roomId)

    const dialogTitle = page2.getByText('Already Connected', { exact: true })
    await expect(dialogTitle).toBeVisible({ timeout: 10000 })

    await page2.getByRole('button', { name: 'Transfer here' }).click()
    await expect(dialogTitle).toBeHidden({ timeout: 10000 })

    await expect(page2).toHaveURL(new RegExp(`/game/${roomId}$`))
    await expect(page1).toHaveURL(/\/$/, { timeout: 10000 })

    await context.close()
  })

  test('return to home keeps the original tab connected', async ({
    browser,
    baseURL,
  }) => {
    if (!hasAuthStorageState()) {
      test.skip(
        'Auth storage state missing. Run auth.setup.ts or the full Playwright project chain.',
      )
    }
    if (!baseURL) {
      test.skip('Playwright baseURL is not configured.')
    }

    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      baseURL,
    })
    const page1 = await context.newPage()
    const page2 = await context.newPage()

    await mockMediaDevices(page1)
    await mockGetUserMedia(page1)
    await mockMediaDevices(page2)
    await mockGetUserMedia(page2)

    const roomId = getRoomId()

    await navigateToTestGame(page1, roomId)
    await navigateToTestGame(page2, roomId)

    const dialogTitle = page2.getByText('Already Connected', { exact: true })
    await expect(dialogTitle).toBeVisible({ timeout: 10000 })

    await page2.getByRole('button', { name: 'Return to Home' }).click()

    await expect(page2).toHaveURL(/\/$/, { timeout: 10000 })
    await expect(page1).toHaveURL(new RegExp(`/game/${roomId}$`))
    await expect(
      page1.getByText('Already Connected', { exact: true }),
    ).toBeHidden({ timeout: 10000 })

    await context.close()
  })
})

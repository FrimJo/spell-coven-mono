import { expect, test } from '../helpers/fixtures'
import {
  getOrCreateRoomId,
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
    page: page1,
    context,
  }) => {
    if (!hasAuthStorageState()) {
      test.skip(
        true,
        'Auth storage state missing. Run auth.setup.ts or the full Playwright project chain.',
      )
    }

    const page2 = await context.newPage()

    await mockMediaDevices(page1)
    await mockGetUserMedia(page1)
    await mockMediaDevices(page2)
    await mockGetUserMedia(page2)

    const roomId = await getOrCreateRoomId(page1, {
      fresh: true,
      persist: false,
    })

    await navigateToTestGame(page1, roomId, {
      handleDuplicateSession: 'transfer',
    })
    // Wait for game room to load before checking header controls
    await expect(page1.getByText(roomId)).toBeVisible({ timeout: 10000 })
    await expect(page1.getByTestId('leave-game-button')).toBeVisible({
      timeout: 10000,
    })
    await navigateToTestGame(page2, roomId)

    const dialogTitle = page2.getByText('Already Connected', { exact: true })
    await expect(dialogTitle).toBeVisible({ timeout: 10000 })

    await page2.getByRole('button', { name: 'Transfer here' }).click()
    await expect(dialogTitle).toBeHidden({ timeout: 10000 })

    await expect(page2).toHaveURL(new RegExp(`/game/${roomId}$`))
    await expect(page1).toHaveURL(/\/$/, { timeout: 10000 })
  })

  test('return to home keeps the original tab connected', async ({
    page: page1,
    context,
  }) => {
    if (!hasAuthStorageState()) {
      test.skip(
        true,
        'Auth storage state missing. Run auth.setup.ts or the full Playwright project chain.',
      )
    }

    const page2 = await context.newPage()

    await mockMediaDevices(page1)
    await mockGetUserMedia(page1)
    await mockMediaDevices(page2)
    await mockGetUserMedia(page2)

    const roomId = await getOrCreateRoomId(page1, {
      fresh: true,
      persist: false,
    })

    await navigateToTestGame(page1, roomId, {
      handleDuplicateSession: 'transfer',
    })
    // Wait for game room to load before checking header controls
    await expect(page1.getByText(roomId)).toBeVisible({ timeout: 10000 })
    await expect(page1.getByTestId('leave-game-button')).toBeVisible({
      timeout: 10000,
    })
    await navigateToTestGame(page2, roomId)

    const dialogTitle = page2.getByText('Already Connected', { exact: true })
    await expect(dialogTitle).toBeVisible({ timeout: 10000 })

    await page2.getByRole('button', { name: 'Return to Home' }).click()

    await expect(page2).toHaveURL(/\/$/, { timeout: 10000 })
    await expect(page1).toHaveURL(new RegExp(`/game/${roomId}$`))
  })

  test('escape key does not dismiss duplicate-session dialog', async ({
    page: page1,
    context,
  }) => {
    if (!hasAuthStorageState()) {
      test.skip(
        true,
        'Auth storage state missing. Run auth.setup.ts or the full Playwright project chain.',
      )
    }

    const page2 = await context.newPage()

    await mockMediaDevices(page1)
    await mockGetUserMedia(page1)
    await mockMediaDevices(page2)
    await mockGetUserMedia(page2)

    const roomId = await getOrCreateRoomId(page1, {
      fresh: true,
      persist: false,
    })

    await navigateToTestGame(page1, roomId, {
      handleDuplicateSession: 'transfer',
    })
    await expect(page1.getByText(roomId)).toBeVisible({ timeout: 10000 })

    await navigateToTestGame(page2, roomId)
    const dialogTitle = page2.getByText('Already Connected', { exact: true })
    await expect(dialogTitle).toBeVisible({ timeout: 10000 })

    await page2.keyboard.press('Escape')
    await expect(dialogTitle).toBeVisible()

    await expect(page2).toHaveURL(new RegExp(`/game/${roomId}$`))
    await expect(page1).toHaveURL(new RegExp(`/game/${roomId}$`))
  })
})

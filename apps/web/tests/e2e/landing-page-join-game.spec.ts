import { expect, test } from '../helpers/fixtures'
import { getOrCreateRoomId, STORAGE_KEYS } from '../helpers/test-utils'

/**
 * Join Game Dialog e2e tests.
 *
 * Isolated in its own file so the worker gets a fresh user identity
 * with no active room – guaranteeing the plain "Join Game" button is
 * rendered rather than the "Rejoin Game" variant.
 */
test.describe('Join Game Dialog', () => {
  /**
   * Helper: open the Join dialog from the landing page.
   * Assumes the page is already on `/` and authenticated with no active room.
   */
  async function openJoinDialog(page: import('@playwright/test').Page) {
    await page.getByTestId('join-game-button').click()
    await expect(page.getByTestId('join-game-dialog')).toBeVisible({
      timeout: 5000,
    })
  }

  /** Seed media preferences so setup redirect is bypassed after join. */
  async function seedMediaPrefs(page: import('@playwright/test').Page) {
    await page.evaluate((key) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          videoinput: 'mock-camera-1',
          audioinput: 'mock-mic-1',
          audiooutput: 'mock-speaker-1',
          timestamp: Date.now(),
        }),
      )
    }, STORAGE_KEYS.MEDIA_DEVICES)
  }

  test('should open dialog with MTG-themed heading and disabled submit', async ({
    page,
  }) => {
    await page.goto('/')
    await openJoinDialog(page)

    await expect(
      page.getByRole('heading', { name: /Enter the Battlefield/i }),
    ).toBeVisible()

    const submitButton = page.getByTestId('join-game-submit-button')
    await expect(submitButton).toBeDisabled()
  })

  test('should show validation error for empty submission', async ({
    page,
  }) => {
    await page.goto('/')
    await openJoinDialog(page)

    const submitButton = page.getByTestId('join-game-submit-button')
    await expect(submitButton).toBeDisabled()

    const input = page.getByTestId('join-game-id-input')
    await input.fill('   ')
    await expect(submitButton).toBeDisabled()
  })

  test('should show format validation error for too-short code', async ({
    page,
  }) => {
    await page.goto('/')
    await openJoinDialog(page)

    const input = page.getByTestId('join-game-id-input')
    await input.fill('ABC')
    await page.getByTestId('join-game-submit-button').click()

    await expect(page.getByTestId('join-game-validation-error')).toBeVisible()
    await expect(page.getByText(/6 characters/i)).toBeVisible()
  })

  test('should enforce maxLength on input so overly-long codes are truncated', async ({
    page,
  }) => {
    await page.goto('/')
    await openJoinDialog(page)

    const input = page.getByTestId('join-game-id-input')
    await input.fill('ABCDEFGHIJ')

    // maxLength=6 truncates the value
    await expect(input).toHaveValue('ABCDEF')
  })

  test('should show format validation error for special characters', async ({
    page,
  }) => {
    await page.goto('/')
    await openJoinDialog(page)

    const input = page.getByTestId('join-game-id-input')
    await input.fill('AB#12!')
    await page.getByTestId('join-game-submit-button').click()

    await expect(page.getByTestId('join-game-validation-error')).toBeVisible()
  })

  test('should normalize lowercase input and validate room existence', async ({
    page,
  }) => {
    const roomId = await getOrCreateRoomId(page, {
      fresh: true,
      persist: false,
    })
    await page.goto('/')
    await seedMediaPrefs(page)
    await openJoinDialog(page)

    const input = page.getByTestId('join-game-id-input')
    await input.fill(roomId.toLowerCase())
    await page.getByTestId('join-game-submit-button').click()

    // Should show loading state
    await expect(page.getByText(/Searching the Multiverse/i)).toBeVisible({
      timeout: 5000,
    })

    // Should transition to success
    await expect(page.getByText(/found/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('join-game-enter-button')).toBeVisible()

    await page.getByTestId('join-game-enter-button').click()
    await expect(page).toHaveURL(`/game/${roomId}`)
  })

  test('should show spinner during room validation and disable controls', async ({
    page,
  }) => {
    const roomId = await getOrCreateRoomId(page, {
      fresh: true,
      persist: false,
    })
    await page.goto('/')
    await openJoinDialog(page)

    const input = page.getByTestId('join-game-id-input')
    const submitButton = page.getByTestId('join-game-submit-button')

    await input.fill(roomId)
    await submitButton.click()

    // During checking: input should be disabled, spinner text should appear
    await expect(input).toBeDisabled({ timeout: 2000 })
    await expect(page.getByText(/Searching the Multiverse/i)).toBeVisible()

    // Wait for check to finish (success or not)
    await expect(page.getByText(/found|faded/i)).toBeVisible({
      timeout: 15000,
    })
  })

  test('should show themed error for non-existent room and allow retry', async ({
    page,
  }) => {
    await page.goto('/')
    await openJoinDialog(page)

    const input = page.getByTestId('join-game-id-input')
    await input.fill('ZZZZ99')
    await page.getByTestId('join-game-submit-button').click()

    // Should show loading then error
    await expect(page.getByText(/faded from the multiverse/i)).toBeVisible({
      timeout: 15000,
    })

    // "Try a Different Code" button should be visible
    const tryAgainButton = page.getByTestId('join-game-try-again-button')
    await expect(tryAgainButton).toBeVisible()
    await tryAgainButton.click()

    // Should return to input phase with input enabled
    await expect(input).toBeEnabled()
  })

  test('should clear validation error when user types new input', async ({
    page,
  }) => {
    await page.goto('/')
    await openJoinDialog(page)

    const input = page.getByTestId('join-game-id-input')
    await input.fill('BAD')
    await page.getByTestId('join-game-submit-button').click()

    await expect(page.getByTestId('join-game-validation-error')).toBeVisible()

    // Start typing — error should clear
    await input.fill('ABCD')
    await expect(
      page.getByTestId('join-game-validation-error'),
    ).not.toBeVisible()
  })

  test('should reset state when dialog is reopened', async ({ page }) => {
    await page.goto('/')
    await openJoinDialog(page)

    const input = page.getByTestId('join-game-id-input')
    await input.fill('BAD')
    await page.getByTestId('join-game-submit-button').click()
    await expect(page.getByTestId('join-game-validation-error')).toBeVisible()

    // Close and reopen dialog
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('join-game-dialog')).not.toBeVisible()

    await openJoinDialog(page)

    // Should be clean: no error, empty input, submit disabled
    await expect(
      page.getByTestId('join-game-validation-error'),
    ).not.toBeVisible()
    await expect(input).toHaveValue('')
    await expect(page.getByTestId('join-game-submit-button')).toBeDisabled()
  })

  test('should validate and navigate for a valid existing room (full happy path)', async ({
    page,
  }) => {
    const roomId = await getOrCreateRoomId(page, {
      fresh: true,
      persist: false,
    })
    await page.goto('/')
    await seedMediaPrefs(page)
    await openJoinDialog(page)

    const input = page.getByTestId('join-game-id-input')
    await input.fill(roomId)
    await page.getByTestId('join-game-submit-button').click()

    // Wait for success
    await expect(page.getByTestId('join-game-enter-button')).toBeVisible({
      timeout: 15000,
    })

    await page.getByTestId('join-game-enter-button').click()
    await expect(page).toHaveURL(`/game/${roomId}`)
  })
})

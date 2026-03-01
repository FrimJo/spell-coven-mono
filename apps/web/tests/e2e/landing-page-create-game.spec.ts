import { expect, test } from '../helpers/fixtures'
import { setDesktopViewport } from '../helpers/test-utils'

test.describe('Landing Page – Authenticated Actions', () => {
  test('should create a game and show a shareable room link', async ({
    page,
  }) => {
    await setDesktopViewport(page)
    await page.goto('/')

    const createButton = page.getByTestId('create-game-button')
    await expect(createButton).toBeVisible({ timeout: 10000 })
    await createButton.click()

    await expect(page.getByText('Game room created successfully!')).toBeVisible(
      {
        timeout: 20000,
      },
    )
    await expect(page.getByText(/\/game\/[A-Z0-9]{6}/)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Enter Game Room/i }),
    ).toBeEnabled()
  })
})

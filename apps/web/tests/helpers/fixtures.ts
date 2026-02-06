import { readFileSync } from 'fs'
import { test as base, expect } from '@playwright/test'

import { ensureWorkerStorageState } from './auth-storage'

type WorkerFixtures = {
  storageStatePath: string
  useAuth: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- no test-scoped fixtures, only worker
export const test = base.extend<{}, WorkerFixtures>({
  useAuth: [true, { option: true, scope: 'worker' }],
  storageStatePath: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture callback, not React
    async ({}, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL as string | undefined
      if (!baseURL) {
        throw new Error('baseURL is required to build storage state.')
      }
      const storageStatePath = await ensureWorkerStorageState(
        workerInfo.workerIndex,
        baseURL,
      )
      await use(storageStatePath)
    },
    { scope: 'worker' },
  ],

  context: async ({ browser, storageStatePath, useAuth }, use, testInfo) => {
    const context = await browser.newContext({
      ...testInfo.project.use,
      storageState: useAuth ? storageStatePath : undefined,
    })
    if (useAuth && storageStatePath) {
      const baseURL = testInfo.project.use.baseURL as string | undefined
      if (baseURL) {
        const { origin } = new URL(baseURL)
        const state = JSON.parse(readFileSync(storageStatePath, 'utf-8')) as {
          origins?: Array<{
            origin: string
            localStorage?: Array<{ name: string; value: string }>
          }>
        }
        const originState = state.origins?.find((o) => o.origin === origin)
        if (originState?.localStorage?.length) {
          const authItems = originState.localStorage.filter((item) =>
            item.name.startsWith('__convexAuth'),
          )
          if (authItems.length) {
            await context.addInitScript(
              ({ items }) => {
                for (const { name, value } of items) {
                  localStorage.setItem(name, value)
                }
              },
              { items: authItems },
            )
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback, not React
    await use(context)
    await context.close()
  },
})

export { expect }

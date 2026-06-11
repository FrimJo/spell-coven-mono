import type { Browser, BrowserContext, Page } from '@playwright/test'
import { chromium } from '@playwright/test'

import {
  addCommittedMediaPreferencesInitScript,
  mockGetUserMediaWithTone,
  mockMediaDevices,
} from './test-utils'

export type PlayerHandle = {
  browser: Browser
  context: BrowserContext
  page: Page
}

export async function launchPlayer(options: {
  baseURL: string
  storageStatePath: string
  toneHz: number
  label: string
}): Promise<PlayerHandle> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })

  const context = await browser.newContext({
    baseURL: options.baseURL,
    permissions: ['camera', 'microphone'],
    storageState: options.storageStatePath,
  })

  const page = await context.newPage()

  await mockMediaDevices(page)
  await mockGetUserMediaWithTone(page, {
    toneHz: options.toneHz,
    label: options.label,
  })

  await addCommittedMediaPreferencesInitScript(page)

  return { browser, context, page }
}

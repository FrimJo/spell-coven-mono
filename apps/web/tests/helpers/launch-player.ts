import type { Browser, BrowserContext, Page } from '@playwright/test'
import { chromium } from '@playwright/test'

import {
  mockGetUserMediaWithTone,
  mockMediaDevices,
  STORAGE_KEYS,
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

  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          videoinput: 'mock-camera-1',
          audioinput: 'mock-mic-1',
          audiooutput: 'mock-speaker-1',
          videoEnabled: true,
          audioEnabled: true,
          timestamp: Date.now(),
        }),
      )
    },
    { key: STORAGE_KEYS.MEDIA_DEVICES },
  )

  return { browser, context, page }
}

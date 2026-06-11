import type { Page } from '@playwright/test'

import type { PersistedMediaDeviceState } from '../../src/hooks/useMediaPreferenceStore'
import { MEDIA_DEVICE_STORAGE_KEY } from '../../src/hooks/useMediaPreferenceStore'

export { MEDIA_DEVICE_STORAGE_KEY }

/** Committed localStorage seed: device ids + timestamp only (enabled flags are session-only). */
export type MediaPreferenceSeed = Required<
  Pick<PersistedMediaDeviceState, 'videoinput' | 'audioinput' | 'audiooutput'>
> & {
  timestamp: number
}

export function createCommittedMediaPreferenceSeed(
  overrides: Partial<MediaPreferenceSeed> = {},
): MediaPreferenceSeed {
  return {
    videoinput: 'mock-camera-1',
    audioinput: 'mock-mic-1',
    audiooutput: 'mock-speaker-1',
    timestamp: Date.now(),
    ...overrides,
  }
}

export async function addCommittedMediaPreferencesInitScript(
  page: Page,
  overrides: Partial<MediaPreferenceSeed> = {},
  options: { preserveExisting?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ key, preferences, preserveExisting }) => {
      if (preserveExisting) {
        try {
          const existing = localStorage.getItem(key)
          if (existing) {
            const parsed = JSON.parse(existing)
            if (parsed?.timestamp) return
            localStorage.setItem(
              key,
              JSON.stringify({
                ...parsed,
                ...preferences,
                timestamp: Date.now(),
              }),
            )
            return
          }
        } catch {
          // Ignore parse errors and fall back to a clean committed seed.
        }
      }

      localStorage.setItem(key, JSON.stringify(preferences))
    },
    {
      key: MEDIA_DEVICE_STORAGE_KEY,
      preferences: createCommittedMediaPreferenceSeed(overrides),
      preserveExisting: options.preserveExisting ?? false,
    },
  )
}

export async function setCommittedMediaPreferences(
  page: Page,
  overrides: Partial<MediaPreferenceSeed> = {},
): Promise<void> {
  await page.evaluate(
    ({ key, preferences }) => {
      localStorage.setItem(key, JSON.stringify(preferences))
    },
    {
      key: MEDIA_DEVICE_STORAGE_KEY,
      preferences: createCommittedMediaPreferenceSeed(overrides),
    },
  )
}

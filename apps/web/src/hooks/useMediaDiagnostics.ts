/**
 * useMediaDiagnostics - publishes a media diagnostics snapshot to `window` for
 * the e2e harness, isolated from the production RoomMedia provider.
 *
 * Gated behind `isMediaDiagnosticsEnabled` (VITE_MEDIA_DIAGNOSTICS). The window
 * write and the `window` cast live here so the provider stays clean.
 */
import type {
  MediaDiagnosticsSnapshot,
  RoomMediaSessionState,
} from '@/types/media-session'
import { useEffect, useMemo } from 'react'
import { isMediaDiagnosticsEnabled } from '@/env'
import { createMediaDiagnosticsSnapshot } from '@/lib/media/media-diagnostics'

interface MediaDiagnosticsWindow extends Window {
  __spellCovenMediaDiagnostics?: MediaDiagnosticsSnapshot
}

export function useMediaDiagnostics(mediaSession: RoomMediaSessionState): void {
  // The adapter emits a fresh state object on every change, so depending on the
  // whole session is honest and avoids the illusion of finer-grained memoization.
  const diagnostics = useMemo(
    () =>
      isMediaDiagnosticsEnabled
        ? createMediaDiagnosticsSnapshot(mediaSession)
        : null,
    [mediaSession],
  )

  useEffect(() => {
    if (!diagnostics) return
    ;(window as MediaDiagnosticsWindow).__spellCovenMediaDiagnostics =
      diagnostics
  }, [diagnostics])
}

/**
 * Returns whether the user is on a Mac-like platform for keyboard shortcut display.
 * Mac uses ⌘ (Cmd), Windows/Linux use Ctrl.
 */
function getIsMac(): boolean {
  if (typeof navigator === 'undefined') return true // SSR: default to Mac for initial paint
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ??
    navigator.platform ??
    ''
  const ua = navigator.userAgent ?? ''
  return (
    /Mac|iPod|iPhone|iPad/i.test(platform) || /Mac|iPod|iPhone|iPad/i.test(ua)
  )
}

/** Shortcut label for search: "⌘K" on Mac, "Ctrl+K" on Windows/Linux */
export function useSearchShortcutLabel(): string {
  return getIsMac() ? '⌘K' : 'Ctrl+K'
}

/**
 * Returns the modifier symbol and key for the search shortcut.
 * Mac: { modifier: '⌘', key: 'K' }
 * Windows/Linux: { modifier: 'Ctrl', key: 'K' }
 */
export function useSearchShortcutParts(): { modifier: string; key: string } {
  return getIsMac()
    ? { modifier: '⌘', key: 'K' }
    : { modifier: 'Ctrl', key: 'K' }
}

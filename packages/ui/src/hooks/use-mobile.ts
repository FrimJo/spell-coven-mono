import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const getSnapshot = () =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
      : false

  const getServerSnapshot = () => false

  const subscribe = (listener: () => void) => {
    if (typeof window === 'undefined') {
      return () => undefined
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

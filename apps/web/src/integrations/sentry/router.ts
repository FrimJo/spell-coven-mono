import type { Router } from '@tanstack/react-router'
import * as Sentry from '@sentry/react'

let unsubscribe: (() => void) | null = null

export function registerSentryRouterInstrumentation(router: Router) {
  if (unsubscribe) return

  let lastLocationKey = router.state.location.key

  unsubscribe = router.subscribe(() => {
    const nextLocation = router.state.location
    if (nextLocation.key === lastLocationKey) return

    lastLocationKey = nextLocation.key

    Sentry.setTag('route', nextLocation.pathname)
    Sentry.setContext('route', {
      pathname: nextLocation.pathname,
      search: nextLocation.searchStr,
      hash: nextLocation.hash,
    })

    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `Route change to ${nextLocation.pathname}`,
      level: 'info',
    })
  })
}

export function unregisterSentryRouterInstrumentation() {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
}

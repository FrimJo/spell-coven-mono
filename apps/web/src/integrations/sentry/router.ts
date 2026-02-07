import type { AnyRouter } from '@tanstack/react-router'
import * as Sentry from '@sentry/react'

let unsubscribe: (() => void) | null = null

export function registerSentryRouterInstrumentation(router: AnyRouter) {
  if (unsubscribe) return

  unsubscribe = router.subscribe('onResolved', (event) => {
    const location = event.toLocation

    Sentry.setTag('route', location.pathname)
    Sentry.setContext('route', {
      pathname: location.pathname,
      search: location.searchStr,
      hash: location.hash,
    })

    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `Route change to ${location.pathname}`,
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

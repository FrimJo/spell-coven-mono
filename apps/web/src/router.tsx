import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { ErrorPage } from './components/ErrorPage.js'
import { NotFoundPage } from './components/NotFoundPage.js'
import * as TanstackQuery from './integrations/tanstack-query/root-provider.js'
import { registerSentryRouterInstrumentation } from './integrations/sentry/router.js'
// Import the generated route tree
import { routeTree } from './routeTree.gen.js'

// Create a new router instance
export const getRouter = () => {
  const rqContext = TanstackQuery.getContext()

  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { ...rqContext },
    defaultPreload: 'intent',
    defaultNotFoundComponent: NotFoundPage,
    defaultErrorComponent: ErrorPage,
    Wrap: (props: { children: React.ReactNode }) => {
      return (
        <TanstackQuery.Provider {...rqContext}>
          {props.children}
        </TanstackQuery.Provider>
      )
    },
  })

  setupRouterSsrQueryIntegration({ router, queryClient: rqContext.queryClient })
  registerSentryRouterInstrumentation(router)

  return router
}

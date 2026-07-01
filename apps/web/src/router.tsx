import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { registerSentryRouterInstrumentation } from './integrations/sentry/router.js'
import { getContext } from './integrations/tanstack-query/context.js'
import { Provider } from './integrations/tanstack-query/root-provider.js'
// Import the generated route tree
import { routeTree } from './routeTree.gen.js'

// Create a new router instance
export const getRouter = () => {
  const rqContext = getContext()

  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { ...rqContext },
    defaultPreload: 'intent',
    Wrap: (props: { children: React.ReactNode }) => {
      return <Provider {...rqContext}>{props.children}</Provider>
    },
  })

  setupRouterSsrQueryIntegration({ router, queryClient: rqContext.queryClient })
  registerSentryRouterInstrumentation(router)

  return router
}

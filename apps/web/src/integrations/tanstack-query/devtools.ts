import type { TanStackDevtoolsReactPlugin } from '@tanstack/react-devtools'
import { createElement } from 'react'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'

const tanstackQueryDevtools: TanStackDevtoolsReactPlugin = {
  name: 'Tanstack Query',
  render: createElement(ReactQueryDevtoolsPanel),
}

export default tanstackQueryDevtools

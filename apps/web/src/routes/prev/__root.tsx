import { createRootRoute, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createRootRoute('/prev/__root')({
  component: () => <Outlet />,
})

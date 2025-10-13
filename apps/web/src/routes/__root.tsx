import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div className="dark min-h-screen">
      <Outlet />
    </div>
  ),
})

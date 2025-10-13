import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div className="dark min-h-screen bg-slate-950">
      <Outlet />
    </div>
  ),
})

import { MediaSetupPage } from '@/components/MediaSetupPage'
import { MediaStreamProvider } from '@/contexts/MediaStreamContext'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

// Validate returnTo is a safe internal path (starts with /)
const setupSearchSchema = z.object({
  returnTo: z
    .string()
    .optional()
    .default('/')
    .refine(
      (path) => path.startsWith('/'),
      'returnTo must be an internal path starting with /',
    ),
})

export const Route = createFileRoute('/_authed/setup')({
  component: SetupRoute,
  validateSearch: zodValidator(setupSearchSchema),
})

function SetupRoute() {
  const { returnTo } = Route.useSearch()
  const navigate = useNavigate()

  const handleComplete = () => {
    // Navigate to the intended destination after setup completes
    navigate({ to: returnTo })
  }

  const handleCancel = () => {
    // Navigate to landing page when user cancels
    navigate({ to: '/' })
  }

  return (
    <MediaStreamProvider>
      <MediaSetupPage onComplete={handleComplete} onCancel={handleCancel} />
    </MediaStreamProvider>
  )
}

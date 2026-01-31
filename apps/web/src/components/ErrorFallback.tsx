import { Button } from '@repo/ui/components/button'

interface ErrorFallbackProps {
  error?: Error
  resetErrorBoundary?: () => void
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
      {error && <p className="text-text-muted">{error.message}</p>}
      {resetErrorBoundary && (
        <Button
          onClick={resetErrorBoundary}
          className="bg-info text-white hover:bg-info"
        >
          Try again
        </Button>
      )}
    </div>
  )
}

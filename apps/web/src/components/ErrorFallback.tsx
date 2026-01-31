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
      {error && <p className="text-gray-400">{error.message}</p>}
      {resetErrorBoundary && (
        <Button
          onClick={resetErrorBoundary}
          className="bg-blue-500 text-white hover:bg-blue-600"
        >
          Try again
        </Button>
      )}
    </div>
  )
}

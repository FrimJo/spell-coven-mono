export interface LoadingOverlayProps {
  /** Whether overlay is visible */
  isVisible: boolean
  /** Progress message to display */
  message: string
}

export function LoadingOverlay({ isVisible, message }: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div
      className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative h-12 w-12">
          <div className="border-muted absolute inset-0 rounded-full border-4" />
          <div className="border-primary absolute inset-0 animate-spin rounded-full border-4 border-t-transparent" />
        </div>

        {/* Message */}
        {message && (
          <p className="text-muted-foreground text-sm font-medium">{message}</p>
        )}
      </div>
    </div>
  )
}

LoadingOverlay.displayName = 'LoadingOverlay'

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
      className="inset-0 backdrop-blur-sm fixed z-50 flex items-center justify-center bg-background/80"
      role="dialog"
      aria-modal="true"
      aria-label="Loading"
    >
      <div className="gap-4 flex flex-col items-center">
        {/* Spinner */}
        <div className="h-12 w-12 relative">
          <div className="inset-0 absolute rounded-full border-4 border-muted" />
          <div className="inset-0 animate-spin absolute rounded-full border-4 border-primary border-t-transparent" />
        </div>

        {/* Message */}
        {message && (
          <p className="text-sm font-medium text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  )
}

LoadingOverlay.displayName = 'LoadingOverlay'

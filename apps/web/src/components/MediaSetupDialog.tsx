/**
 * MediaSetupDialog - Dialog wrapper around MediaSetupPanel
 *
 * This component wraps the shared MediaSetupPanel in a Dialog for use
 * in the Game Room settings. For full-page setup, use MediaSetupPanel directly.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

import { MediaSetupPanel } from './MediaSetupPanel'

interface MediaSetupDialogProps {
  open: boolean
  onComplete: () => void
  /** Called when user explicitly cancels (X button or skip). If not provided, calls onComplete. */
  onCancel?: () => void
}

export function MediaSetupDialog({
  open,
  onComplete,
  onCancel,
}: MediaSetupDialogProps) {
  // MediaSetupDialog is always used for in-game settings (Game Room modal).
  // Initial setup uses MediaSetupPanel directly via MediaSetupPage.
  // So we always want restore behavior on cancel.
  const isInGameSettings = true

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      // Default cancel behavior: just close the dialog
      onComplete()
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="border-muted bg-surface-1 sm:max-w-[700px] [&>button]:hidden"
        data-testid="media-setup-dialog"
      >
        {/* Hidden header for accessibility - visual header is in MediaSetupPanel */}
        <DialogHeader className="sr-only">
          <DialogTitle>Setup Audio & Video</DialogTitle>
          <DialogDescription>
            Configure your camera and audio devices
          </DialogDescription>
        </DialogHeader>

        <MediaSetupPanel
          onComplete={onComplete}
          onCancel={handleCancel}
          isInGameSettings={isInGameSettings}
          showHeader={true}
          showFooter={true}
        />
      </DialogContent>
    </Dialog>
  )
}

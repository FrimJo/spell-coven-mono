/**
 * MediaSetupPage - Full-page media setup experience
 *
 * Uses MediaSetupPanel directly (not in a dialog) for initial setup flow.
 * Shows a cancel warning dialog when user tries to leave without completing.
 */

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog'

import { MediaSetupPanel } from './MediaSetupPanel'

interface MediaSetupPageProps {
  onComplete: () => void
  onCancel: () => void
}

export function MediaSetupPage({ onComplete, onCancel }: MediaSetupPageProps) {
  const [showCancelWarning, setShowCancelWarning] = useState(false)

  const handlePanelCancel = () => {
    // Show warning dialog before navigating away
    setShowCancelWarning(true)
  }

  const handleConfirmCancel = () => {
    setShowCancelWarning(false)
    onCancel()
  }

  const handleDismissWarning = () => {
    setShowCancelWarning(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0">
      {/* Background gradient */}
      <div className="inset-0 pointer-events-none absolute overflow-hidden">
        <div className="blur-3xl absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-brand/10" />
        <div className="blur-3xl absolute -right-1/4 -bottom-1/4 h-1/2 w-1/2 rounded-full bg-info/10" />
      </div>

      {/* Media Setup Panel - centered card */}
      <div className="p-6 shadow-xl relative z-10 w-full max-w-[700px] rounded-lg border border-surface-2 bg-surface-1">
        <MediaSetupPanel
          onComplete={onComplete}
          onCancel={handlePanelCancel}
          isInGameSettings={false}
          showHeader={true}
          showFooter={true}
        />
      </div>

      {/* Cancel Warning Dialog */}
      <AlertDialog open={showCancelWarning} onOpenChange={setShowCancelWarning}>
        <AlertDialogContent className="border-surface-2 bg-surface-1">
          <AlertDialogHeader>
            <div className="mb-2 h-12 w-12 mx-auto flex items-center justify-center rounded-full bg-warning/20">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <AlertDialogTitle className="text-white text-center">
              Leave Without Saving?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-text-muted">
              Your settings will not be saved and you&apos;ll be redirected to
              the home page. You must complete audio & video setup before
              joining a game room.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:justify-center flex-row justify-center">
            <AlertDialogCancel
              onClick={handleDismissWarning}
              className="hover:text-white border-surface-3 bg-surface-2 text-text-secondary hover:bg-surface-3"
            >
              Continue Setup
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="text-black bg-warning hover:bg-warning/90"
            >
              Leave Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

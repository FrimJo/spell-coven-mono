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
    <div className="bg-surface-0 flex min-h-screen items-center justify-center">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand/10 absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full blur-3xl" />
        <div className="bg-info/10 absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full blur-3xl" />
      </div>

      {/* Media Setup Panel - centered card */}
      <div className="border-surface-2 bg-surface-1 relative z-10 w-full max-w-[700px] rounded-lg border p-6 shadow-xl">
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
            <div className="bg-warning/20 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
              <AlertTriangle className="text-warning h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center text-white">
              Leave Without Saving?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-muted text-center">
              Your settings will not be saved and you&apos;ll be redirected to
              the home page. You must complete audio & video setup before
              joining a game room.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
            <AlertDialogCancel
              onClick={handleDismissWarning}
              className="border-surface-3 bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-white"
            >
              Continue Setup
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-warning hover:bg-warning/90 text-black"
            >
              Leave Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

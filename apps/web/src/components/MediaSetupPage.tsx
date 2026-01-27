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
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Media Setup Panel - centered card */}
      <div className="relative z-10 w-full max-w-[700px] rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
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
        <AlertDialogContent className="border-slate-800 bg-slate-900">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <AlertDialogTitle className="text-center text-slate-100">
              Leave Without Saving?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-400">
              Your settings will not be saved and you&apos;ll be redirected to
              the home page. You must complete audio & video setup before
              joining a game room.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
            <AlertDialogCancel
              onClick={handleDismissWarning}
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-slate-100"
            >
              Continue Setup
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Leave Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

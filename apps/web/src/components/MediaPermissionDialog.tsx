/**
 * MediaPermissionDialog - Custom pre-permission prompt for camera/microphone
 *
 * Shows before the native browser permission dialog to explain why we need access.
 * This significantly increases permission acceptance rates.
 *
 * Features:
 * - Clear explanation of why permissions are needed
 * - Shows what features will be enabled
 * - "Allow" triggers native browser prompt
 * - "Not Now" with option to be reminded later or not asked again
 */
import { useState } from 'react'
import type { DeclineType } from '@/lib/permission-storage'
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  Mic,
  Shield,
  Video,
} from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'

export interface MediaPermissionDialogProps {
  open: boolean
  /** Called when user accepts - should trigger getUserMedia */
  onAccept: () => void | Promise<void>
  /** Called when user declines */
  onDecline: (type: DeclineType) => void
  /** Whether we're currently requesting permission */
  isRequesting?: boolean
  /** Which permissions we need (affects messaging) */
  permissions?: {
    camera: boolean
    microphone: boolean
  }
  /** If browser has permanently blocked permissions */
  blocked?: {
    camera: boolean
    microphone: boolean
  }
}

export function MediaPermissionDialog({
  open,
  onAccept,
  onDecline,
  isRequesting = false,
  permissions = { camera: true, microphone: true },
  blocked = { camera: false, microphone: false },
}: MediaPermissionDialogProps) {
  const [showDeclineMenu, setShowDeclineMenu] = useState(false)

  const hasBlockedPermissions = blocked.camera || blocked.microphone
  const bothPermissions = permissions.camera && permissions.microphone
  const cameraOnly = permissions.camera && !permissions.microphone
  const microphoneOnly = !permissions.camera && permissions.microphone

  const permissionLabel = bothPermissions
    ? 'camera and microphone'
    : cameraOnly
      ? 'camera'
      : 'microphone'

  const handleAccept = () => {
    onAccept()
  }

  const handleDecline = (type: DeclineType) => {
    setShowDeclineMenu(false)
    onDecline(type)
  }

  // Show blocked state if browser has denied permissions
  if (hasBlockedPermissions) {
    return (
      <Dialog open={open}>
        <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-[480px] [&>button]:hidden">
          <DialogHeader className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
            </div>
            <DialogTitle className="text-center text-xl text-slate-100">
              Permission Blocked
            </DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              {blocked.camera && blocked.microphone
                ? 'Camera and microphone access has been blocked in your browser settings.'
                : blocked.camera
                  ? 'Camera access has been blocked in your browser settings.'
                  : 'Microphone access has been blocked in your browser settings.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h4 className="mb-2 text-sm font-medium text-slate-200">
                To enable access:
              </h4>
              <ol className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                    1
                  </span>
                  <span>
                    Click the lock/info icon in your browser&apos;s address bar
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                    2
                  </span>
                  <span>
                    Find &quot;Camera&quot; and &quot;Microphone&quot; in the
                    site settings
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                    3
                  </span>
                  <span>Change from &quot;Block&quot; to &quot;Allow&quot;</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                    4
                  </span>
                  <span>Refresh this page</span>
                </li>
              </ol>
            </div>

            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Refresh Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open}>
      <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-[480px] [&>button]:hidden">
        <DialogHeader className="space-y-4">
          {/* Icon cluster */}
          <div className="flex items-center justify-center gap-3">
            {permissions.camera && (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/20 ring-2 ring-purple-500/30">
                <Camera className="h-7 w-7 text-purple-400" />
              </div>
            )}
            {permissions.microphone && (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/20 ring-2 ring-blue-500/30">
                <Mic className="h-7 w-7 text-blue-400" />
              </div>
            )}
          </div>

          <DialogTitle className="text-center text-xl text-slate-100">
            Enable {permissionLabel} access
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            Spell Coven needs access to your {permissionLabel} to connect you
            with other players.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Features list */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                <Video className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-200">
                  Video Chat
                </h4>
                <p className="text-xs text-slate-400">
                  See and be seen by other players in real-time
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20">
                <Camera className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-200">
                  Card Recognition
                </h4>
                <p className="text-xs text-slate-400">
                  Show your cards and we&apos;ll identify them automatically
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
                <Shield className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-200">Privacy</h4>
                <p className="text-xs text-slate-400">
                  Video stays between players, never stored on our servers
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <DropdownMenu open={showDeclineMenu} onOpenChange={setShowDeclineMenu}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  disabled={isRequesting}
                >
                  Not Now
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 border-slate-700 bg-slate-800"
              >
                <DropdownMenuItem
                  onClick={() => handleDecline('remind-later')}
                  className="cursor-pointer text-slate-300 focus:bg-slate-700 focus:text-white"
                >
                  <span>Remind me later</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDecline('dont-ask')}
                  className="cursor-pointer text-slate-400 focus:bg-slate-700 focus:text-slate-300"
                >
                  <span>Don&apos;t ask again</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={handleAccept}
              disabled={isRequesting}
              className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
            >
              {isRequesting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Requesting...
                </>
              ) : (
                'Allow Access'
              )}
            </Button>
          </div>

          <p className="text-center text-xs text-slate-500">
            Your browser will ask for permission. You can change this anytime in
            browser settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}


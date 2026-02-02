/**
 * MediaPermissionInline - Inline permission request/blocked UI
 *
 * Unlike MediaPermissionDialog, this renders inline content without a modal overlay.
 * Use this within containers like video card slots or other dialogs.
 */
import type { DeclineType } from '@/lib/permission-storage'
import { useState } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'

export interface MediaPermissionInlineProps {
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
  /** Compact mode for smaller containers */
  compact?: boolean
}

export function MediaPermissionInline({
  onAccept,
  onDecline,
  isRequesting = false,
  permissions = { camera: true, microphone: true },
  blocked = { camera: false, microphone: false },
  compact = false,
}: MediaPermissionInlineProps) {
  const [showDeclineMenu, setShowDeclineMenu] = useState(false)

  const hasBlockedPermissions = blocked.camera || blocked.microphone
  const bothPermissions = permissions.camera && permissions.microphone
  const cameraOnly = permissions.camera && !permissions.microphone

  const permissionLabel = bothPermissions
    ? 'camera and microphone'
    : cameraOnly
      ? 'camera'
      : 'microphone'

  const handleAccept = () => {
    onAccept()
  }

  const handleDecline = (type: DeclineType) => {
    console.log('[MediaPermissionInline] Handling decline:', type)
    setShowDeclineMenu(false)
    onDecline(type)
  }

  // Show blocked state if browser has denied permissions
  if (hasBlockedPermissions) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <div className="mx-auto max-w-sm space-y-4">
          <div className="bg-warning/20 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <AlertTriangle className="text-warning-muted-foreground h-6 w-6" />
          </div>

          <div className="text-center">
            <h3 className="text-text-primary text-lg font-semibold">
              Permission Blocked
            </h3>
            <p className="text-text-muted mt-1 text-sm">
              {blocked.camera && blocked.microphone
                ? 'Camera and microphone access has been blocked.'
                : blocked.camera
                  ? 'Camera access has been blocked.'
                  : 'Microphone access has been blocked.'}
            </p>
          </div>

          {!compact && (
            <div className="border-border-default bg-surface-2/50 rounded-lg border p-3">
              <h4 className="text-text-secondary mb-2 text-xs font-medium">
                To enable access:
              </h4>
              <ol className="text-text-muted space-y-1.5 text-xs">
                <li className="flex items-start gap-2">
                  <span className="bg-surface-3 text-text-secondary flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]">
                    1
                  </span>
                  <span>Click the lock/info icon in browser address bar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-surface-3 text-text-secondary flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]">
                    2
                  </span>
                  <span>
                    Find &quot;Camera&quot; and &quot;Microphone&quot;
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-surface-3 text-text-secondary flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]">
                    3
                  </span>
                  <span>
                    Change from &quot;Block&quot; to &quot;Allow&quot;
                  </span>
                </li>
              </ol>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="border-border-default text-text-secondary hover:bg-surface-2 w-full"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    )
  }

  // Show permission request UI
  return (
    <div className="flex h-full flex-col items-center justify-center p-4">
      <div className="mx-auto max-w-sm space-y-4">
        {/* Icon cluster */}
        <div className="flex items-center justify-center gap-2">
          {permissions.camera && (
            <div className="bg-brand/20 ring-brand/30 flex h-10 w-10 items-center justify-center rounded-full ring-2">
              <Camera className="text-brand-muted-foreground h-5 w-5" />
            </div>
          )}
          {permissions.microphone && (
            <div className="bg-info/20 ring-info/30 flex h-10 w-10 items-center justify-center rounded-full ring-2">
              <Mic className="text-info-muted-foreground h-5 w-5" />
            </div>
          )}
        </div>

        <div className="text-center">
          <h3 className="text-text-primary text-lg font-semibold">
            Enable {permissionLabel}
          </h3>
          <p className="text-text-muted mt-1 text-sm">
            Required to connect with other players
          </p>
        </div>

        {!compact && (
          <div className="space-y-2">
            <div className="border-border-default/50 bg-surface-2/30 flex items-start gap-2 rounded-lg border p-2">
              <div className="bg-brand/20 flex h-6 w-6 shrink-0 items-center justify-center rounded">
                <Video className="text-brand-muted-foreground h-3 w-3" />
              </div>
              <div>
                <h4 className="text-text-secondary text-xs font-medium">
                  Video Chat
                </h4>
                <p className="text-text-muted text-[10px]">
                  See and be seen by other players
                </p>
              </div>
            </div>

            <div className="border-border-default/50 bg-surface-2/30 flex items-start gap-2 rounded-lg border p-2">
              <div className="bg-success/20 flex h-6 w-6 shrink-0 items-center justify-center rounded">
                <Shield className="text-success-muted-foreground h-3 w-3" />
              </div>
              <div>
                <h4 className="text-text-secondary text-xs font-medium">
                  Privacy
                </h4>
                <p className="text-text-muted text-[10px]">
                  Video stays between players only
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <DropdownMenu
            open={showDeclineMenu}
            onOpenChange={setShowDeclineMenu}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-border-default text-text-secondary hover:bg-surface-2 flex-1"
                disabled={isRequesting}
              >
                Not Now
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-border-default bg-surface-2 w-48"
            >
              <DropdownMenuItem
                onClick={() => handleDecline('remind-later')}
                className="text-text-secondary focus:bg-surface-3 focus:text-text-primary cursor-pointer text-sm"
              >
                Remind me later
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDecline('dont-ask')}
                className="text-text-muted focus:bg-surface-3 focus:text-text-secondary cursor-pointer text-sm"
              >
                Don&apos;t ask again
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleAccept}
            size="sm"
            disabled={isRequesting}
            className="bg-brand text-brand-foreground hover:bg-brand/90 flex-1"
          >
            {isRequesting ? (
              <>
                <span className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Requesting...
              </>
            ) : (
              'Allow Access'
            )}
          </Button>
        </div>

        <p className="text-text-placeholder text-center text-[10px]">
          Your browser will ask for permission
        </p>
      </div>
    </div>
  )
}

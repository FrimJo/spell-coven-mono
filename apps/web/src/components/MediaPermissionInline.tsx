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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
            <AlertTriangle className="h-6 w-6 text-warning-muted-foreground" />
          </div>

          <div className="text-center">
            <h3 className="text-lg font-semibold text-text-primary">
              Permission Blocked
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              {blocked.camera && blocked.microphone
                ? 'Camera and microphone access has been blocked.'
                : blocked.camera
                  ? 'Camera access has been blocked.'
                  : 'Microphone access has been blocked.'}
            </p>
          </div>

          {!compact && (
            <div className="rounded-lg border border-border-default bg-surface-2/50 p-3">
              <h4 className="mb-2 text-xs font-medium text-text-secondary">
                To enable access:
              </h4>
              <ol className="space-y-1.5 text-xs text-text-muted">
                <li className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] text-text-secondary">
                    1
                  </span>
                  <span>Click the lock/info icon in browser address bar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] text-text-secondary">
                    2
                  </span>
                  <span>
                    Find &quot;Camera&quot; and &quot;Microphone&quot;
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] text-text-secondary">
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
            className="w-full border-border-default text-text-secondary hover:bg-surface-2"
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20 ring-2 ring-brand/30">
              <Camera className="h-5 w-5 text-brand-muted-foreground" />
            </div>
          )}
          {permissions.microphone && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/20 ring-2 ring-info/30">
              <Mic className="h-5 w-5 text-info-muted-foreground" />
            </div>
          )}
        </div>

        <div className="text-center">
          <h3 className="text-lg font-semibold text-text-primary">
            Enable {permissionLabel}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Required to connect with other players
          </p>
        </div>

        {!compact && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-border-default/50 bg-surface-2/30 p-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand/20">
                <Video className="h-3 w-3 text-brand-muted-foreground" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-text-secondary">
                  Video Chat
                </h4>
                <p className="text-[10px] text-text-muted">
                  See and be seen by other players
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border-default/50 bg-surface-2/30 p-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-success/20">
                <Shield className="h-3 w-3 text-success-muted-foreground" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-text-secondary">Privacy</h4>
                <p className="text-[10px] text-text-muted">
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
                className="flex-1 border-border-default text-text-secondary hover:bg-surface-2"
                disabled={isRequesting}
              >
                Not Now
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 border-border-default bg-surface-2"
            >
              <DropdownMenuItem
                onClick={() => handleDecline('remind-later')}
                className="cursor-pointer text-sm text-text-secondary focus:bg-surface-3 focus:text-text-primary"
              >
                Remind me later
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDecline('dont-ask')}
                className="cursor-pointer text-sm text-text-muted focus:bg-surface-3 focus:text-text-secondary"
              >
                Don&apos;t ask again
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleAccept}
            size="sm"
            disabled={isRequesting}
            className="flex-1 bg-brand text-brand-foreground hover:bg-brand/90"
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

        <p className="text-center text-[10px] text-text-placeholder">
          Your browser will ask for permission
        </p>
      </div>
    </div>
  )
}

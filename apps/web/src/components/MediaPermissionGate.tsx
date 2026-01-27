/**
 * MediaPermissionGate - Wrapper component that ensures media permissions before rendering children
 *
 * Shows an INLINE permission UI when permissions are needed (not a modal dialog).
 * Use this within containers like video card slots or inside other dialogs.
 *
 * @example
 * ```tsx
 * // In a video card slot
 * <MediaPermissionGate>
 *   <LocalVideoCard ... />
 * </MediaPermissionGate>
 * ```
 *
 * @example With custom fallback while checking
 * ```tsx
 * <MediaPermissionGate loadingFallback={<Spinner />}>
 *   <VideoContent />
 * </MediaPermissionGate>
 * ```
 */
import type { DeclineType } from '@/lib/permission-storage'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { useQueryClient } from '@tanstack/react-query'

import { MediaPermissionInline } from './MediaPermissionInline'

export interface MediaPermissionGateProps {
  children: ReactNode
  /** Custom loading UI while checking permissions */
  loadingFallback?: ReactNode
  /** Called when user declines permission (optional - for analytics, navigation, etc.) */
  onDecline?: (type: DeclineType) => void
  /** Which permissions to require (defaults to both) */
  permissions?: {
    camera?: boolean
    microphone?: boolean
  }
}

export function MediaPermissionGate({
  children,
  loadingFallback = null,
  onDecline,
  permissions = { camera: true, microphone: true },
}: MediaPermissionGateProps) {
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const queryClient = useQueryClient()

  const {
    camera: cameraPermission,
    microphone: microphonePermission,
    isChecking,
    recordDecline,
    recheckPermissions,
  } = useMediaPermissions()

  // Determine which permissions we need to check based on props
  const needsCameraCheck = permissions.camera !== false
  const needsMicrophoneCheck = permissions.microphone !== false

  // Check if permissions dialog should be shown
  const showPermissionDialog =
    !isChecking &&
    ((needsCameraCheck && cameraPermission.shouldShowDialog) ||
      (needsMicrophoneCheck && microphonePermission.shouldShowDialog))

  // Check if any required permission is blocked
  const permissionsBlocked = {
    camera: needsCameraCheck && cameraPermission.browserState === 'denied',
    microphone:
      needsMicrophoneCheck && microphonePermission.browserState === 'denied',
  }

  const hasBlockedPermissions =
    permissionsBlocked.camera || permissionsBlocked.microphone

  // Check if all required permissions are granted
  const allPermissionsGranted =
    (!needsCameraCheck || cameraPermission.browserState === 'granted') &&
    (!needsMicrophoneCheck || microphonePermission.browserState === 'granted')

  // Handle user accepting our custom dialog - triggers native browser prompt
  const handleAccept = async () => {
    setIsRequestingPermission(true)
    try {
      // Build constraints based on what we need
      const constraints: MediaStreamConstraints = {
        video: needsCameraCheck,
        audio: needsMicrophoneCheck,
      }

      // Request permissions to trigger native browser dialog
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Immediately stop the stream - we just needed to trigger the permission prompt
      stream.getTracks().forEach((track) => track.stop())

      // Invalidate the media devices query so it re-enumerates with real device IDs
      // (Before permission, enumerateDevices returns devices with empty deviceId)
      await queryClient.invalidateQueries({ queryKey: ['MediaDevices'] })

      // Recheck permissions after user responds to native dialog
      await recheckPermissions()
    } catch (error) {
      console.log('[MediaPermissionGate] Permission request failed:', error)
      // Recheck to get updated browser state
      await recheckPermissions()
    } finally {
      setIsRequestingPermission(false)
    }
  }

  // Handle user declining our custom dialog
  const handleDecline = (type: DeclineType) => {
    console.log('[MediaPermissionGate] Handling decline:', type)
    if (needsCameraCheck) {
      recordDecline('camera', type)
    }
    if (needsMicrophoneCheck) {
      recordDecline('microphone', type)
    }
    onDecline?.(type)
  }

  // Show loading state while checking permissions
  if (isChecking) {
    return <>{loadingFallback}</>
  }

  // Show inline permission UI if needed (including blocked state)
  if (showPermissionDialog || hasBlockedPermissions) {
    return (
      <MediaPermissionInline
        onAccept={handleAccept}
        onDecline={handleDecline}
        isRequesting={isRequestingPermission}
        permissions={{
          camera: needsCameraCheck,
          microphone: needsMicrophoneCheck,
        }}
        blocked={permissionsBlocked}
      />
    )
  }

  // If permissions granted or user declined our dialog, render children
  // Note: If user declined, they can still use the app but media won't work
  // The useMediaDevice hook will handle the error state
  if (allPermissionsGranted || !showPermissionDialog) {
    return <>{children}</>
  }
  // Fallback - should not reach here
  return <>{loadingFallback}</>
}

/**
 * useMediaPermissions - Hook for checking and managing media device permissions
 *
 * Combines:
 * - Browser's Permissions API for real-time permission state
 * - localStorage preferences for tracking user's dialog choices
 *
 * Determines when to show custom permission dialog vs native browser prompt.
 */
import type { DeclineType } from '@/lib/permission-storage'
import { useCallback, useEffect, useState } from 'react'
import {
  clearDeclinePrefs,
  getDeclineState,
  recordDecline,
  shouldShowPermissionDialog,
} from '@/lib/permission-storage'

export type BrowserPermissionState = PermissionState | 'unknown'

export interface PermissionStatus {
  /** Browser's actual permission state */
  browserState: BrowserPermissionState
  /** Whether we should show our custom dialog */
  shouldShowDialog: boolean
  /** Days until we ask again (if user chose "remind later") */
  daysUntilRemind: number | null
}

export interface UseMediaPermissionsReturn {
  camera: PermissionStatus
  microphone: PermissionStatus
  /** Whether we're still checking permissions */
  isChecking: boolean
  /** Record that user declined our custom dialog */
  recordDecline: (
    permission: 'camera' | 'microphone',
    type: DeclineType,
  ) => void
  /** Clear decline preferences and recheck */
  resetPreferences: (permission?: 'camera' | 'microphone') => void
  /** Recheck browser permissions (call after user interacts with native dialog) */
  recheckPermissions: () => Promise<void>
}

/**
 * Query browser permission state using Permissions API
 * Falls back to 'unknown' if API not supported
 */
async function queryBrowserPermission(
  name: 'camera' | 'microphone',
): Promise<BrowserPermissionState> {
  try {
    // Permissions API may not be available in all browsers
    if (!navigator.permissions?.query) {
      return 'unknown'
    }

    const result = await navigator.permissions.query({
      name: name as PermissionName,
    })
    return result.state as BrowserPermissionState
  } catch {
    // Safari doesn't support querying camera/microphone permissions
    return 'unknown'
  }
}

/**
 * Calculate permission status combining browser state and user preferences
 */
function calculatePermissionStatus(
  browserState: BrowserPermissionState,
  permission: 'camera' | 'microphone',
): PermissionStatus {
  const declineState = getDeclineState(permission)

  // If browser already granted, no need for dialog
  if (browserState === 'granted') {
    return {
      browserState,
      shouldShowDialog: false,
      daysUntilRemind: null,
    }
  }

  // If browser denied (user blocked in browser settings), don't show our dialog
  // Show a different UI explaining how to enable in browser settings
  if (browserState === 'denied') {
    return {
      browserState,
      shouldShowDialog: false,
      daysUntilRemind: null,
    }
  }

  // Browser state is 'prompt' or 'unknown' - check our preferences
  const shouldShow = shouldShowPermissionDialog(permission)

  return {
    browserState,
    shouldShowDialog: shouldShow,
    daysUntilRemind:
      declineState?.type === 'remind-later' ? declineState.daysRemaining : null,
  }
}

/**
 * Hook for managing media permission states
 *
 * @example
 * ```tsx
 * function App() {
 *   const {
 *     camera,
 *     microphone,
 *     isChecking,
 *     recordDecline,
 *     recheckPermissions,
 *   } = useMediaPermissions()
 *
 *   // Show custom dialog if either permission needs prompting
 *   const showPermissionDialog =
 *     !isChecking &&
 *     (camera.shouldShowDialog || microphone.shouldShowDialog)
 *
 *   // Handle user accepting our dialog - triggers native browser prompt
 *   const handleAccept = async () => {
 *     try {
 *       await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
 *       await recheckPermissions()
 *     } catch (err) {
 *       // User denied native prompt
 *       await recheckPermissions()
 *     }
 *   }
 *
 *   // Handle user declining our dialog
 *   const handleDecline = (type: 'remind-later' | 'dont-ask') => {
 *     recordDecline('camera', type)
 *     recordDecline('microphone', type)
 *   }
 * }
 * ```
 */
export function useMediaPermissions(): UseMediaPermissionsReturn {
  const [isChecking, setIsChecking] = useState(true)
  const [cameraBrowserState, setCameraBrowserState] =
    useState<BrowserPermissionState>('unknown')
  const [microphoneBrowserState, setMicrophoneBrowserState] =
    useState<BrowserPermissionState>('unknown')
  const [updateTrigger, setUpdateTrigger] = useState(0)

  // Check permissions on mount and when triggered
  const checkPermissions = useCallback(async () => {
    setIsChecking(true)
    try {
      const [cameraState, micState] = await Promise.all([
        queryBrowserPermission('camera'),
        queryBrowserPermission('microphone'),
      ])
      setCameraBrowserState(cameraState)
      setMicrophoneBrowserState(micState)
    } finally {
      setIsChecking(false)
    }
  }, [])

  useEffect(() => {
    checkPermissions()
  }, [checkPermissions, updateTrigger])

  // Listen for permission changes (when user changes in browser settings)
  useEffect(() => {
    const setupPermissionListeners = async () => {
      try {
        if (!navigator.permissions?.query) return

        const cameraStatus = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        })
        const micStatus = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        })

        const handleCameraChange = () => {
          setCameraBrowserState(cameraStatus.state as BrowserPermissionState)
        }
        const handleMicChange = () => {
          setMicrophoneBrowserState(micStatus.state as BrowserPermissionState)
        }

        cameraStatus.addEventListener('change', handleCameraChange)
        micStatus.addEventListener('change', handleMicChange)

        return () => {
          cameraStatus.removeEventListener('change', handleCameraChange)
          micStatus.removeEventListener('change', handleMicChange)
        }
      } catch {
        // Safari doesn't support this
        return undefined
      }
    }

    const cleanup = setupPermissionListeners()
    return () => {
      cleanup.then((fn) => fn?.())
    }
  }, [])

  const handleRecordDecline = useCallback(
    (permission: 'camera' | 'microphone', type: DeclineType) => {
      recordDecline(permission, type)
      // Trigger re-calculation of shouldShowDialog
      setUpdateTrigger((t) => t + 1)
    },
    [],
  )

  const handleResetPreferences = useCallback(
    (permission?: 'camera' | 'microphone') => {
      clearDeclinePrefs(permission)
      setUpdateTrigger((t) => t + 1)
    },
    [],
  )

  const recheckPermissions = useCallback(async () => {
    await checkPermissions()
  }, [checkPermissions])

  // Calculate status combining browser state and preferences
  const cameraStatus = calculatePermissionStatus(cameraBrowserState, 'camera')
  const microphoneStatus = calculatePermissionStatus(
    microphoneBrowserState,
    'microphone',
  )

  return {
    camera: cameraStatus,
    microphone: microphoneStatus,
    isChecking,
    recordDecline: handleRecordDecline,
    resetPreferences: handleResetPreferences,
    recheckPermissions,
  }
}

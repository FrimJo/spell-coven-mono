import { useCallback, useMemo, useState } from 'react'
import { useMediaStreams } from '@/contexts/MediaStreamContext'
import { usePresence } from '@/contexts/PresenceContext'
import { useRoomMedia } from '@/contexts/RoomMediaContext'
import {
  createPairingToken,
  getPhoneCameraUrl,
  sha256Hex,
} from '@/lib/phone-camera-pairing'
import { api } from '@convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'

interface UsePhoneCameraPairingOptions {
  roomId: string
}

export function usePhoneCameraPairing({
  roomId,
}: UsePhoneCameraPairingOptions) {
  const { sessionId } = usePresence()
  const roomMedia = useRoomMedia()
  const {
    mediaPreferences: {
      setSelectedPhoneCamera,
      setSelectedVideoDeviceId,
      setVideoEnabled,
    },
  } = useMediaStreams()
  const [pairingToken, setPairingToken] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const activePairing = useQuery(
    api.phoneCamera.getActivePairing,
    sessionId && roomId ? { roomId, desktopSessionId: sessionId } : 'skip',
  )
  const createPairingMutation = useMutation(api.phoneCamera.createPairing)
  const cancelPairingMutation = useMutation(api.phoneCamera.cancelPairing)

  const phoneCamera = sessionId ? roomMedia.phoneCameras.get(sessionId) : null
  const pairingUrl = pairingToken ? getPhoneCameraUrl(pairingToken) : null
  const activePairingId = activePairing?.pairingId ?? null
  const activePairingStatus = activePairing?.status ?? null
  const phoneCameraVideoTrack = phoneCamera?.video.track ?? null

  const startPairing = useCallback(async () => {
    if (!sessionId || !roomId) return

    setIsCreating(true)
    try {
      const token = createPairingToken()
      const tokenHash = await sha256Hex(token)
      await createPairingMutation({
        roomId,
        desktopSessionId: sessionId,
        tokenHash,
      })
      setPairingToken(token)
    } finally {
      setIsCreating(false)
    }
    // Convex's mutation function is stable enough for this callback; the
    // generic TanStack rule cannot distinguish it from query result objects.
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
  }, [createPairingMutation, roomId, sessionId])

  const cancelPairing = useCallback(async () => {
    if (!activePairingId || !sessionId) return

    await cancelPairingMutation({
      pairingId: activePairingId,
      roomId,
      desktopSessionId: sessionId,
    })
    setPairingToken(null)
    setSelectedVideoDeviceId(null)
    setVideoEnabled(false)
  }, [
    activePairingId,
    // Convex's mutation function is stable enough for this callback; the
    // generic TanStack rule cannot distinguish it from query result objects.
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    cancelPairingMutation,
    roomId,
    sessionId,
    setSelectedVideoDeviceId,
    setVideoEnabled,
  ])

  const selectPhoneCamera = useCallback(() => {
    if (!activePairingId) return
    setSelectedPhoneCamera(activePairingId)
  }, [activePairingId, setSelectedPhoneCamera])

  const status = useMemo(() => {
    if (!activePairingStatus) return 'idle'
    if (phoneCameraVideoTrack) return 'live'
    return activePairingStatus
  }, [activePairingStatus, phoneCameraVideoTrack])

  return {
    activePairing,
    phoneCamera,
    pairingUrl,
    status,
    isCreating,
    startPairing,
    cancelPairing,
    selectPhoneCamera,
  }
}

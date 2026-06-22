import type { Id } from '@convex/_generated/dataModel'
import type { LocalVideoTrack, Room } from 'livekit-client'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { api } from '@convex/_generated/api'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useAction, useMutation } from 'convex/react'
import {
  createLocalVideoTrack,
  Room as LiveKitRoom,
  RoomEvent,
  Track,
  VideoPresets,
} from 'livekit-client'
import {
  Camera,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Smartphone,
  XCircle,
} from 'lucide-react'
import { z } from 'zod'

import { Button } from '@repo/ui/components/button'

import { createPhoneSessionId, sha256Hex } from '../lib/phone-camera-pairing.js'

const phoneCameraSearchSchema = z.object({
  pairing: z.string().default(''),
})

type PhoneStatus =
  | 'idle'
  | 'claiming'
  | 'ready'
  | 'requestingCamera'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

type WakeLockSentinelLike = {
  release: () => Promise<void>
  addEventListener: (
    type: 'release',
    listener: () => void,
    options?: AddEventListenerOptions,
  ) => void
}

export const Route = createFileRoute('/phone-camera')({
  ssr: false,
  component: PhoneCameraPage,
  validateSearch: zodValidator(phoneCameraSearchSchema),
  search: {
    middlewares: [stripSearchParams({ pairing: '' })],
  },
})

function PhoneCameraPage() {
  const { pairing } = Route.useSearch()
  const claimPairing = useMutation(api.phoneCamera.claimPairing)
  const updatePhoneStatus = useMutation(api.phoneCamera.updatePhoneStatus)
  const issueToken = useAction(api.mediaActions.issuePhoneCameraLiveKitToken)
  const phoneSessionIdRef = useRef(createPhoneSessionId())
  const roomRef = useRef<Room | null>(null)
  const trackRef = useRef<LocalVideoTrack | null>(null)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [status, setStatus] = useState<PhoneStatus>(pairing ? 'idle' : 'error')
  const [pairingInfo, setPairingInfo] = useState<{
    pairingId: Id<'phoneCameraPairings'>
    roomId: string
    desktopSessionId: string
  } | null>(null)
  const [cameraFacingMode, setCameraFacingMode] = useState<
    'environment' | 'user'
  >('environment')
  const [error, setError] = useState<string | null>(
    pairing ? null : 'Missing phone camera pairing token.',
  )
  const [wakeLockAvailable, setWakeLockAvailable] = useState(true)

  const markStatus = useCallback(
    (nextStatus: 'connected' | 'disconnected' | 'cancelled') => {
      if (!pairingInfo) return Promise.resolve(null)
      return updatePhoneStatus({
        pairingId: pairingInfo.pairingId,
        phoneSessionId: phoneSessionIdRef.current,
        status: nextStatus,
      }).catch(() => null)
    },
    // Convex's mutation function is stable enough for this callback; the
    // generic TanStack rule cannot distinguish it from query result objects.
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    [pairingInfo, updatePhoneStatus],
  )

  const requestWakeLock = useCallback(async () => {
    if (!navigator.wakeLock) {
      setWakeLockAvailable(false)
      return
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null
      })
      setWakeLockAvailable(true)
    } catch {
      wakeLockRef.current = null
      setWakeLockAvailable(false)
    }
  }, [])

  const stopStreaming = useCallback(async () => {
    trackRef.current?.stop()
    trackRef.current = null
    roomRef.current?.disconnect()
    roomRef.current = null
    await wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
    await markStatus('disconnected')
    setStatus('disconnected')
  }, [markStatus])

  const claim = useEffectEvent(async () => {
    if (!pairing) return

    setStatus('claiming')
    setError(null)
    try {
      const tokenHash = await sha256Hex(pairing)
      const claimed = await claimPairing({
        tokenHash,
        phoneSessionId: phoneSessionIdRef.current,
      })
      setPairingInfo(claimed)
      setStatus('ready')
    } catch (claimError) {
      setStatus('error')
      setError(
        claimError instanceof Error
          ? claimError.message
          : 'Unable to claim phone camera pairing.',
      )
    }
  })

  useEffect(() => {
    void claim()
  }, [])

  useEffect(() => {
    if (!pairingInfo || status !== 'live') return

    const interval = setInterval(() => {
      void markStatus('connected')
    }, 8_000)

    return () => clearInterval(interval)
  }, [markStatus, pairingInfo, status])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (status === 'live') {
          void requestWakeLock()
          void markStatus('connected')
        }
      } else if (status === 'live') {
        void markStatus('disconnected')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [markStatus, requestWakeLock, status])

  useEffect(() => {
    return () => {
      trackRef.current?.stop()
      roomRef.current?.disconnect()
      void wakeLockRef.current?.release().catch(() => {})
    }
  }, [])

  const startStreaming = useCallback(
    async (facingMode = cameraFacingMode) => {
      if (!pairingInfo) return

      setStatus('requestingCamera')
      setError(null)
      try {
        trackRef.current?.stop()
        const track = await createLocalVideoTrack({
          facingMode,
          resolution: VideoPresets.h720.resolution,
        })
        trackRef.current = track

        if (videoRef.current) {
          track.attach(videoRef.current)
          await videoRef.current.play().catch(() => {})
        }

        setStatus('connecting')
        const { serverUrl, token } = await issueToken({
          pairingId: pairingInfo.pairingId,
          phoneSessionId: phoneSessionIdRef.current,
        })

        const room = new LiveKitRoom({
          adaptiveStream: true,
          dynacast: true,
        })
        roomRef.current = room
        room
          .on(RoomEvent.Reconnecting, () => setStatus('reconnecting'))
          .on(RoomEvent.Reconnected, () => setStatus('live'))
          .on(RoomEvent.Disconnected, () => setStatus('disconnected'))

        await room.connect(serverUrl, token)
        await room.localParticipant.publishTrack(track, {
          source: Track.Source.Camera,
          name: 'phone-camera',
        })
        await markStatus('connected')
        await requestWakeLock()
        setStatus('live')
      } catch (startError) {
        setStatus('error')
        setError(
          startError instanceof Error
            ? startError.message
            : 'Unable to start phone camera.',
        )
        await markStatus('disconnected')
      }
    },
    [cameraFacingMode, issueToken, markStatus, pairingInfo, requestWakeLock],
  )

  const switchCamera = useCallback(async () => {
    const nextFacingMode =
      cameraFacingMode === 'environment' ? 'user' : 'environment'
    setCameraFacingMode(nextFacingMode)
    if (status === 'live') {
      await stopStreaming()
      setTimeout(() => {
        void startStreaming(nextFacingMode)
      }, 0)
    }
  }, [cameraFacingMode, startStreaming, status, stopStreaming])

  return (
    <main className="bg-surface-0 flex min-h-screen items-center justify-center p-4 text-white">
      <section className="border-surface-2 bg-surface-1 flex w-full max-w-md flex-col gap-5 rounded-lg border p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-brand/20 flex size-11 items-center justify-center rounded-lg">
            <Smartphone className="text-brand size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Phone camera</h1>
            <p className="text-text-muted text-sm">Spell Coven camera source</p>
          </div>
        </div>

        <div className="bg-surface-0 relative aspect-video overflow-hidden rounded-lg">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {status !== 'live' && status !== 'reconnecting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="text-text-muted size-12" />
            </div>
          )}
        </div>

        <div className="border-surface-2 bg-surface-0 rounded-lg border p-3 text-sm">
          <div className="flex items-center gap-2">
            {status === 'live' ? (
              <CheckCircle2 className="text-success size-4" />
            ) : status === 'error' ? (
              <XCircle className="text-destructive size-4" />
            ) : (
              <Loader2 className="text-brand size-4 animate-spin" />
            )}
            <span>
              {status === 'idle' && 'Preparing pairing...'}
              {status === 'claiming' && 'Claiming pairing...'}
              {status === 'ready' && 'Ready to start camera.'}
              {status === 'requestingCamera' && 'Requesting camera access...'}
              {status === 'connecting' && 'Connecting to Spell Coven...'}
              {status === 'live' && 'Camera is live.'}
              {status === 'reconnecting' && 'Reconnecting camera...'}
              {status === 'disconnected' && 'Camera disconnected.'}
              {status === 'error' && 'Unable to connect phone camera.'}
            </span>
          </div>
          {error && <p className="text-destructive mt-2 text-xs">{error}</p>}
          {!wakeLockAvailable && (
            <p className="text-warning mt-2 text-xs">
              Your browser may let the screen turn off. Keep this phone awake
              while streaming.
            </p>
          )}
        </div>

        <p className="text-text-muted text-sm">
          Keep this page open and your phone unlocked while using it as a Spell
          Coven camera.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={() => void startStreaming()}
            disabled={
              !pairingInfo || status === 'live' || status === 'claiming'
            }
            className="gap-2"
          >
            <Camera className="size-4" />
            Start
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void switchCamera()}
            disabled={status === 'claiming' || status === 'connecting'}
            className="gap-2"
          >
            <RotateCcw className="size-4" />
            Switch
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void stopStreaming()}
            disabled={status !== 'live' && status !== 'reconnecting'}
            className="col-span-2"
          >
            Disconnect
          </Button>
        </div>
      </section>
    </main>
  )
}

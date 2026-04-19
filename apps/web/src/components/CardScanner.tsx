import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, Scan, X } from 'lucide-react'

import { identifyCard, type CardMatch } from '@repo/card-detection'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

interface CardScannerProps {
  onClose: () => void
}

type ScanError =
  | { kind: 'camera'; message: string }
  | { kind: 'detection'; message: string }
  | { kind: 'no-match' }

// HAVE_CURRENT_DATA — enough data for the current playback position
const HAVE_CURRENT_DATA = 2

class CameraNotReadyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CameraNotReadyError'
  }
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const tone =
    confidence >= 0.8
      ? 'bg-success/20 text-success'
      : confidence >= 0.6
        ? 'bg-warning/20 text-warning'
        : 'bg-danger/20 text-danger'
  const label =
    confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low'
  return (
    <span
      className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${tone}`}
    >
      <span>{label} confidence</span>
      <span className="opacity-70">· {pct}%</span>
    </span>
  )
}

interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

// Map the guide's CSS rect to source-pixel coords on the video, accounting for
// `object-cover` scaling (video is scaled to cover the container, then centered).
function computeGuideCrop(
  video: HTMLVideoElement,
  guide: HTMLElement,
): CropRect | null {
  const videoRect = video.getBoundingClientRect()
  const guideRect = guide.getBoundingClientRect()
  const { videoWidth, videoHeight } = video
  if (
    videoRect.width <= 0 ||
    videoRect.height <= 0 ||
    guideRect.width <= 0 ||
    guideRect.height <= 0 ||
    videoWidth <= 0 ||
    videoHeight <= 0
  ) {
    return null
  }

  // object-cover: the source is scaled by max(containerW/srcW, containerH/srcH)
  // and centered, so part of one axis is cropped out of view.
  const scale = Math.max(
    videoRect.width / videoWidth,
    videoRect.height / videoHeight,
  )
  const displayedW = videoWidth * scale
  const displayedH = videoHeight * scale
  const offsetX = (videoRect.width - displayedW) / 2
  const offsetY = (videoRect.height - displayedH) / 2

  const guideCssX = guideRect.left - videoRect.left - offsetX
  const guideCssY = guideRect.top - videoRect.top - offsetY

  let sx = guideCssX / scale
  let sy = guideCssY / scale
  let sw = guideRect.width / scale
  let sh = guideRect.height / scale

  sx = Math.max(0, Math.min(videoWidth, sx))
  sy = Math.max(0, Math.min(videoHeight, sy))
  sw = Math.max(0, Math.min(videoWidth - sx, sw))
  sh = Math.max(0, Math.min(videoHeight - sy, sh))

  if (sw < 1 || sh < 1) return null
  return { sx, sy, sw, sh }
}

export function CardScanner({ onClose }: CardScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const guideRef = useRef<HTMLDivElement | null>(null)
  const cancelledRef = useRef(false)
  const [scanning, setScanning] = useState(false)
  const [recognizedCard, setRecognizedCard] = useState<CardMatch | null>(null)
  const [error, setError] = useState<ScanError | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    let cancelled = false

    const markReadyWhenDecoded = (video: HTMLVideoElement) => {
      if (cancelled) return
      if (
        video.readyState >= HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        setCameraReady(true)
        return
      }
      // Fall back to waiting for metadata + a frame to be decoded.
      const onReady = () => {
        if (cancelled) return
        if (
          video.readyState >= HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          setCameraReady(true)
          video.removeEventListener('loadeddata', onReady)
          video.removeEventListener('loadedmetadata', onReady)
          video.removeEventListener('canplay', onReady)
        }
      }
      video.addEventListener('loadeddata', onReady)
      video.addEventListener('loadedmetadata', onReady)
      video.addEventListener('canplay', onReady)
    }

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop()
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          try {
            await video.play()
          } catch {
            // autoplay rejection is non-fatal; the readiness check below still runs
          }
          if (cancelled) return
          markReadyWhenDecoded(video)
        }
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Failed to access camera'
        setError({ kind: 'camera', message })
      }
    }
    void startCamera()
    return () => {
      cancelled = true
      cancelledRef.current = true
      stopStream()
    }
  }, [stopStream])

  const handleScan = useCallback(async () => {
    if (scanning) return
    const video = videoRef.current
    if (!video || !cameraReady) {
      setError({ kind: 'camera', message: 'Camera not ready' })
      return
    }

    setError(null)
    setRecognizedCard(null)
    setScanning(true)

    try {
      const width = video.videoWidth
      const height = video.videoHeight
      if (
        !width ||
        !height ||
        video.readyState < HAVE_CURRENT_DATA
      ) {
        throw new CameraNotReadyError('Video frame not available')
      }

      let canvas = canvasRef.current
      if (!canvas) {
        canvas = document.createElement('canvas')
        canvasRef.current = canvas
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to acquire 2D canvas context')

      const guide = guideRef.current
      const crop = guide ? computeGuideCrop(video, guide) : null
      let cw: number
      let ch: number
      if (crop) {
        cw = Math.round(crop.sw)
        ch = Math.round(crop.sh)
        canvas.width = cw
        canvas.height = ch
        ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cw, ch)
      } else {
        cw = width
        ch = height
        canvas.width = cw
        canvas.height = ch
        ctx.drawImage(video, 0, 0, cw, ch)
      }
      const imageData = ctx.getImageData(0, 0, cw, ch)

      const matches: CardMatch[] = await identifyCard(imageData)
      if (cancelledRef.current) return
      const top = matches[0]
      if (!top) {
        setError({ kind: 'no-match' })
        return
      }
      setRecognizedCard(top)
    } catch (err) {
      if (cancelledRef.current) return
      if (err instanceof CameraNotReadyError) {
        setError({ kind: 'camera', message: err.message })
        return
      }
      const message =
        err instanceof Error ? err.message : 'Card detection failed'
      setError({ kind: 'detection', message })
    } finally {
      if (!cancelledRef.current) {
        setScanning(false)
      }
    }
  }, [cameraReady, scanning])

  const handleAddToBattlefield = () => {
    // Add card to battlefield logic
    setRecognizedCard(null)
  }

  const handleClose = () => {
    cancelledRef.current = true
    stopStream()
    onClose()
  }

  return (
    <Card className="border-surface-2 bg-surface-1 overflow-hidden">
      <div className="relative">
        {/* Header */}
        <div className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-slate-950/80 to-transparent p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="text-brand-muted-foreground h-5 w-5" />
              <span className="text-white">Card Scanner</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-text-muted hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scanner View */}
        <div className="bg-surface-0 relative aspect-video">
          {/* Live webcam feed */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Dim overlay when not actively recognized */}
          {!recognizedCard && (
            <div className="absolute inset-0 bg-slate-950/40" />
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            {scanning ? (
              <div className="space-y-4 text-center">
                <div className="relative">
                  <div className="border-brand/30 h-32 w-32 animate-pulse rounded-lg border-4" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Scan className="text-brand-muted-foreground h-16 w-16 animate-pulse" />
                  </div>
                </div>
                <p className="text-text-muted">Scanning card...</p>
              </div>
            ) : recognizedCard ? (
              <div className="bg-surface-1/90 space-y-4 rounded-lg p-6 text-center backdrop-blur-sm">
                <div className="bg-success/20 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                  <CheckCircle2 className="text-success h-8 w-8" />
                </div>
                <div>
                  <p className="text-text-muted mb-2 text-sm">
                    Recognized Card:
                  </p>
                  <p className="text-xl text-white">{recognizedCard.name}</p>
                  <ConfidenceBadge confidence={recognizedCard.confidence} />
                </div>
                <div className="flex justify-center gap-2">
                  <Button
                    onClick={handleAddToBattlefield}
                    className="bg-brand hover:bg-brand text-white"
                  >
                    Add to Battlefield
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRecognizedCard(null)}
                    className="border-surface-3 text-text-muted"
                  >
                    Scan Another
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                {error?.kind === 'camera' ? (
                  <div className="bg-surface-1/90 max-w-sm space-y-3 rounded-lg p-6 backdrop-blur-sm">
                    <AlertCircle className="text-danger mx-auto h-10 w-10" />
                    <p className="text-white">Camera unavailable</p>
                    <p className="text-text-muted text-xs">{error.message}</p>
                  </div>
                ) : (
                  <div className="bg-surface-1/80 space-y-3 rounded-lg p-4 backdrop-blur-sm">
                    <p className="text-text-muted">Position card in frame</p>
                    <Button
                      onClick={handleScan}
                      disabled={!cameraReady}
                      className="bg-brand hover:bg-brand text-white"
                    >
                      <Scan className="mr-2 h-4 w-4" />
                      {cameraReady ? 'Scan Card' : 'Starting camera...'}
                    </Button>
                    {error?.kind === 'no-match' && (
                      <p className="text-warning text-xs">
                        No matching card found. Try again with better lighting.
                      </p>
                    )}
                    {error?.kind === 'detection' && (
                      <p className="text-danger text-xs">
                        Detection failed: {error.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scanning Frame Overlay */}
          {!recognizedCard && (
            <div className="pointer-events-none absolute inset-0">
              <div
                ref={guideRef}
                className="border-brand/30 absolute left-1/2 top-1/2 h-96 w-64 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2"
              >
                {/* Corner indicators */}
                <div className="border-brand absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4" />
                <div className="border-brand absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4" />
                <div className="border-brand absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4" />
                <div className="border-brand absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4" />
              </div>
            </div>
          )}
        </div>

        {/* Footer Tips */}
        <div className="border-surface-2 bg-surface-0/50 border-t p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-info mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="text-text-muted text-xs">
              For best results, ensure good lighting and hold the card flat in
              the frame. The card name should be clearly visible.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

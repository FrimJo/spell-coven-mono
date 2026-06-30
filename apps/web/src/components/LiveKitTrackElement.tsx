import type { MediaTrack } from '@/types/media-session'
import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'

interface LiveKitTrackElementProps {
  track: MediaTrack | null
  kind: 'video' | 'audio'
  muted?: boolean
  className?: string
  style?: CSSProperties
  testId?: string
  ariaLabel?: string
  onVideoElement?: (element: HTMLVideoElement | null) => void
}

export function LiveKitTrackElement({
  track,
  kind,
  muted = false,
  className,
  style,
  testId,
  ariaLabel,
  onVideoElement,
}: LiveKitTrackElementProps) {
  const mediaRef = useRef<HTMLMediaElement | null>(null)

  useEffect(() => {
    const element = mediaRef.current
    if (!element || !track) return

    track.attach(element)
    void element.play?.().catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('[LiveKitTrackElement] Failed to play media track:', error)
    })

    return () => {
      track.detach(element)
    }
  }, [track])

  if (kind === 'audio') {
    return (
      <audio
        ref={mediaRef}
        autoPlay
        muted={muted}
        aria-label={ariaLabel}
        data-testid={testId}
      />
    )
  }

  return (
    <video
      ref={(element) => {
        mediaRef.current = element
        onVideoElement?.(element)
      }}
      className={className}
      autoPlay
      playsInline
      muted={muted}
      aria-label={ariaLabel}
      style={style}
      data-testid={testId}
    />
  )
}

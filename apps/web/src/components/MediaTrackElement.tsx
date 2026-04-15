import type { LocalTrack, RemoteTrack } from 'livekit-client'
import type { ComponentPropsWithoutRef } from 'react'
import { forwardRef, useCallback, useEffect, useRef } from 'react'

type AttachableTrack = Pick<LocalTrack | RemoteTrack, 'attach' | 'detach'>

type BaseProps = {
  track: AttachableTrack | null
}

type VideoTrackElementProps = BaseProps &
  Omit<ComponentPropsWithoutRef<'video'>, 'ref'> & {
    element: 'video'
  }

type AudioTrackElementProps = BaseProps &
  Omit<ComponentPropsWithoutRef<'audio'>, 'ref'> & {
    element: 'audio'
  }

export type MediaTrackElementProps =
  | VideoTrackElementProps
  | AudioTrackElementProps

export const MediaTrackElement = forwardRef<
  HTMLVideoElement | HTMLAudioElement,
  MediaTrackElementProps
>(function MediaTrackElement(props, forwardedRef) {
  const { track, element, ...elementProps } = props
  const mediaElementRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(
    null,
  )

  const setMediaElementRef = useCallback(
    (mediaElement: HTMLVideoElement | HTMLAudioElement | null) => {
      mediaElementRef.current = mediaElement

      if (typeof forwardedRef === 'function') {
        forwardedRef(mediaElement)
        return
      }

      if (forwardedRef) {
        forwardedRef.current = mediaElement
      }
    },
    [forwardedRef],
  )

  useEffect(() => {
    const mediaElement = mediaElementRef.current
    if (!mediaElement) {
      return
    }

    if (!track) {
      mediaElement.srcObject = null
      return
    }

    track.attach(mediaElement)
    void mediaElement.play().catch(() => {})

    return () => {
      track.detach(mediaElement)
      mediaElement.srcObject = null
    }
  }, [track])

  if (element === 'audio') {
    return <audio ref={setMediaElementRef} autoPlay {...elementProps} />
  }

  return (
    <video ref={setMediaElementRef} autoPlay playsInline {...elementProps} />
  )
})

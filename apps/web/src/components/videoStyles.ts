import type { CSSProperties } from 'react'

// Shared full-bleed video style for local, remote, and test streams.
export const VIDEO_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  zIndex: 0,
}

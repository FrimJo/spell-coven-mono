/**
 * Per-tile webcam orientation: 0/90/180/270 rotation + horizontal mirror + zoom.
 * State is persisted to localStorage keyed by tileId so a user's preferred
 * orientation for a given seat sticks across reloads.
 */
import { useCallback, useEffect, useState } from 'react'

export type Rotation = 0 | 90 | 180 | 270

export const ZOOM_MIN = 1
export const ZOOM_MAX = 4
export const ZOOM_STEP = 0.25

export interface VideoOrientationState {
  rotation: Rotation
  mirrored: boolean
  zoom: number
}

const STORAGE_PREFIX = 'spell-casters:tile-orientation:'
const VALID_ROTATIONS: ReadonlyArray<Rotation> = [0, 90, 180, 270]

const DEFAULT_STATE: VideoOrientationState = {
  rotation: 0,
  mirrored: false,
  zoom: 1,
}

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

function load(tileId: string): VideoOrientationState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tileId)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<VideoOrientationState>
    const rotation = VALID_ROTATIONS.includes(parsed.rotation as Rotation)
      ? (parsed.rotation as Rotation)
      : 0
    return {
      rotation,
      mirrored: Boolean(parsed.mirrored),
      zoom: clampZoom(typeof parsed.zoom === 'number' ? parsed.zoom : 1),
    }
  } catch {
    return DEFAULT_STATE
  }
}

function persist(tileId: string, state: VideoOrientationState): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + tileId, JSON.stringify(state))
  } catch {
    // Ignore quota errors
  }
}

export interface UseVideoOrientationReturn extends VideoOrientationState {
  /** CSS transform string to apply to video + overlay canvas */
  transform: string
  rotateLeft: () => void
  rotateRight: () => void
  toggleMirror: () => void
  zoomIn: () => void
  zoomOut: () => void
  setZoom: (zoom: number) => void
  reset: () => void
}

export function useVideoOrientation(tileId: string): UseVideoOrientationReturn {
  const [state, setState] = useState<VideoOrientationState>(() => load(tileId))

  // If the tileId changes (e.g., participant swap), re-load
  useEffect(() => {
    setState(load(tileId))
  }, [tileId])

  const update = useCallback(
    (next: VideoOrientationState) => {
      setState(next)
      persist(tileId, next)
    },
    [tileId],
  )

  const rotateRight = useCallback(
    () =>
      update({
        ...state,
        rotation: ((state.rotation + 90) % 360) as Rotation,
      }),
    [state, update],
  )

  const rotateLeft = useCallback(
    () =>
      update({
        ...state,
        rotation: ((state.rotation + 270) % 360) as Rotation,
      }),
    [state, update],
  )

  const toggleMirror = useCallback(
    () => update({ ...state, mirrored: !state.mirrored }),
    [state, update],
  )

  const setZoom = useCallback(
    (zoom: number) => update({ ...state, zoom: clampZoom(zoom) }),
    [state, update],
  )

  const zoomIn = useCallback(
    () => update({ ...state, zoom: clampZoom(state.zoom + ZOOM_STEP) }),
    [state, update],
  )

  const zoomOut = useCallback(
    () => update({ ...state, zoom: clampZoom(state.zoom - ZOOM_STEP) }),
    [state, update],
  )

  const reset = useCallback(() => update(DEFAULT_STATE), [update])

  // Compose transform: mirror → rotate → scale.
  // Order matters; rotation around centre then scale yields intuitive zoom.
  const transform = `${state.mirrored ? 'scaleX(-1) ' : ''}rotate(${state.rotation}deg) scale(${state.zoom})`

  return {
    rotation: state.rotation,
    mirrored: state.mirrored,
    zoom: state.zoom,
    transform,
    rotateLeft,
    rotateRight,
    toggleMirror,
    zoomIn,
    zoomOut,
    setZoom,
    reset,
  }
}

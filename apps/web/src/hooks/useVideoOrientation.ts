/**
 * Per-tile webcam orientation: 0/90/180/270 rotation + horizontal mirror.
 * State is persisted to localStorage keyed by tileId so a user's preferred
 * orientation for a given seat sticks across reloads.
 */
import { useCallback, useEffect, useState } from 'react'

export type Rotation = 0 | 90 | 180 | 270

export interface VideoOrientationState {
  rotation: Rotation
  mirrored: boolean
}

const STORAGE_PREFIX = 'spell-casters:tile-orientation:'
const VALID_ROTATIONS: ReadonlyArray<Rotation> = [0, 90, 180, 270]

function load(tileId: string): VideoOrientationState {
  if (typeof window === 'undefined') return { rotation: 0, mirrored: false }
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tileId)
    if (!raw) return { rotation: 0, mirrored: false }
    const parsed = JSON.parse(raw) as Partial<VideoOrientationState>
    const rotation = VALID_ROTATIONS.includes(parsed.rotation as Rotation)
      ? (parsed.rotation as Rotation)
      : 0
    return { rotation, mirrored: Boolean(parsed.mirrored) }
  } catch {
    return { rotation: 0, mirrored: false }
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

  const reset = useCallback(
    () => update({ rotation: 0, mirrored: false }),
    [update],
  )

  // Compose transform; mirror is applied first so rotation appears intuitive
  const transform = `${state.mirrored ? 'scaleX(-1) ' : ''}rotate(${state.rotation}deg)`

  return {
    rotation: state.rotation,
    mirrored: state.mirrored,
    transform,
    rotateLeft,
    rotateRight,
    toggleMirror,
    reset,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseDeltaDisplayOptions {
  /**
   * Time in milliseconds after which the delta hides (default: 1200)
   */
  hideAfterMs?: number
}

interface UseDeltaDisplayResult {
  /**
   * The accumulated delta value (positive or negative)
   */
  delta: number
  /**
   * Whether the delta indicator should be visible
   */
  visible: boolean
  /**
   * Call this whenever the value changes by some delta
   * @param d The delta value (positive for increment, negative for decrement)
   */
  addDelta: (d: number) => void
}

/**
 * Hook that tracks a cumulative delta value and hides it after a debounced timeout.
 * Useful for showing "+3" / "-5" style indicators next to increment/decrement controls.
 *
 * @example
 * const { delta, visible, addDelta } = useDeltaDisplay()
 *
 * const handleChange = (d: number) => {
 *   updateValue(d)
 *   addDelta(d)
 * }
 */
export function useDeltaDisplay(
  options: UseDeltaDisplayOptions = {},
): UseDeltaDisplayResult {
  const { hideAfterMs = 1200 } = options

  const [delta, setDelta] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const addDelta = useCallback(
    (d: number) => {
      setDelta((prev) => prev + d)
      setVisible(true)

      // Reset hide timer
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        setVisible(false)
        setDelta(0)
      }, hideAfterMs)
    },
    [hideAfterMs],
  )

  return { delta, visible, addDelta }
}

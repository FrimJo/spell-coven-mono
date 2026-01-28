import { useRef, useEffect, useCallback } from 'react'

interface UseHoldToRepeatOptions {
  /**
   * Callback function that receives the delta value to apply
   */
  onChange: (delta: number) => void
  /**
   * The immediate delta to apply on first press (default: 1)
   */
  immediateDelta?: number
  /**
   * The delta to apply every second while held (default: 10)
   */
  repeatDelta?: number
  /**
   * The interval in milliseconds between repeats (default: 1000)
   */
  repeatInterval?: number
}

/**
 * Hook that provides hold-to-repeat functionality for increment/decrement buttons.
 * On press: immediately applies immediateDelta, then repeats repeatDelta every repeatInterval.
 * 
 * @example
 * const { handleStart, handleStop } = useHoldToRepeat({
 *   onChange: (delta) => handleHealthChange(delta),
 * })
 * 
 * <Button
 *   onMouseDown={handleStart}
 *   onMouseUp={handleStop}
 *   onMouseLeave={handleStop}
 *   onTouchStart={handleStart}
 *   onTouchEnd={handleStop}
 * >
 *   <Plus />
 * </Button>
 */
export function useHoldToRepeat({
  onChange,
  immediateDelta = 1,
  repeatDelta = 10,
  repeatInterval = 1000,
}: UseHoldToRepeatOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      // Clear any existing interval (shouldn't happen, but safety first)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      // Immediate change
      onChange(immediateDelta)
      // Start interval for repeated changes
      intervalRef.current = setInterval(() => {
        onChange(repeatDelta)
      }, repeatInterval)
    },
    [onChange, immediateDelta, repeatDelta, repeatInterval],
  )

  const handleStop = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  return {
    handleStart,
    handleStop,
  }
}

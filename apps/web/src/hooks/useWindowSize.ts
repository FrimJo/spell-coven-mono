import { useSyncExternalStore } from 'react'

interface WindowSize {
  width: number
  height: number
}

const windowSizeStore = {
  value: {
    width: 0,
    height: 0,
  } as WindowSize,
  listeners: new Set<() => void>(),
}

const handleResize = () => {
  if (typeof window === 'undefined') {
    return
  }

  const nextValue = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  if (
    nextValue.width === windowSizeStore.value.width &&
    nextValue.height === windowSizeStore.value.height
  ) {
    return
  }

  windowSizeStore.value = nextValue
  windowSizeStore.listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  if (windowSizeStore.listeners.size === 0) {
    handleResize()
    window.addEventListener('resize', handleResize)
  }

  windowSizeStore.listeners.add(listener)

  return () => {
    windowSizeStore.listeners.delete(listener)
    if (windowSizeStore.listeners.size === 0) {
      window.removeEventListener('resize', handleResize)
    }
  }
}

const getSnapshot = (): WindowSize => {
  if (typeof window === 'undefined') {
    return windowSizeStore.value
  }

  const nextValue = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  if (
    nextValue.width !== windowSizeStore.value.width ||
    nextValue.height !== windowSizeStore.value.height
  ) {
    windowSizeStore.value = nextValue
  }

  return windowSizeStore.value
}

const getServerSnapshot = (): WindowSize => ({
  width: 0,
  height: 0,
})

export function useWindowSize() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * useAudioOutput - Hook for managing audio output devices (speakers/headphones)
 * 
 * Unlike audio/video input devices that use getUserMedia(), audio output devices
 * use the HTMLMediaElement.setSinkId() API. This hook provides a consistent
 * interface for audio output device management.
 * 
 * Browser Support:
 * - Chrome/Edge: Full support
 * - Firefox: Supported (may require flag in older versions)
 * - Safari: NOT supported as of 2024
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface AudioOutputDevice {
  deviceId: string
  label: string
}

export interface UseAudioOutputOptions {
  /** Initial device ID to use (defaults to 'default') */
  initialDeviceId?: string
  /** Callback when device changes successfully */
  onDeviceChanged?: (deviceId: string) => void
  /** Callback when error occurs */
  onError?: (error: Error) => void
}

export interface UseAudioOutputReturn {
  /** Available audio output devices */
  devices: AudioOutputDevice[]
  /** Current device ID */
  currentDeviceId: string
  /** Switch to a different device */
  setOutputDevice: (deviceId: string) => Promise<void>
  /** Test the current output device with a tone */
  testOutput: () => Promise<void>
  /** Whether setSinkId is supported in this browser */
  isSupported: boolean
  /** Whether a test sound is currently playing */
  isTesting: boolean
  /** Refresh the list of available devices */
  refreshDevices: () => Promise<void>
  /** Current error if any */
  error: Error | null
  /** Is the device list loading */
  isLoading: boolean
}

/**
 * Hook for managing audio output devices with setSinkId API
 * 
 * @example Basic usage
 * ```tsx
 * const {
 *   devices,
 *   currentDeviceId,
 *   setOutputDevice,
 *   testOutput,
 *   isSupported
 * } = useAudioOutput({
 *   initialDeviceId: 'default'
 * })
 * 
 * return (
 *   <div>
 *     {!isSupported && <p>Audio output selection not supported in this browser</p>}
 *     
 *     <select value={currentDeviceId} onChange={e => setOutputDevice(e.target.value)}>
 *       {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
 *     </select>
 *     
 *     <button onClick={testOutput}>Test Sound</button>
 *   </div>
 * )
 * ```
 * 
 * @example With audio element
 * ```tsx
 * const audioRef = useRef<HTMLAudioElement>(null)
 * const { currentDeviceId } = useAudioOutput()
 * 
 * // Automatically sync audio element with selected device
 * useEffect(() => {
 *   if (audioRef.current && 'setSinkId' in audioRef.current) {
 *     audioRef.current.setSinkId(currentDeviceId)
 *   }
 * }, [currentDeviceId])
 * ```
 */
export function useAudioOutput(
  options: UseAudioOutputOptions = {},
): UseAudioOutputReturn {
  const {
    initialDeviceId = 'default',
    onDeviceChanged,
    onError,
  } = options

  const [devices, setDevices] = useState<AudioOutputDevice[]>([])
  const [currentDeviceId, setCurrentDeviceId] = useState<string>(initialDeviceId)
  const [isSupported, setIsSupported] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const onDeviceChangedRef = useRef(onDeviceChanged)
  const onErrorRef = useRef(onError)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const isEnumeratingRef = useRef(false)

  // Keep callback refs up to date
  useEffect(() => {
    onDeviceChangedRef.current = onDeviceChanged
    onErrorRef.current = onError
  }, [onDeviceChanged, onError])

  // Check for setSinkId support
  useEffect(() => {
    // Create a test audio element to check for setSinkId support
    const testAudio = document.createElement('audio')
    const supported = 'setSinkId' in testAudio
    setIsSupported(supported)

    if (!supported) {
      console.warn(
        '[useAudioOutput] setSinkId() not supported in this browser. ' +
        'Audio output device selection will not work.',
      )
    }

    // Create and store an audio element for testing
    audioElementRef.current = new Audio()
    
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.src = ''
        audioElementRef.current = null
      }
    }
  }, [])

  /**
   * Refresh the list of available audio output devices
   */
  const refreshDevices = useCallback(async () => {
    // Prevent concurrent enumeration
    if (isEnumeratingRef.current) return
    isEnumeratingRef.current = true
    setIsLoading(true)

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      
      const audioOutputs = allDevices
        .filter((device) => device.kind === 'audiooutput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 8)}`,
        }))

      // Find the default device to avoid showing duplicates
      const defaultDevice = audioOutputs.find((d) => d.deviceId === 'default')
      let defaultLabel = defaultDevice?.label || 'Unknown'

      // Strip "Default - " prefix if present (browser adds this to default device)
      if (defaultLabel.startsWith('Default - ')) {
        defaultLabel = defaultLabel.substring('Default - '.length)
      }

      // Filter out the specific device that matches the current default
      // to avoid showing both "Default - MacBook Pro Speakers" and "MacBook Pro Speakers"
      const filteredOutputs = audioOutputs.filter((device) => {
        if (device.deviceId === 'default') return false
        
        // If this device's label matches the default (with or without "Default - " prefix), it's a duplicate
        const cleanLabel = device.label.startsWith('Default - ')
          ? device.label.substring('Default - '.length)
          : device.label
          
        if (defaultDevice && cleanLabel === defaultLabel) return false
        
        return true
      })

      // Always include a "System Default" option at the top
      const outputsWithDefault: AudioOutputDevice[] = [
        {
          deviceId: 'default',
          label: `System Default${defaultLabel !== 'Unknown' ? ` (${defaultLabel})` : ''}`,
        },
        ...filteredOutputs,
      ]

      setDevices(outputsWithDefault)
      setError(null)

      // Validate current selection still exists
      if (currentDeviceId !== 'default' && !outputsWithDefault.find(d => d.deviceId === currentDeviceId)) {
        console.log('[useAudioOutput] Current device no longer available, switching to default')
        setCurrentDeviceId('default')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error('[useAudioOutput] Failed to enumerate devices:', error)
      setError(error)
      onErrorRef.current?.(error)
    } finally {
      isEnumeratingRef.current = false
      setIsLoading(false)
    }
  }, [currentDeviceId])

  /**
   * Set the audio output device
   */
  const setOutputDevice = useCallback(
    async (deviceId: string) => {
      if (!isSupported) {
        const err = new Error('setSinkId() not supported in this browser')
        setError(err)
        onErrorRef.current?.(err)
        throw err
      }

      try {
        setError(null)
        
        // Set the device on our internal audio element
        if (audioElementRef.current && 'setSinkId' in audioElementRef.current) {
          await (audioElementRef.current as any).setSinkId(deviceId)
        }

        setCurrentDeviceId(deviceId)
        onDeviceChangedRef.current?.(deviceId)
        
        console.log('[useAudioOutput] Audio output device changed to:', deviceId)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('[useAudioOutput] Failed to set audio output device:', error)
        setError(error)
        onErrorRef.current?.(error)
        throw error
      }
    },
    [isSupported],
  )

  /**
   * Test the current output device by playing a short tone
   */
  const testOutput = useCallback(async () => {
    if (!audioElementRef.current) {
      const err = new Error('Audio element not initialized')
      setError(err)
      onErrorRef.current?.(err)
      throw err
    }

    setIsTesting(true)
    setError(null)

    try {
      // Create a simple test tone using Web Audio API
      const audioContext = new AudioContext()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      // Create a destination that we can connect to setSinkId
      const destination = audioContext.createMediaStreamDestination()

      oscillator.connect(gainNode)
      gainNode.connect(destination)
      
      // Set up the tone (A4 note at 440Hz)
      oscillator.frequency.value = 440
      oscillator.type = 'sine'
      gainNode.gain.value = 0.1 // Low volume

      // Connect to our audio element
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = destination.stream
        
        // Ensure the audio element is using the current device
        if (isSupported && 'setSinkId' in audioElementRef.current) {
          await (audioElementRef.current as any).setSinkId(currentDeviceId)
        }
        
        await audioElementRef.current.play()
      }

      // Play the tone for 500ms
      oscillator.start()
      
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          oscillator.stop()
          audioContext.close()
          
          if (audioElementRef.current) {
            audioElementRef.current.pause()
            audioElementRef.current.srcObject = null
          }
          
          resolve()
        }, 500)
      })
      
      console.log('[useAudioOutput] Test tone played successfully')
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error('[useAudioOutput] Failed to test audio output:', error)
      setError(error)
      onErrorRef.current?.(error)
      throw error
    } finally {
      setIsTesting(false)
    }
  }, [currentDeviceId, isSupported])

  // Initial device enumeration
  useEffect(() => {
    void refreshDevices()
  }, [refreshDevices])

  // Listen for device changes (plug/unplug)
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('[useAudioOutput] Device change detected, refreshing...')
      void refreshDevices()
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [refreshDevices])

  return {
    devices,
    currentDeviceId,
    setOutputDevice,
    testOutput,
    isSupported,
    isTesting,
    refreshDevices,
    error,
    isLoading,
  }
}


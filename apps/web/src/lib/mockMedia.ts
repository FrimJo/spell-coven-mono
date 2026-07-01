/**
 * Mock Media Module
 *
 * Enables testing of webcam/microphone UI in browsers that block media device access
 * (like Cursor's built-in browser) by mocking the navigator.mediaDevices APIs.
 *
 * Activation methods:
 * 1. Query parameter: Add ?mockMedia=true to the URL
 * 2. Console command: Run window.enableMockMedia() then refresh
 * 3. Programmatic: Call enableMockMedia() before app initialization
 *
 * The mock provides:
 * - Fake "granted" permission states for camera/microphone
 * - Synthetic video stream from a canvas (animated test pattern) OR video file
 * - Silent audio stream
 * - Fake device enumeration (virtual camera/microphone)
 */

// Storage key for persisting mock mode
const MOCK_MEDIA_STORAGE_KEY = 'spell-coven-mock-media-enabled'

// Source of mock media activation
type MockMediaSource = 'url' | 'localStorage' | 'manual'

// Check if mock media should be enabled and what mode
export function getMockMediaConfig(): {
  enabled: boolean
  source: MockMediaSource | null
} {
  if (typeof window === 'undefined') return { enabled: false, source: null }

  // Check URL parameter first (takes precedence)
  const urlParams = new URLSearchParams(window.location.search)
  const mockParam = urlParams.get('mockMedia')

  // Explicit disable via URL clears localStorage too
  if (mockParam === 'false') {
    try {
      localStorage.removeItem(MOCK_MEDIA_STORAGE_KEY)
    } catch {
      // Ignore
    }
    return { enabled: false, source: null }
  }

  if (mockParam === 'true' || mockParam === 'canvas') {
    return { enabled: true, source: 'url' }
  }

  // Check localStorage (set via console command) - only if no URL param
  try {
    if (localStorage.getItem(MOCK_MEDIA_STORAGE_KEY) === 'true') {
      return { enabled: true, source: 'localStorage' }
    }
  } catch {
    // localStorage may be blocked
  }

  return { enabled: false, source: null }
}

// Legacy compatibility
export function shouldEnableMockMedia(): boolean {
  return getMockMediaConfig().enabled
}

// Create a synthetic video stream from a canvas
export function createSyntheticVideoStream(): MediaStream {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error(
      'createSyntheticVideoStream: Failed to get 2d context from canvas',
    )
  }
  const canvasCtx = ctx

  let frameCount = 0

  // Animate the canvas
  function drawFrame() {
    frameCount++

    // Background gradient
    const gradient = canvasCtx.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height,
    )
    gradient.addColorStop(0, '#1e1b4b') // indigo-950
    gradient.addColorStop(0.5, '#312e81') // indigo-900
    gradient.addColorStop(1, '#1e1b4b')
    canvasCtx.fillStyle = gradient
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height)

    // Animated circles
    const time = Date.now() / 1000
    for (let i = 0; i < 5; i++) {
      const x = canvas.width / 2 + Math.cos(time + i * 1.2) * (100 + i * 30)
      const y =
        canvas.height / 2 + Math.sin(time * 0.8 + i * 1.5) * (80 + i * 20)
      const radius = 20 + Math.sin(time * 2 + i) * 10

      canvasCtx.beginPath()
      canvasCtx.arc(x, y, radius, 0, Math.PI * 2)
      canvasCtx.fillStyle = `hsla(${(frameCount + i * 50) % 360}, 70%, 60%, 0.6)`
      canvasCtx.fill()
    }

    // Draw "Mock Camera" text
    canvasCtx.font = 'bold 24px system-ui, sans-serif'
    canvasCtx.textAlign = 'center'
    canvasCtx.fillStyle = '#e0e7ff' // indigo-100
    canvasCtx.fillText('🎥 Mock Camera Active', canvas.width / 2, 40)

    // Draw frame counter
    canvasCtx.font = '14px monospace'
    canvasCtx.fillStyle = '#a5b4fc' // indigo-300
    canvasCtx.fillText(
      `Frame: ${frameCount}`,
      canvas.width / 2,
      canvas.height - 20,
    )

    // Draw timestamp
    const timestamp = new Date().toLocaleTimeString()
    canvasCtx.fillText(timestamp, canvas.width / 2, canvas.height - 40)

    requestAnimationFrame(drawFrame)
  }

  drawFrame()

  // Capture stream from canvas at 30fps
  const stream = canvas.captureStream(30)
  return stream
}

// Create a silent audio stream
export function createSilentAudioStream(): MediaStream {
  const audioContext = new AudioContext()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  // Set gain to 0 (silent)
  gainNode.gain.value = 0

  oscillator.connect(gainNode)
  const dest = audioContext.createMediaStreamDestination()
  gainNode.connect(dest)

  oscillator.start()

  return dest.stream
}

// Fake device info
const MOCK_DEVICES: MediaDeviceInfo[] = [
  {
    deviceId: 'mock-camera-1',
    groupId: 'mock-group-1',
    kind: 'videoinput',
    label: '🎥 Mock Camera (Cursor Browser)',
    toJSON: () => ({}),
  },
  {
    deviceId: 'mock-microphone-1',
    groupId: 'mock-group-1',
    kind: 'audioinput',
    label: '🎤 Mock Microphone (Cursor Browser)',
    toJSON: () => ({}),
  },
  {
    deviceId: 'mock-speaker-1',
    groupId: 'mock-group-1',
    kind: 'audiooutput',
    label: '🔊 Mock Speakers (Cursor Browser)',
    toJSON: () => ({}),
  },
]

// Store original APIs
let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia | null =
  null
let originalEnumerateDevices:
  | typeof navigator.mediaDevices.enumerateDevices
  | null = null
let originalPermissionsQuery: typeof navigator.permissions.query | null = null
let isMockEnabled = false
// Enable mock media APIs
// persist: true = save to localStorage (for console commands), false = session only (for URL params)
export function enableMockMedia(persist: boolean = true): void {
  if (typeof window === 'undefined') return
  if (isMockEnabled) {
    console.log('[MockMedia] Already enabled')
    return
  }

  console.log(
    '%c[MockMedia] 🎭 Enabling mock media mode',
    'color: #818cf8; font-weight: bold; font-size: 14px',
  )
  console.log(
    `%c[MockMedia] Persistence: ${persist ? '💾 Saved to localStorage' : '⏱️ Session only (use ?mockMedia=true to persist)'}`,
    'color: #a5b4fc',
  )

  // Store originals
  originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
    navigator.mediaDevices,
  )
  originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(
    navigator.mediaDevices,
  )
  if (navigator.permissions?.query) {
    originalPermissionsQuery = navigator.permissions.query.bind(
      navigator.permissions,
    )
  }

  // Mock getUserMedia
  navigator.mediaDevices.getUserMedia = async (
    constraints?: MediaStreamConstraints,
  ): Promise<MediaStream> => {
    console.log('[MockMedia] getUserMedia called with:', constraints)

    const tracks: MediaStreamTrack[] = []

    // Add video track if requested
    if (constraints?.video) {
      const videoStream = createSyntheticVideoStream()
      tracks.push(...videoStream.getVideoTracks())
    }

    // Add audio track if requested
    if (constraints?.audio) {
      const audioStream = createSilentAudioStream()
      tracks.push(...audioStream.getAudioTracks())
    }

    const stream = new MediaStream(tracks)
    console.log('[MockMedia] Returning mock stream:', stream)
    return stream
  }

  // Mock enumerateDevices
  navigator.mediaDevices.enumerateDevices = async (): Promise<
    MediaDeviceInfo[]
  > => {
    console.log('[MockMedia] enumerateDevices called, returning mock devices')
    return MOCK_DEVICES
  }

  // Mock permissions API
  if (navigator.permissions) {
    navigator.permissions.query = async (
      descriptor: PermissionDescriptor,
    ): Promise<PermissionStatus> => {
      const name = descriptor.name
      console.log(`[MockMedia] permissions.query called for: ${name}`)

      // For camera and microphone, return granted
      if (name === 'camera' || name === 'microphone') {
        return {
          state: 'granted',
          name,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        } as unknown as PermissionStatus
      }

      // For other permissions, use original if available
      if (originalPermissionsQuery) {
        return originalPermissionsQuery(descriptor)
      }

      // Fallback
      return {
        state: 'prompt',
        name,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      } as unknown as PermissionStatus
    }
  }

  isMockEnabled = true

  // Persist to localStorage only if requested (console commands persist, URL params don't)
  if (persist) {
    try {
      localStorage.setItem(MOCK_MEDIA_STORAGE_KEY, 'true')
    } catch {
      // Ignore
    }
  }

  console.log(
    '%c[MockMedia] ✅ Mock media enabled!',
    'color: #4ade80; font-weight: bold',
  )
}

// Disable mock media APIs
export function disableMockMedia(): void {
  if (typeof window === 'undefined') return
  if (!isMockEnabled) {
    console.log('[MockMedia] Not enabled')
    return
  }

  console.log('[MockMedia] Disabling mock media mode')

  // Restore originals
  if (originalGetUserMedia) {
    navigator.mediaDevices.getUserMedia = originalGetUserMedia
  }
  if (originalEnumerateDevices) {
    navigator.mediaDevices.enumerateDevices = originalEnumerateDevices
  }
  if (originalPermissionsQuery && navigator.permissions) {
    navigator.permissions.query = originalPermissionsQuery
  }

  isMockEnabled = false
  // Clear localStorage
  try {
    localStorage.removeItem(MOCK_MEDIA_STORAGE_KEY)
  } catch {
    // Ignore
  }

  console.log('[MockMedia] Disabled. Refresh the page to use real devices.')
}

// Check if mock media is currently enabled
export function isMockMediaEnabled(): boolean {
  return isMockEnabled
}

// Initialize mock media if conditions are met
export function initMockMedia(): void {
  if (typeof window === 'undefined')
    return // Expose global functions for console access (these always persist)
  ;(window as unknown as { enableMockMedia: () => void }).enableMockMedia =
    () => enableMockMedia(true)
  ;(
    window as unknown as { disableMockMedia: typeof disableMockMedia }
  ).disableMockMedia = disableMockMedia
  ;(
    window as unknown as { isMockMediaEnabled: typeof isMockMediaEnabled }
  ).isMockMediaEnabled = isMockMediaEnabled

  // Auto-enable if conditions are met
  const config = getMockMediaConfig()
  if (config.enabled) {
    // URL params don't persist, localStorage does
    const shouldPersist = config.source === 'localStorage'
    enableMockMedia(shouldPersist)
  } else {
    console.log(
      '%c[MockMedia] 💡 To enable mock camera/microphone:',
      'color: #94a3b8; font-style: italic',
    )
    console.log(
      '%c   • URL param: ?mockMedia=true (session only)',
      'color: #94a3b8',
    )
    console.log(
      '%c   • Console: enableMockMedia() (persists)',
      'color: #94a3b8',
    )
    console.log(
      '%c   • To clear persisted state: ?mockMedia=false or disableMockMedia()',
      'color: #94a3b8',
    )
  }
}

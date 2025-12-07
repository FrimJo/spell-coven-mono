/**
 * Mock Media Module
 *
 * Enables testing of webcam/microphone UI in browsers that block media device access
 * (like Cursor's built-in browser) by mocking the navigator.mediaDevices APIs.
 *
 * Activation methods:
 * 1. Query parameter: Add ?mockMedia=true to the URL
 *    - Use ?mockMedia=video to use the card_demo.webm video file
 * 2. Console command: Run window.enableMockMedia() then refresh
 *    - Use window.enableMockMedia('video') to use video file
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
const MOCK_MEDIA_MODE_KEY = 'spell-coven-mock-media-mode'

// Default video URL for realistic mock (card demo video)
const DEFAULT_VIDEO_URL = '/card_demo.webm'

export type MockMediaMode = 'canvas' | 'video'

// Source of mock media activation
type MockMediaSource = 'url' | 'localStorage' | 'manual'

// Check if mock media should be enabled and what mode
export function getMockMediaConfig(): {
  enabled: boolean
  mode: MockMediaMode
  source: MockMediaSource | null
} {
  if (typeof window === 'undefined') return { enabled: false, mode: 'canvas', source: null }

  // Check URL parameter first (takes precedence)
  const urlParams = new URLSearchParams(window.location.search)
  const mockParam = urlParams.get('mockMedia')

  // Explicit disable via URL clears localStorage too
  if (mockParam === 'false') {
    try {
      localStorage.removeItem(MOCK_MEDIA_STORAGE_KEY)
      localStorage.removeItem(MOCK_MEDIA_MODE_KEY)
    } catch {
      // Ignore
    }
    return { enabled: false, mode: 'canvas', source: null }
  }

  if (mockParam === 'true' || mockParam === 'canvas') {
    return { enabled: true, mode: 'canvas', source: 'url' }
  }
  if (mockParam === 'video') {
    return { enabled: true, mode: 'video', source: 'url' }
  }

  // Check localStorage (set via console command) - only if no URL param
  try {
    if (localStorage.getItem(MOCK_MEDIA_STORAGE_KEY) === 'true') {
      const mode = (localStorage.getItem(MOCK_MEDIA_MODE_KEY) as MockMediaMode) || 'canvas'
      return { enabled: true, mode, source: 'localStorage' }
    }
  } catch {
    // localStorage may be blocked
  }

  return { enabled: false, mode: 'canvas', source: null }
}

// Legacy compatibility
export function shouldEnableMockMedia(): boolean {
  return getMockMediaConfig().enabled
}

// Test card image URL (Birds of Paradise)
const TEST_CARD_IMAGE_URL = '/cn2-176-birds-of-paradise.jpg'

// Create a synthetic video stream from a canvas
function createSyntheticVideoStream(): MediaStream {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')!

  let frameCount = 0

  // Load the test card image
  const cardImage = new Image()
  cardImage.src = TEST_CARD_IMAGE_URL
  let cardImageLoaded = false
  cardImage.onload = () => {
    cardImageLoaded = true
    console.log('[MockMedia] Test card image loaded:', TEST_CARD_IMAGE_URL)
  }
  cardImage.onerror = () => {
    console.warn('[MockMedia] Failed to load test card image:', TEST_CARD_IMAGE_URL)
  }

  // Animate the canvas
  function drawFrame() {
    frameCount++

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#1e1b4b') // indigo-950
    gradient.addColorStop(0.5, '#312e81') // indigo-900
    gradient.addColorStop(1, '#1e1b4b')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Animated circles
    const time = Date.now() / 1000
    for (let i = 0; i < 5; i++) {
      const x =
        canvas.width / 2 + Math.cos(time + i * 1.2) * (100 + i * 30)
      const y =
        canvas.height / 2 + Math.sin(time * 0.8 + i * 1.5) * (80 + i * 20)
      const radius = 20 + Math.sin(time * 2 + i) * 10

      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${(frameCount + i * 50) % 360}, 70%, 60%, 0.6)`
      ctx.fill()
    }

    // Draw "Mock Camera" text
    ctx.font = 'bold 24px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e0e7ff' // indigo-100
    ctx.fillText('🎥 Mock Camera Active', canvas.width / 2, 40)

    // Draw frame counter
    ctx.font = '14px monospace'
    ctx.fillStyle = '#a5b4fc' // indigo-300
    ctx.fillText(`Frame: ${frameCount}`, canvas.width / 2, canvas.height - 20)

    // Draw timestamp
    const timestamp = new Date().toLocaleTimeString()
    ctx.fillText(timestamp, canvas.width / 2, canvas.height - 40)

    // Draw the test card (Birds of Paradise) in the center
    // Standard MTG card aspect ratio is approximately 63mm x 88mm (roughly 2.5:3.5 or 5:7)
    const cardHeight = 280
    const cardWidth = cardHeight * (63 / 88) // Maintain proper MTG card aspect ratio
    const cardX = canvas.width / 2 - cardWidth / 2
    const cardY = canvas.height / 2 - cardHeight / 2 + 10

    if (cardImageLoaded) {
      // Draw the actual card image rotated 180 degrees (cards are usually upside down in streams)
      ctx.save()
      // Translate to card center, rotate 180°, then draw centered
      const cardCenterX = cardX + cardWidth / 2
      const cardCenterY = cardY + cardHeight / 2
      ctx.translate(cardCenterX, cardCenterY)
      ctx.rotate(Math.PI) // 180 degrees
      ctx.drawImage(cardImage, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight)
      ctx.restore()

      // Add a subtle border/glow effect
      ctx.strokeStyle = '#818cf8' // indigo-400
      ctx.lineWidth = 2
      ctx.strokeRect(cardX - 1, cardY - 1, cardWidth + 2, cardHeight + 2)
    } else {
      // Fallback: Draw placeholder while image loads
      ctx.strokeStyle = '#818cf8' // indigo-400
      ctx.lineWidth = 3
      ctx.strokeRect(cardX, cardY, cardWidth, cardHeight)

      const artGradient = ctx.createLinearGradient(
        cardX,
        cardY,
        cardX + cardWidth,
        cardY + cardHeight
      )
      artGradient.addColorStop(0, '#4338ca')
      artGradient.addColorStop(1, '#7c3aed')
      ctx.fillStyle = artGradient
      ctx.fillRect(cardX + 10, cardY + 10, cardWidth - 20, cardHeight - 20)

      ctx.font = 'bold 14px system-ui'
      ctx.fillStyle = '#fff'
      ctx.fillText('Loading...', canvas.width / 2, cardY + cardHeight / 2)
    }

    requestAnimationFrame(drawFrame)
  }

  drawFrame()

  // Capture stream from canvas at 30fps
  const stream = canvas.captureStream(30)
  return stream
}

// Create a video stream from a video file URL
async function createVideoFileStream(videoUrl: string): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.src = videoUrl
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'

    video.onloadedmetadata = async () => {
      try {
        await video.play()

        // Use captureStream to get MediaStream from video element
        const stream = (video as HTMLVideoElement & {
          captureStream?: (frameRate?: number) => MediaStream
          mozCaptureStream?: (frameRate?: number) => MediaStream
        }).captureStream?.(30) ?? (video as HTMLVideoElement & {
          captureStream?: (frameRate?: number) => MediaStream
          mozCaptureStream?: (frameRate?: number) => MediaStream
        }).mozCaptureStream?.(30)

        if (!stream) {
          console.warn('[MockMedia] captureStream not supported, falling back to canvas')
          resolve(createSyntheticVideoStream())
          return
        }

        console.log('[MockMedia] Video file stream created from:', videoUrl)
        resolve(stream)
      } catch (err) {
        console.error('[MockMedia] Error playing video:', err)
        reject(err)
      }
    }

    video.onerror = () => {
      console.warn('[MockMedia] Failed to load video, falling back to canvas')
      resolve(createSyntheticVideoStream())
    }

    // Timeout fallback
    setTimeout(() => {
      if (video.readyState < 2) {
        console.warn('[MockMedia] Video load timeout, falling back to canvas')
        resolve(createSyntheticVideoStream())
      }
    }, 5000)
  })
}

// Create a silent audio stream
function createSilentAudioStream(): MediaStream {
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
let originalEnumerateDevices: typeof navigator.mediaDevices.enumerateDevices | null =
  null
let originalPermissionsQuery: typeof navigator.permissions.query | null = null
let isMockEnabled = false
let currentMode: MockMediaMode = 'canvas'

// Enable mock media APIs
// persist: true = save to localStorage (for console commands), false = session only (for URL params)
export function enableMockMedia(mode: MockMediaMode = 'canvas', persist: boolean = true): void {
  if (typeof window === 'undefined') return
  if (isMockEnabled) {
    console.log('[MockMedia] Already enabled')
    return
  }

  currentMode = mode

  console.log(
    '%c[MockMedia] 🎭 Enabling mock media mode',
    'color: #818cf8; font-weight: bold; font-size: 14px'
  )
  console.log(
    `%c[MockMedia] Mode: ${mode === 'video' ? '📹 Video file (card_demo.webm)' : '🎨 Animated canvas'}`,
    'color: #a5b4fc'
  )
  console.log(
    `%c[MockMedia] Persistence: ${persist ? '💾 Saved to localStorage' : '⏱️ Session only (use ?mockMedia=true to persist)'}`,
    'color: #a5b4fc'
  )

  // Store originals
  originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
    navigator.mediaDevices
  )
  originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(
    navigator.mediaDevices
  )
  if (navigator.permissions?.query) {
    originalPermissionsQuery = navigator.permissions.query.bind(
      navigator.permissions
    )
  }

  // Mock getUserMedia
  navigator.mediaDevices.getUserMedia = async (
    constraints?: MediaStreamConstraints
  ): Promise<MediaStream> => {
    console.log('[MockMedia] getUserMedia called with:', constraints)

    const tracks: MediaStreamTrack[] = []

    // Add video track if requested
    if (constraints?.video) {
      let videoStream: MediaStream
      if (currentMode === 'video') {
        videoStream = await createVideoFileStream(DEFAULT_VIDEO_URL)
      } else {
        videoStream = createSyntheticVideoStream()
      }
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
      descriptor: PermissionDescriptor
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
      localStorage.setItem(MOCK_MEDIA_MODE_KEY, mode)
    } catch {
      // Ignore
    }
  }

  console.log(
    '%c[MockMedia] ✅ Mock media enabled!',
    'color: #4ade80; font-weight: bold'
  )
  console.log(
    '%c[MockMedia] 💡 Commands: disableMockMedia() to disable, enableMockMedia("video") for video file',
    'color: #94a3b8'
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
  currentMode = 'canvas'

  // Clear localStorage
  try {
    localStorage.removeItem(MOCK_MEDIA_STORAGE_KEY)
    localStorage.removeItem(MOCK_MEDIA_MODE_KEY)
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
  if (typeof window === 'undefined') return

  // Expose global functions for console access (these always persist)
  ;(window as unknown as { enableMockMedia: (mode?: MockMediaMode) => void }).enableMockMedia =
    (mode: MockMediaMode = 'canvas') => enableMockMedia(mode, true)
  ;(window as unknown as { disableMockMedia: typeof disableMockMedia }).disableMockMedia =
    disableMockMedia
  ;(window as unknown as { isMockMediaEnabled: typeof isMockMediaEnabled }).isMockMediaEnabled =
    isMockMediaEnabled

  // Auto-enable if conditions are met
  const config = getMockMediaConfig()
  if (config.enabled) {
    // URL params don't persist, localStorage does
    const shouldPersist = config.source === 'localStorage'
    enableMockMedia(config.mode, shouldPersist)
  } else {
    console.log(
      '%c[MockMedia] 💡 To enable mock camera/microphone:',
      'color: #94a3b8; font-style: italic'
    )
    console.log(
      '%c   • URL param: ?mockMedia=true (session only) or ?mockMedia=video',
      'color: #94a3b8'
    )
    console.log(
      '%c   • Console: enableMockMedia() (persists) or enableMockMedia("video")',
      'color: #94a3b8'
    )
    console.log(
      '%c   • To clear persisted state: ?mockMedia=false or disableMockMedia()',
      'color: #94a3b8'
    )
  }
}


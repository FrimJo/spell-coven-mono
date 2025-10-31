import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useVoiceChannelEvents } from '../useVoiceChannelEvents'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  bufferedAmount = 0

  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: (() => void) | null = null

  constructor(public url: string) {
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.()
    }, 0)
  }

  send(data: string) {
    // Mock send
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  addEventListener() {}
  removeEventListener() {}
}

// Replace global WebSocket
global.WebSocket = MockWebSocket as any

describe('useVoiceChannelEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should connect to WebSocket on mount', async () => {
    const onVoiceLeft = vi.fn()

    renderHook(() =>
      useVoiceChannelEvents({
        userId: 'user-123',
        jwtToken: 'token-abc',
        onVoiceLeft,
      })
    )

    await waitFor(() => {
      expect(onVoiceLeft).not.toHaveBeenCalled()
    })
  })

  it('should call onVoiceLeft when receiving voice.left event for current user', async () => {
    const onVoiceLeft = vi.fn()

    const { result } = renderHook(() =>
      useVoiceChannelEvents({
        userId: 'user-123',
        jwtToken: 'token-abc',
        onVoiceLeft,
      })
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Simulate receiving voice.left event
    const ws = (global.WebSocket as any).prototype
    if (ws.onmessage) {
      ws.onmessage({
        data: JSON.stringify({
          v: 1,
          type: 'event',
          event: 'voice.left',
          payload: {
            guildId: 'guild-123',
            channelId: null,
            userId: 'user-123',
          },
          ts: Date.now(),
        }),
      })
    }

    await waitFor(() => {
      expect(onVoiceLeft).toHaveBeenCalledWith({
        guildId: 'guild-123',
        channelId: null,
        userId: 'user-123',
      })
    })
  })

  it('should not call onVoiceLeft for other users', async () => {
    const onVoiceLeft = vi.fn()

    const { result } = renderHook(() =>
      useVoiceChannelEvents({
        userId: 'user-123',
        jwtToken: 'token-abc',
        onVoiceLeft,
      })
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Simulate receiving voice.left event for different user
    const ws = (global.WebSocket as any).prototype
    if (ws.onmessage) {
      ws.onmessage({
        data: JSON.stringify({
          v: 1,
          type: 'event',
          event: 'voice.left',
          payload: {
            guildId: 'guild-123',
            channelId: null,
            userId: 'other-user',
          },
          ts: Date.now(),
        }),
      })
    }

    // Wait a bit to ensure callback isn't called
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(onVoiceLeft).not.toHaveBeenCalled()
  })

  it('should handle WebSocket errors', async () => {
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useVoiceChannelEvents({
        userId: 'user-123',
        jwtToken: 'token-abc',
        onError,
      })
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    // Simulate error
    const ws = (global.WebSocket as any).prototype
    if (ws.onerror) {
      ws.onerror(new Event('error'))
    }

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })
})

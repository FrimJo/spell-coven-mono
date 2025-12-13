/**
 * Integration tests for ChannelManager
 *
 * Tests cover channel creation, sharing, presence key handling,
 * broadcast listener management, and cleanup.
 */

// Import after mocking
import { channelManager } from '@/lib/supabase/channel-manager'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Create mock channel factory - returns fresh mock for each call
function createMockChannel() {
  return {
    state: 'closed' as string,
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    track: vi.fn(),
    untrack: vi.fn(),
    send: vi.fn(),
    presenceState: vi.fn().mockReturnValue({}),
  }
}

// Shared mock state that persists across tests
let currentMockChannel = createMockChannel()
const mockRemoveChannel = vi.fn()
const mockChannelFactory = vi.fn(() => currentMockChannel)

// Mock the supabase client module - factory must not reference external variables
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannelFactory(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}))

describe('ChannelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Create fresh mock channel for each test
    currentMockChannel = createMockChannel()
    currentMockChannel.state = 'closed'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getChannel', () => {
    it('should create a new channel when none exists', () => {
      const roomId = 'test-room-create'
      const channel = channelManager.getChannel(roomId)

      expect(mockChannelFactory).toHaveBeenCalledWith(
        `game:${roomId}`,
        expect.objectContaining({
          config: { presence: { key: expect.any(String) } },
        }),
      )
      expect(channel).toBe(currentMockChannel)
    })

    it('should throw error when roomId is empty', () => {
      expect(() => channelManager.getChannel('')).toThrow(
        'ChannelManager.getChannel: roomId is required',
      )
    })

    it('should create channel with provided presence key', () => {
      const roomId = 'test-room-with-key'
      const presenceKey = 'user-session-123'

      channelManager.getChannel(roomId, { presence: { key: presenceKey } })

      expect(mockChannelFactory).toHaveBeenCalledWith(
        `game:${roomId}`,
        expect.objectContaining({
          config: { presence: { key: presenceKey } },
        }),
      )
    })

    it('should reuse existing channel with same presence key', () => {
      const roomId = 'test-room-reuse'
      const presenceKey = 'user-session-456'

      // First call creates the channel
      const channel1 = channelManager.getChannel(roomId, {
        presence: { key: presenceKey },
      })

      // Second call should reuse
      const channel2 = channelManager.getChannel(roomId, {
        presence: { key: presenceKey },
      })

      expect(channel1).toBe(channel2)
      // Should only create once
      expect(mockChannelFactory).toHaveBeenCalledTimes(1)
    })

    it('should upgrade channel from default key to specific key when not subscribed', () => {
      const roomId = 'test-room-upgrade'
      const specificKey = 'user-session-789'

      // First call without specific key (signaling)
      channelManager.getChannel(roomId)

      // Second call with specific key (presence)
      channelManager.getChannel(roomId, { presence: { key: specificKey } })

      // Should have created twice (upgrade)
      expect(mockChannelFactory).toHaveBeenCalledTimes(2)
      expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    })

    it('should not upgrade channel when already subscribed', () => {
      const roomId = 'test-room-subscribed'
      const specificKey = 'user-session-abc'

      // First call creates channel
      channelManager.getChannel(roomId)

      // Mark as subscribed
      channelManager.markSubscribed(roomId)

      // Second call with specific key should NOT recreate
      channelManager.getChannel(roomId, { presence: { key: specificKey } })

      // Should only create once (no upgrade after subscription)
      expect(mockChannelFactory).toHaveBeenCalledTimes(1)
      expect(mockRemoveChannel).not.toHaveBeenCalled()
    })
  })

  describe('broadcast listeners', () => {
    it('should register broadcast listener on channel', () => {
      const roomId = 'test-room-listener'
      const callback = vi.fn()

      channelManager.getChannel(roomId)
      channelManager.addBroadcastListener(roomId, 'test-event', callback)

      expect(currentMockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'test-event' },
        callback,
      )
    })

    it('should not register duplicate listener', () => {
      const roomId = 'test-room-no-dupe'
      const callback = vi.fn()

      channelManager.getChannel(roomId)
      channelManager.addBroadcastListener(roomId, 'test-event', callback)
      channelManager.addBroadcastListener(roomId, 'test-event', callback)

      // Should only register once
      expect(currentMockChannel.on).toHaveBeenCalledTimes(1)
    })

    it('should restore broadcast listeners after channel recreation', () => {
      const roomId = 'test-room-restore'
      const callback = vi.fn()

      // Create channel and add listener
      channelManager.getChannel(roomId)
      channelManager.addBroadcastListener(roomId, 'webrtc:signal', callback)

      // Clear mock to track new calls
      currentMockChannel.on.mockClear()

      // Create new mock for recreation
      const newMockChannel = createMockChannel()
      currentMockChannel = newMockChannel

      // Upgrade channel (should restore listener)
      channelManager.getChannel(roomId, {
        presence: { key: 'specific-session-key' },
      })

      // Listener should be re-registered on new channel
      expect(newMockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'webrtc:signal' },
        callback,
      )
    })
  })

  describe('subscription management', () => {
    it('should track subscription count', () => {
      const roomId = 'test-room-count'

      channelManager.getChannel(roomId)
      expect(channelManager.getSubscriptionCount(roomId)).toBe(0)

      channelManager.markSubscribed(roomId)
      expect(channelManager.getSubscriptionCount(roomId)).toBe(1)

      channelManager.markSubscribed(roomId)
      expect(channelManager.getSubscriptionCount(roomId)).toBe(2)

      channelManager.markUnsubscribed(roomId)
      expect(channelManager.getSubscriptionCount(roomId)).toBe(1)
    })

    it('should report subscription status', () => {
      const roomId = 'test-room-status'

      channelManager.getChannel(roomId)
      expect(channelManager.isSubscribed(roomId)).toBe(false)

      channelManager.markSubscribed(roomId)
      expect(channelManager.isSubscribed(roomId)).toBe(true)
    })
  })

  describe('channel removal', () => {
    it('should not remove channel with active subscriptions', () => {
      const roomId = 'test-room-no-remove'

      channelManager.getChannel(roomId)
      channelManager.markSubscribed(roomId)

      channelManager.removeChannel(roomId)

      // Should not have removed
      expect(mockRemoveChannel).not.toHaveBeenCalled()
      expect(channelManager.hasChannel(roomId)).toBe(true)
    })

    it('should remove channel with no active subscriptions', () => {
      const roomId = 'test-room-remove'

      channelManager.getChannel(roomId)

      channelManager.removeChannel(roomId)

      expect(mockRemoveChannel).toHaveBeenCalled()
      expect(channelManager.hasChannel(roomId)).toBe(false)
    })
  })

  describe('peekChannel', () => {
    it('should return null for non-existent channel', () => {
      expect(channelManager.peekChannel('non-existent-room')).toBeNull()
    })

    it('should return channel without creating it', () => {
      const roomId = 'test-room-peek'

      // First, peek should return null
      expect(channelManager.peekChannel(roomId)).toBeNull()

      // Create the channel
      channelManager.getChannel(roomId)

      // Now peek should return the channel
      expect(channelManager.peekChannel(roomId)).toBe(currentMockChannel)
    })
  })
})

describe('ChannelManager - Signaling and Presence Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentMockChannel = createMockChannel()
    currentMockChannel.state = 'closed'
  })

  it('should allow signaling to use channel created by presence', () => {
    const roomId = 'integration-room-presence-first'
    const sessionKey = 'session-123'

    // Presence creates channel first with specific key
    const presenceChannel = channelManager.getChannel(roomId, {
      presence: { key: sessionKey },
    })

    // Signaling gets the same channel
    const signalingChannel = channelManager.getChannel(roomId)

    expect(presenceChannel).toBe(signalingChannel)
    // Only one channel creation
    expect(mockChannelFactory).toHaveBeenCalledTimes(1)
  })

  it('should preserve broadcast listeners when presence creates channel after signaling', () => {
    const roomId = 'integration-room-signaling-first'
    const sessionKey = 'session-456'
    const signalHandler = vi.fn()

    // Signaling creates channel first (without specific key)
    channelManager.getChannel(roomId)

    // Signaling adds broadcast listener
    channelManager.addBroadcastListener(roomId, 'webrtc:signal', signalHandler)

    // Clear mock and create new channel for recreation
    currentMockChannel.on.mockClear()
    const newMockChannel = createMockChannel()
    currentMockChannel = newMockChannel

    // Presence gets channel with specific key (triggers upgrade)
    channelManager.getChannel(roomId, { presence: { key: sessionKey } })

    // Verify listener was restored on new channel
    expect(newMockChannel.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'webrtc:signal' },
      signalHandler,
    )
  })

  it('should not lose listeners when channel is already subscribed', () => {
    const roomId = 'integration-room-already-subscribed'
    const sessionKey = 'session-789'
    const signalHandler = vi.fn()

    // Signaling creates and subscribes to channel
    channelManager.getChannel(roomId)
    channelManager.addBroadcastListener(roomId, 'webrtc:signal', signalHandler)
    channelManager.markSubscribed(roomId)

    // Count how many times channel was created
    const initialCreateCount = mockChannelFactory.mock.calls.length

    // Presence tries to get channel with specific key
    // But since already subscribed, no recreation should happen
    channelManager.getChannel(roomId, { presence: { key: sessionKey } })

    // Should not have created a new channel
    expect(mockChannelFactory.mock.calls.length).toBe(initialCreateCount)
    expect(mockRemoveChannel).not.toHaveBeenCalled()
  })
})

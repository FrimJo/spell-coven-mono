/**
 * ICE server configuration for WebRTC
 *
 * Uses public Google STUN servers for NAT traversal.
 * TURN servers can be added here if needed for restrictive networks.
 */

export const DEFAULT_ICE_SERVERS: RTCConfiguration['iceServers'] = [
  {
    urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
  },
]

/**
 * Create ICE configuration for RTCPeerConnection
 */
export function createIceConfiguration(): RTCConfiguration {
  return {
    iceServers: DEFAULT_ICE_SERVERS,
    iceCandidatePoolSize: 10,
  }
}

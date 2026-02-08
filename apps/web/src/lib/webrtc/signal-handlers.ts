/**
 * WebRTC signal handling logic
 *
 * Pure functions for processing offer/answer/candidate signals.
 * Separated from WebRTCManager for testability.
 */

import type {
  AnswerSignal,
  CandidateSignal,
  OfferSignal,
  WebRTCSignal,
} from '@/types/webrtc-signal'

/**
 * Handle an offer signal
 * Note: Only sets remote description. The caller is responsible for creating the answer.
 */
export async function handleOffer(
  pc: RTCPeerConnection,
  signal: OfferSignal,
): Promise<void> {
  if (!signal.payload.sdp) {
    throw new Error('Offer signal missing SDP')
  }

  const offer = new RTCSessionDescription({
    type: 'offer',
    sdp: signal.payload.sdp,
  })

  await pc.setRemoteDescription(offer)
}

/**
 * Handle an answer signal.
 * Only sets remote description when in have-local-offer state.
 * Idempotent: ignores duplicate/late answers when already stable (handshake complete).
 */
export async function handleAnswer(
  pc: RTCPeerConnection,
  signal: AnswerSignal,
): Promise<void> {
  if (!signal.payload.sdp) {
    throw new Error('Answer signal missing SDP')
  }

  // setRemoteDescription(answer) is only valid in have-local-offer.
  // If we're already stable, the handshake is done (e.g. we already set this answer,
  // or we answered their offer and they're sending us an answer from "glare").
  if (pc.signalingState !== 'have-local-offer') {
    console.debug(
      `[WebRTC] Ignoring answer signal in state ${pc.signalingState} (expected have-local-offer)`,
    )
    return
  }

  const answer = new RTCSessionDescription({
    type: 'answer',
    sdp: signal.payload.sdp,
  })

  await pc.setRemoteDescription(answer)
}

/**
 * Handle an ICE candidate signal
 */
export async function handleCandidate(
  pc: RTCPeerConnection,
  signal: CandidateSignal,
): Promise<void> {
  if (!signal.payload.candidate) {
    throw new Error('Candidate signal missing candidate')
  }

  const candidate = new RTCIceCandidate({
    candidate: signal.payload.candidate,
    sdpMid: signal.payload.sdpMid ?? null,
    sdpMLineIndex: signal.payload.sdpMLineIndex ?? null,
    usernameFragment: signal.payload.usernameFragment ?? null,
  })

  await pc.addIceCandidate(candidate)
}

/**
 * Route a signal to the appropriate handler
 */
export async function handleSignal(
  pc: RTCPeerConnection,
  signal: WebRTCSignal,
): Promise<void> {
  switch (signal.type) {
    case 'offer':
      await handleOffer(pc, signal)
      break
    case 'answer':
      await handleAnswer(pc, signal)
      break
    case 'candidate':
      await handleCandidate(pc, signal)
      break
    case 'leave':
      // No action needed for leave signals
      break
    default:
      throw new Error(`Unknown signal type: ${(signal as WebRTCSignal).type}`)
  }
}

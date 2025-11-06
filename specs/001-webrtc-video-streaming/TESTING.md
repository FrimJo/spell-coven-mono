# Testing Guide: WebRTC Video Streaming MVP

## Prerequisites

1. **Development server running**: The TanStack Start server must be running
2. **Multiple browser instances**: You'll need at least 2 browser windows/tabs (or different devices) to test peer-to-peer connections
3. **Discord authentication**: Players must be authenticated via Discord (required for room access)
4. **Camera/microphone permissions**: Browser must allow camera and microphone access

## Starting the Development Server

```bash
# From the repository root
cd apps/web
bun run dev
```

The server will start at `https://localhost:1234` (HTTPS is required for WebRTC).

**Note**: The first time you run this, you may need to accept the self-signed certificate. Click "Advanced" → "Proceed to localhost" in your browser.

## Testing Setup

### Step 1: Start the Server

```bash
cd apps/web && bun run dev
```

### Step 2: Open Multiple Browser Instances

You need at least **2 players** to test peer-to-peer connections. Use one of these approaches:

**Option A: Multiple Browser Windows (Easiest)**
- Open one window in Chrome
- Open another window in Firefox (or Chrome Incognito)
- Use different Discord accounts in each

**Option B: Multiple Devices**
- One device on your local network
- Another device (phone, tablet, or another computer)
- Access via `https://<your-local-ip>:1234`

**Option C: Browser DevTools Remote Devices**
- Chrome DevTools → More tools → Remote devices
- Connect mobile device via USB debugging

### Step 3: Join the Same Game Room

1. Both players authenticate with Discord
2. Both players navigate to the same game room URL (e.g., `/game/123456789`)
3. Both players should see each other in the player list

### Step 4: Enable Video (Currently Manual)

**⚠️ IMPORTANT**: Currently, there's an integration gap. The video button in `VideoStreamGrid` calls `useWebcam`'s `startVideo()`, but **doesn't call WebRTC's `startVideo()`** to initialize peer connections.

**To test manually**, you can:

1. **Open browser console** (F12)
2. **Run this command** to manually start WebRTC:
   ```javascript
   // This will be fixed in the next update
   // For now, you need to manually trigger WebRTC startVideo
   ```

**OR** temporarily add this to GameRoom.tsx after the useWebRTC hook:

```typescript
// Temporary: Auto-start WebRTC when video is enabled
useEffect(() => {
  if (isWebRTCVideoActive && players.length > 1) {
    // Peer connections are already initialized
    console.log('[WebRTC] Video active, connections should be established')
  }
}, [isWebRTCVideoActive, players.length])
```

### Step 5: Verify Connections

**What to look for:**

1. **Connection Status Indicators** (top-right of each remote player's video card):
   - 🟢 Green WiFi icon = Connected
   - 🟡 Yellow WiFi icon = Connecting/Reconnecting
   - 🔴 Red WiFi icon = Failed/Disconnected

2. **Remote Video Streams**:
   - Remote players' video should appear in their video card
   - Stream should be live (not a placeholder)

3. **Browser Console** (F12):
   - Look for `[WebRTC]` and `[PeerConnection]` log messages
   - Should see: "Created offer", "Created answer", "ICE candidate generated"
   - Should see: "State transition: connecting → connected"

4. **Network Tab** (DevTools):
   - Check SSE connection at `/api/stream` (should be "EventStream")
   - Check for signaling messages via POST to server functions

## Expected Behavior

### ✅ Success Indicators

- **Both players see each other's video streams**
- **Connection status shows "connected" (green)**
- **Video quality is reasonable (at least 15 FPS)**
- **Connection establishes within 10 seconds**
- **No console errors related to WebRTC**

### ❌ Failure Indicators

- **Connection status stuck on "connecting" (yellow)**
- **Connection status shows "failed" (red)**
- **No video appears for remote players**
- **Console errors:**
  - `Failed to send offer/answer`
  - `ICE candidate failed`
  - `RTCPeerConnection error`

## Troubleshooting

### Issue: No video appears

**Check:**
1. Are both players in the same room? (Check room ID in URL)
2. Are camera permissions granted? (Browser should prompt)
3. Are there console errors?
4. Is SSE connection active? (Check Network tab → `/api/stream`)

**Fix:**
- Grant camera permissions
- Check browser console for errors
- Verify both players are authenticated

### Issue: Connection stuck on "connecting"

**Possible causes:**
- NAT traversal failing (STUN server not working)
- Firewall blocking WebRTC traffic
- Browser incompatibility

**Fix:**
- Check if `stun:stun.l.google.com:19302` is accessible
- Try different network (some corporate networks block WebRTC)
- Try different browser (Chrome, Firefox, Safari)

### Issue: ICE candidates failing

**Possible causes:**
- STUN-only NAT traversal insufficient (need TURN server)
- Network restrictions
- Symmetric NAT

**Fix:**
- Check console for ICE candidate errors
- May need to add TURN server configuration (future enhancement)

### Issue: Signaling messages not arriving

**Check:**
1. Is SSE connection active? (Network tab → `/api/stream`)
2. Are messages being sent? (Check console for `[WebRTC Signaling]` logs)
3. Are messages being received? (Check console for `Received signaling message`)

**Fix:**
- Refresh page to reconnect SSE
- Check server logs for errors
- Verify both players have active SSE connections

## Manual Testing Checklist

- [ ] Server starts without errors
- [ ] Two browser instances can connect
- [ ] Both players authenticate with Discord
- [ ] Both players join the same room
- [ ] Player list shows both players
- [ ] Video button enables local webcam (useWebcam)
- [ ] WebRTC connections initialize (check console)
- [ ] Offer/answer exchange completes (check console)
- [ ] ICE candidates are exchanged (check console)
- [ ] Connection status shows "connected" (green)
- [ ] Remote video streams appear in grid
- [ ] Video quality is acceptable
- [ ] Connection status indicators update correctly
- [ ] No console errors

## Next Steps After Testing

If testing reveals issues, the following may need to be implemented:

1. **Fix integration**: Connect VideoStreamGrid's video button to WebRTC's `startVideo()`
2. **Add error handling**: Implement Phase 5 (User Story 2) for connection failures
3. **Add controls**: Implement Phase 6 (User Story 3) for video/audio controls
4. **Add polish**: Implement Phase 7 for edge cases and cleanup

## Known Limitations (MVP)

- **Integration gap**: Video button doesn't automatically start WebRTC connections
- **No reconnection**: Connections don't automatically reconnect on failure
- **No controls**: Can't toggle video/audio for remote streams yet
- **STUN-only**: May fail behind restrictive NATs (no TURN server)
- **No permission handling**: Doesn't gracefully handle permission denials yet


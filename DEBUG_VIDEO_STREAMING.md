# Debug Guide: Video Streaming Not Working

## Step-by-Step Debugging Process

Follow these steps in order and report back what you see in the console.

### Step 1: Check if PeerJS Server is Running

**Action:**
```bash
cd apps/peerjs-server
bun run dev
```

**Expected Output:**
```
PeerJS Server listening on port 9000
```

**If not running:** Start the server first. Without it, video streaming cannot work.

---

### Step 2: Open Browser Console

Open the game room in **two separate browser tabs** (or two different browsers) to simulate two players.

**Player A:** `http://localhost:3000/game/YOUR_ROOM_ID`  
**Player B:** `http://localhost:3000/game/YOUR_ROOM_ID` (same room ID)

**Keep the browser console open for both tabs.**

---

### Step 3: Check Game Room Participant Tracking

When each player opens the page, look for these logs:

#### Expected Logs:

```
[useGameRoomParticipants] Hook called with: { roomId: '...', userId: '...', username: '...', enabled: true }
[GameRoomParticipants] Announcing presence in room: <roomId>
[GameRoomParticipants] Successfully joined room, current participants: 1
[useGameRoomParticipants] Participants updated: { count: 1, participants: [...] }
[GameRoom] remotePlayerIds calculated: { allParticipants: 1, localUserId: '...', remotePlayerIds: [] }
```

When the second player joins, **Player A** should see:

```
[GameRoomParticipants] Participant joined: <Player B username>
[useGameRoomParticipants] Participants updated: { count: 2, participants: [...] }
[GameRoom] remotePlayerIds calculated: { allParticipants: 2, localUserId: '...', remotePlayerIds: ['<Player B ID>'] }
```

#### ⚠️ If you DON'T see these logs:

**Problem:** Game room participant tracking is not working.

**Possible causes:**
1. API routes not registered
2. Network request failing
3. Hook not being called

**Check in Network tab (Chrome DevTools):**
- Look for `POST /api/gameroom/join` request
- Look for `GET /api/gameroom/stream` (EventSource)
- Check their status codes (should be 200)

**If requests are failing (404, 500):**
The API routes might not be loaded. The route files we created need to be in the correct location and properly exported.

---

### Step 4: Check Media Setup Dialog

Both players should see a media setup dialog when first joining.

#### Expected Logs:

```
[GameRoom] Media setup check: { setupCompleted: false, hasSavedDeviceId: false, mediaDialogOpen: true, willAutoInitialize: false }
[GameRoom] No setup completed yet, waiting for media dialog
```

**Complete the media setup** by selecting camera/microphone and clicking confirm.

#### After completing setup:

```
[GameRoom] Media dialog completed with config: { videoDeviceId: '...', audioInputDeviceId: '...', audioOutputDeviceId: '...' }
[GameRoom] Initializing local media with device: <deviceId>
[PeerJSManager] Local stream initialized: { hasVideo: true, hasAudio: true, videoDeviceId: '...' }
[GameRoom] Local media initialization complete
[VideoStreamGrid] Local stream available, setting hasStartedVideo=true
```

#### ⚠️ If you DON'T see media initialization logs:

**Problem:** Local stream not being created.

**Possible causes:**
1. Media permissions denied
2. No camera/microphone available
3. `initializeLocalMedia` not being called
4. `usePeerJS` hook not initialized

**Check:**
- Browser permissions for camera/microphone
- Camera light should turn on when setup completes
- Look for getUserMedia errors in console

---

### Step 5: Check PeerJS Connection

After both players have completed media setup, look for connection logs:

#### Expected Logs (Player A):

```
[PeerJSManager] Connecting to remote peers: ['<Player B ID>']
[PeerJSManager] Creating outgoing call to: <Player B ID>
```

#### Expected Logs (Player B):

```
[PeerJSManager] Incoming call from: <Player A ID>
[PeerJSManager] Answering incoming call from: <Player A ID>
[PeerJSManager] Connecting to remote peers: ['<Player A ID>']
[PeerJSManager] Creating outgoing call to: <Player A ID>
```

#### When streams are received:

```
[PeerJSManager] Received remote stream from: <peer ID>
[VideoStreamGrid] Remote streams effect triggered: { remoteStreamCount: 1, remoteStreamKeys: [...] }
[VideoStreamGrid] Processing remote stream for <peer ID>: { hasStream: true, hasVideoElement: true, videoTracks: 1 }
[VideoStreamGrid] Attaching stream to video element for <peer ID>
```

#### ⚠️ If you DON'T see PeerJS connection logs:

**Problem:** PeerJS not connecting.

**Possible causes:**
1. `remotePlayerIds` is empty (participant tracking failed)
2. PeerJS not initialized
3. PeerJS server not reachable
4. Network/firewall blocking WebRTC

**Check:**
- PeerJS server logs (should show connection attempts)
- `remotePlayerIds` in console (should contain other player's ID)
- Look for PeerJS errors about server connection

---

### Step 6: Check Video Rendering

Look for logs about video elements:

#### Expected Logs:

```
[VideoStreamGrid] Local player render: { playerId: '...', hasLocalStream: true, hasStartedVideo: true, localVideoEnabled: true, videoEnabled: true }
```

For remote players, after receiving stream:

```
[VideoStreamGrid] Video element update check for <peer ID>: { hasLiveVideoTrack: true, hadLiveVideoTrack: false, streamChanged: true, trackStateChanged: true }
[VideoStreamGrid] Attaching stream to video element for <peer ID>
```

#### ⚠️ If streams received but videos not showing:

**Problem:** Video elements not displaying.

**Possible causes:**
1. CSS display: none
2. Video element srcObject not set
3. Video autoplay blocked
4. Track state detection wrong

**Check:**
- Inspect video elements in DOM (should have srcObject set)
- Check if video elements are visible (not display: none)
- Look for browser autoplay policy errors

---

## Common Issues & Solutions

### Issue 1: "No participants showing up"

**Symptoms:**
- `remotePlayerIds` is always empty
- Participants list stays at 1 even with 2 players

**Solution:**
Check if API routes are accessible:
```bash
curl -X POST http://localhost:3000/api/gameroom/join \
  -H "Content-Type: application/json" \
  -d '{"roomId":"test","userId":"user1","username":"Test User"}'
```

Should return: `{"success":true,"participants":[...]}`

If 404: Routes not loaded. Check file locations:
- `apps/web/src/routes/api/gameroom/join.ts`
- `apps/web/src/routes/api/gameroom/leave.ts`
- `apps/web/src/routes/api/gameroom/stream.ts`

---

### Issue 2: "PeerJS initialization timeout"

**Symptoms:**
```
[PeerJSManager] Peer initialization timeout. The PeerJS server at ... may not be running.
```

**Solution:**
1. Start PeerJS server: `cd apps/peerjs-server && bun run dev`
2. Check if port 9000 is available
3. Check env variables match server config

---

### Issue 3: "Camera permissions denied"

**Symptoms:**
- getUserMedia errors in console
- Camera light never turns on

**Solution:**
1. Check browser permissions (camera icon in address bar)
2. Grant camera/microphone permissions
3. Reload page after granting permissions

---

### Issue 4: "Local video shows but remote doesn't"

**Symptoms:**
- Can see own video
- Cannot see other player's video
- `remoteStreams` Map is empty

**Solution:**
1. Check if `remotePlayerIds` contains other player's ID
2. Check PeerJS connection logs
3. Check if both players completed media setup
4. Check if PeerJS calls are being created

---

## What to Report Back

Please run through Steps 1-6 and report:

1. **Which step fails?** (participant tracking, media init, PeerJS connection, etc.)
2. **Console logs** for both Player A and Player B
3. **Network tab** showing:
   - POST /api/gameroom/join (status code?)
   - GET /api/gameroom/stream (EventSource connected?)
4. **Any error messages** in console
5. **PeerJS server logs** (if server is running)

With this information, I can pinpoint exactly where the flow is breaking and fix it.


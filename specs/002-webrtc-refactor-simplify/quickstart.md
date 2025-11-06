# Quickstart: WebRTC Refactoring Validation

**Feature**: 002-webrtc-refactor-simplify  
**Purpose**: Testing and validation guide for refactoring work  
**Audience**: Developers implementing the refactoring

## Overview

This guide provides step-by-step instructions for validating WebRTC refactoring changes. Use this after each major change (per user story or per file) to ensure functionality is preserved.

---

## Prerequisites

### Environment Setup

```bash
# Ensure you're on the feature branch
git checkout 002-webrtc-refactor-simplify

# Install dependencies (if not already done)
cd apps/web
bun install

# Verify dev server can start
bun dev
# Should start without errors on http://localhost:3000
```

### Baseline Metrics (Run Once at Start)

```bash
# 1. Document current line counts
wc -l apps/web/src/components/VideoStreamGrid.tsx
wc -l apps/web/src/hooks/useWebRTC.ts
wc -l apps/web/src/lib/webrtc/peer-connection.ts
wc -l apps/web/src/hooks/useWebRTCSignaling.ts
wc -l apps/web/src/lib/webcam.ts

# 2. Run existing integration tests (baseline)
bun test:integration

# 3. Measure bundle size (if available)
bun build
du -h dist/  # Note the size

# Save these metrics for comparison after refactoring
```

---

## Validation After Each Change

### Quick Validation (After Small Changes)

Run this after each file modification or small group of related changes:

```bash
# 1. Type checking
bun typecheck
# Should pass with no new errors

# 2. Linting
bun lint
# Should pass with no new violations

# 3. Run integration tests
bun test:integration
# All tests should pass

# 4. Git commit if successful
git add <changed-files>
git commit -m "refactor(webrtc): <description>"
```

### Full Validation (After User Story)

Run this after completing US1, US2, or US3:

```bash
# 1. Type checking
bun typecheck

# 2. Linting
bun lint

# 3. Formatting
bun format

# 4. Integration tests (run 3 times for stability)
bun test:integration
bun test:integration
bun test:integration

# 5. Measure line counts
wc -l apps/web/src/components/VideoStreamGrid.tsx
wc -l apps/web/src/hooks/useWebRTC.ts
wc -l apps/web/src/lib/webrtc/peer-connection.ts
wc -l apps/web/src/hooks/useWebRTCSignaling.ts
wc -l apps/web/src/lib/webcam.ts
# Compare to baseline

# 6. Bundle size check
bun build
du -h dist/
# Compare to baseline

# 7. Manual testing (see below)

# 8. Git commit milestone
git add .
git commit -m "refactor(webrtc): US<N> complete - <description>"
git tag us<N>-complete
```

---

## Manual Testing Procedures

### Test 1: Basic Video Streaming (2-Player Room)

**Purpose**: Verify basic peer connection and video display

**Steps**:
1. Start dev server: `bun dev`
2. Open browser 1 (Chrome): http://localhost:3000
3. Create or join a game room
4. Click camera button to start video
5. Verify local video displays
6. Open browser 2 (Firefox/Chrome Incognito): http://localhost:3000
7. Join the same game room
8. Click camera button to start video
9. Verify both players see each other's video

**Success Criteria**:
- ✅ Local video displays immediately after camera button click
- ✅ Remote video appears within 2 seconds
- ✅ Both video feeds remain stable for 2+ minutes
- ✅ Connection indicator shows "connected" (green)
- ✅ No console errors related to WebRTC

**Common Issues**:
- Red connection indicator: Check ICE candidate exchange
- No remote video: Check stream attachment logic
- Console errors: Check for undefined references after refactoring

---

### Test 2: Multi-Player Room (4 Players)

**Purpose**: Verify multiple peer connections work simultaneously

**Steps**:
1. Start dev server: `bun dev`
2. Open 4 browser tabs/windows (mix of Chrome, Firefox, Safari if available)
3. All join the same game room
4. All click camera button to start video
5. Verify each player sees all 3 other players' video feeds
6. Let run for 5+ minutes
7. Monitor connection indicators

**Success Criteria**:
- ✅ All 4 players see 3 remote video feeds each
- ✅ All connections establish within 2 seconds per peer
- ✅ All feeds remain stable for 5+ minutes
- ✅ All connection indicators show "connected"
- ✅ No memory leaks (check browser dev tools memory)
- ✅ CPU usage remains reasonable (<30% per tab)

**Common Issues**:
- Missing peer connections: Check connection creation logic
- High CPU/memory: Check for logging leaks or polling intervals
- Disconnections: Check state management and reconnection logic

---

### Test 3: Camera Switching

**Purpose**: Verify camera device switching works

**Steps**:
1. Start video streaming in a room
2. Click camera switch button (if multiple cameras available)
3. Select different camera from dropdown
4. Verify video switches to new camera
5. Verify remote peer sees the switch

**Success Criteria**:
- ✅ Camera list populates correctly
- ✅ Video switches smoothly without disconnection
- ✅ Remote peer receives updated video track
- ✅ Connection remains stable after switch

---

### Test 4: Audio/Video Toggles

**Purpose**: Verify muting and video disable work

**Steps**:
1. Start video streaming in a room
2. Click audio mute button
3. Verify local audio track disabled
4. Click audio unmute button
5. Verify local audio track enabled
6. Toggle video off and on
7. Verify video track states update correctly

**Success Criteria**:
- ✅ Audio toggle changes track.enabled state
- ✅ Video toggle works correctly
- ✅ Remote peer receives track state changes
- ✅ UI indicators update correctly

---

### Test 5: Network Disruption Recovery

**Purpose**: Verify reconnection logic handles network issues

**Steps**:
1. Start 2-player video streaming
2. Open browser dev tools → Network tab
3. Simulate offline mode for 5 seconds
4. Re-enable network
5. Verify connection recovers

**Success Criteria**:
- ✅ Connection indicator shows "reconnecting" during disruption
- ✅ Connection indicator returns to "connected" within 10 seconds
- ✅ Video feed resumes automatically
- ✅ No manual page refresh needed

**Note**: This test is especially important after US3 (removing polling/retry logic)

---

### Test 6: Long-Running Stability (30+ Minutes)

**Purpose**: Verify stable streaming over extended period (SC-010)

**Steps**:
1. Start 4-player video streaming
2. Let run for 30+ minutes
3. Monitor connection states
4. Check for memory leaks
5. Verify video quality remains good

**Success Criteria**:
- ✅ All connections remain stable for full duration
- ✅ No disconnections or reconnections
- ✅ Memory usage stable (no continuous growth)
- ✅ CPU usage remains reasonable
- ✅ Video quality does not degrade

**Monitoring**:
```javascript
// In browser console, check memory every 5 minutes:
performance.memory
// heapUsed should be relatively stable

// Check active connections:
document.querySelectorAll('video[srcObject]').length
// Should equal number of players
```

---

### Test 7: Performance Benchmarks

**Purpose**: Verify performance targets met (SC-009, SC-010)

#### Connection Establishment Time

```javascript
// In browser console before clicking camera button:
const startTime = performance.now()

// Click camera button, wait for remote video to appear

// When remote video displays:
const endTime = performance.now()
const connectionTime = (endTime - startTime) / 1000
console.log(`Connection time: ${connectionTime} seconds`)

// Should be < 2 seconds
```

#### Bundle Size Check

```bash
# After building
bun build
du -sh dist/

# Compare to baseline
# Should be 15%+ smaller after full refactoring
```

#### Code Size Verification

```bash
# Count lines after each user story
wc -l apps/web/src/components/VideoStreamGrid.tsx
wc -l apps/web/src/hooks/useWebRTC.ts
wc -l apps/web/src/lib/webrtc/peer-connection.ts
wc -l apps/web/src/hooks/useWebRTCSignaling.ts
wc -l apps/web/src/lib/webcam.ts

# Total should match targets:
# After US1: ~2,200 lines total
# After US2: ~1,800 lines total
# After US3: ~1,750 lines total
```

---

## Integration Tests

### Running Tests

```bash
# Run all WebRTC integration tests
bun test:integration

# Run specific test file (if organized by feature)
bun test:integration -- --grep "WebRTC"

# Run with coverage (if configured)
bun test:coverage
```

### Expected Test Coverage

Integration tests should cover:
- ✅ Connection establishment between peers
- ✅ Offer/answer exchange
- ✅ ICE candidate exchange
- ✅ Remote stream reception
- ✅ Connection state transitions
- ✅ Reconnection handling
- ✅ Cleanup on disconnect

**Critical**: All existing tests MUST pass without modification (FR-026)

---

## Troubleshooting

### Issue: Type Checking Fails

**Symptoms**: `bun typecheck` shows errors

**Diagnosis**:
```bash
# See detailed type errors
bun typecheck --pretty
```

**Common Causes After Refactoring**:
- Removed properties still referenced
- Changed function signatures not updated everywhere
- Import paths broken

**Fix**: Restore removed properties or update all references

---

### Issue: Integration Tests Fail

**Symptoms**: `bun test:integration` has failures

**Diagnosis**:
```bash
# Run tests in verbose mode
bun test:integration --verbose

# Run single test
bun test:integration -- --grep "specific test name"
```

**Common Causes**:
- Removed functions still called
- Changed callback signatures
- Broken state management

**Fix**: Check test error messages, restore functionality or update tests (if test was wrong)

---

### Issue: No Remote Video Appears

**Symptoms**: Local video works, but remote peer's video doesn't display

**Diagnosis**:
1. Open browser console
2. Check for errors related to:
   - `srcObject`
   - `remoteStreams`
   - `ontrack`
3. Verify connection state is "connected"
4. Check remote stream Map has entry for peer

**Common Causes After Refactoring**:
- Removed stream attachment logic
- Broken ref callbacks
- Removed ontrack handler
- Broken state updates

**Fix**: Check video element attachment logic in VideoStreamGrid.tsx

---

### Issue: Connection Stuck in "Connecting"

**Symptoms**: Connection indicator never turns green

**Diagnosis**:
1. Check browser console for WebRTC errors
2. Verify ICE candidates are being exchanged (check network tab)
3. Check for self-connection attempts (should be prevented)

**Common Causes After Refactoring**:
- Broken ICE candidate sending
- Self-connection check removed
- State mapping broken

**Fix**: Check signaling message exchange and state machine

---

### Issue: Memory Leak / Growing Memory Usage

**Symptoms**: Browser memory grows continuously over time

**Diagnosis**:
```javascript
// In console, monitor memory every minute:
setInterval(() => {
  console.log('Memory:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB')
}, 60000)
```

**Common Causes After Refactoring**:
- Event listeners not cleaned up
- Intervals not cleared
- Refs not released

**Fix**: Check cleanup logic in useEffect returns and manager.close()

---

## Validation Checklist

Use this checklist after completing full refactoring:

### Code Quality
- [ ] No TypeScript errors (`bun typecheck`)
- [ ] No linting errors (`bun lint`)
- [ ] Code formatted (`bun format`)
- [ ] No console.log statements (except errors)
- [ ] No TODO/FIXME comments introduced

### Functionality
- [ ] All integration tests pass (3 runs)
- [ ] 2-player video streaming works
- [ ] 4-player video streaming works
- [ ] Camera switching works
- [ ] Audio/video toggles work
- [ ] Network disruption recovery works
- [ ] 30+ minute stability test passes

### Performance
- [ ] Connection establishment < 2 seconds
- [ ] Bundle size reduced by 15%+
- [ ] No memory leaks detected
- [ ] CPU usage reasonable (<30% per tab)

### Code Metrics
- [ ] Total lines reduced to ~1,750 (51% reduction)
- [ ] Console logs reduced by 90%
- [ ] Zero polling intervals exist
- [ ] Utilities centralized in single file

### Contracts
- [ ] All component props unchanged
- [ ] All hook return values unchanged
- [ ] All manager methods unchanged
- [ ] No breaking changes to public APIs

---

## Success Criteria Reference

From spec.md, verify all 10 success criteria:

- **SC-001**: Code reduced 3,595 → ~1,750 lines (51%)
- **SC-002**: Console logs reduced 90%
- **SC-003**: All integration tests pass
- **SC-004**: Bundle size reduced 15%+
- **SC-005**: Code review time reduced 40% (subjective)
- **SC-006**: Comprehension time < 30 min (subjective)
- **SC-007**: Zero polling loops
- **SC-008**: ID normalization in one place
- **SC-009**: Connection time < 2 seconds
- **SC-010**: Stable for 30+ minutes

---

## Getting Help

If validation fails:

1. **Review commits**: Check what changed since last working state
2. **Revert if needed**: `git revert <commit>` to undo specific change
3. **Check contracts**: Verify you didn't break public APIs
4. **Compare with baseline**: Use git diff against main branch
5. **Ask for review**: Share specific error messages and steps to reproduce

---

## Notes

- Run quick validation after every file change
- Run full validation after each user story
- Keep baseline metrics for comparison
- Document any deviations from targets
- Test in multiple browsers when possible
- Use git tags to mark milestones (us1-complete, us2-complete, us3-complete)


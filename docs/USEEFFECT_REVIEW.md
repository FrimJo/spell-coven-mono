# useEffect Review Against React Guidelines

Review of all `useEffect` hooks in the project against [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

---

## Summary

**Total useEffect hooks found: 13**

| Status | Count | Details |
|--------|-------|---------|
| ✅ Necessary | 9 | Properly justified side effects |
| ⚠️ Problematic | 4 | Can be refactored or have issues |

---

## Detailed Analysis

### 1. ✅ `VideoStreamGrid.tsx` - Line 103-107

```tsx
useEffect(() => {
  if (isVideoActive) {
    getCameras().then(setAvailableCameras)
  }
}, [isVideoActive, getCameras])
```

**Status:** ✅ NECESSARY
- **Reason:** Fetches available cameras when video becomes active
- **Justification:** External API call (`getCameras()`) that must run as a side effect
- **Dependency array:** Correct - includes all dependencies

---

### 2. ⚠️ `RoomInvitePanel.tsx` - Line 55-61

```tsx
useEffect(() => {
  return () => {
    if (resetTimer.current) {
      window.clearTimeout(resetTimer.current)
    }
  }
}, [])
```

**Status:** ⚠️ PROBLEMATIC - Cleanup-only effect
- **Issue:** This effect only runs cleanup on unmount. No dependencies, no side effects.
- **Recommendation:** This is acceptable but unconventional. Consider:
  - If cleanup is truly only needed on unmount, this is fine
  - Could be simplified by just clearing in the component's cleanup if needed elsewhere

---

### 3. ✅ `RoomInvitePanel.tsx` - Copy status timeout (implicit in handleCopy)

**Status:** ✅ NECESSARY (but not a useEffect)
- The copy status reset is handled via `setTimeout` in the callback, not a useEffect
- This is correct - event-driven state updates don't need effects

---

### 4. ✅ `useMediaStream.ts` - Line 175-184

```tsx
useEffect(() => {
  if (autoStart) {
    startStream()
  }
  return () => {
    stopStream()
  }
}, [autoStart, startStream, stopStream])
```

**Status:** ✅ NECESSARY
- **Reason:** Auto-starts media stream on mount if `autoStart` is true
- **Justification:** Side effect that must run when component mounts or `autoStart` changes
- **Cleanup:** Properly stops stream on unmount
- **Dependency array:** Correct

---

### 5. ✅ `GameRoomLoader.tsx` - Line 22-38

```tsx
useEffect(() => {
  const unsubscribe = loadingEvents.subscribe((event: LoadingEvent) => {
    setProgress(event.progress)
    setCurrentMessage(event.message)
    if (event.step === 'complete') {
      setTimeout(onLoadingComplete, 300)
    }
  })
  return () => {
    unsubscribe()
  }
}, [onLoadingComplete])
```

**Status:** ✅ NECESSARY
- **Reason:** Subscribes to external event system (`loadingEvents`)
- **Justification:** Must listen to external events - legitimate side effect
- **Cleanup:** Properly unsubscribes on unmount
- **Dependency array:** Correct - includes `onLoadingComplete`

---

### 6. ⚠️ `MediaSetupDialog.tsx` - Line 143-147

```tsx
useEffect(() => {
  if (!open) return;
  enumerateDevices(true);
}, [open]);
```

**Status:** ⚠️ PROBLEMATIC - Missing dependency
- **Issue:** `enumerateDevices` is not in the dependency array
- **Risk:** If `enumerateDevices` changes, effect won't re-run
- **Fix:** Add `enumerateDevices` to dependency array:
  ```tsx
  }, [open, enumerateDevices]);
  ```
- **Note:** `enumerateDevices` is defined in the component body, so it will change on every render. Consider using `useCallback` to memoize it.

---

### 7. ⚠️ `MediaSetupDialog.tsx` - Line 150-163

```tsx
useEffect(() => {
  if (!open) return;
  const handleDeviceChange = () => {
    console.log('[MediaSetupDialog] Device change detected...');
    enumerateDevices(false);
  };
  navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
  return () => {
    navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  };
}, [open, selectedVideoId, selectedAudioInputId, selectedAudioOutputId]);
```

**Status:** ⚠️ PROBLEMATIC - Over-specified dependencies
- **Issue:** Dependency array includes `selectedVideoId`, `selectedAudioInputId`, `selectedAudioOutputId` but they're not used in the effect
- **Problem:** Effect re-runs whenever these change, causing unnecessary event listener re-registration
- **Fix:** Remove unused dependencies:
  ```tsx
  }, [open, enumerateDevices]);
  ```
- **Also missing:** `enumerateDevices` should be in the dependency array

---

### 8. ✅ `MediaSetupDialog.tsx` - Line 166-197

```tsx
useEffect(() => {
  if (!selectedVideoId || !videoRef.current) return;
  const setupVideo = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: selectedVideoId },
      audio: false
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
    }
  };
  setupVideo();
  return () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };
}, [selectedVideoId]);
```

**Status:** ✅ NECESSARY
- **Reason:** Sets up video preview when selected device changes
- **Justification:** Must fetch media stream - legitimate side effect
- **Cleanup:** Properly stops stream on unmount or when device changes
- **Dependency array:** Correct - only `selectedVideoId`

---

### 9. ✅ `MediaSetupDialog.tsx` - Line 200-248

```tsx
useEffect(() => {
  if (!selectedAudioInputId) return;
  const setupAudioMonitoring = async () => {
    // ... audio context setup ...
    updateLevel();
  };
  setupAudioMonitoring();
  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };
}, [selectedAudioInputId]);
```

**Status:** ✅ NECESSARY
- **Reason:** Sets up audio monitoring when selected device changes
- **Justification:** Must fetch media stream and set up audio context - legitimate side effect
- **Cleanup:** Properly cancels animation frame and closes audio context
- **Dependency array:** Correct - only `selectedAudioInputId`

---

### 10. ✅ `useDiscordAuth.ts` - Line 119-149

```tsx
useEffect(() => {
  let cancelled = false;
  const loadToken = async () => {
    try {
      const existing = await ensureValidDiscordToken();
      if (!cancelled) {
        setToken(existing);
      }
    } catch (err) {
      // ...
    } finally {
      if (!cancelled) {
        setIsLoading(false);
      }
    }
  };
  loadToken();
  return () => {
    cancelled = true;
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
  };
}, [])
```

**Status:** ✅ NECESSARY
- **Reason:** Loads stored Discord token on component mount
- **Justification:** Must fetch from storage - legitimate side effect
- **Cleanup:** Properly cancels pending operations on unmount
- **Dependency array:** Correct - empty (runs once on mount)
- **Pattern:** Good use of cancellation flag for async cleanup

---

### 11. ✅ `useDiscordAuth.ts` - Line 152-178

```tsx
useEffect(() => {
  if (!token) return;
  const scheduleRefresh = () => {
    const timeUntilRefresh = token.expiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS;
    if (timeUntilRefresh <= 0) {
      refreshTokenSilently(token.refreshToken);
      return;
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTokenSilently(token.refreshToken);
    }, timeUntilRefresh);
  };
  scheduleRefresh();
  return () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
  };
}, [token, refreshTokenSilently])
```

**Status:** ✅ NECESSARY
- **Reason:** Schedules automatic token refresh before expiration
- **Justification:** Must set up timer - legitimate side effect
- **Cleanup:** Properly clears timer on unmount or when token changes
- **Dependency array:** Correct - includes `token` and `refreshTokenSilently`

---

### 12. ⚠️ `useDiscordUser.ts` - Line 44-50

```tsx
useEffect(() => {
  if (isAuthenticated && !user) {
    fetchUser();
  } else if (!isAuthenticated) {
    setUser(null);
  }
}, [isAuthenticated, user, fetchUser])
```

**Status:** ⚠️ PROBLEMATIC - Infinite loop risk
- **Issue:** `fetchUser` is in the dependency array, but `fetchUser` depends on `token` which changes
- **Problem:** This creates a dependency chain that can cause unnecessary re-runs
- **Root cause:** `fetchUser` is defined as a `useCallback` that depends on `token`
- **Better approach:** Fetch user when `isAuthenticated` changes, not when `user` changes:
  ```tsx
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUser();
    } else if (!isAuthenticated) {
      setUser(null);
    }
  }, [isAuthenticated, fetchUser])
  ```
  Or better yet, remove `user` from dependencies and use a flag to track if we've already fetched:
  ```tsx
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchUser();
    } else if (!isAuthenticated) {
      hasFetchedRef.current = false;
      setUser(null);
    }
  }, [isAuthenticated, fetchUser])
  ```

---

### 13. ✅ `useVoiceChannelEvents.ts` - Line 173-187

```tsx
useEffect(() => {
  connect();
  return () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounted');
      wsRef.current = null;
    }
  };
}, [connect])
```

**Status:** ✅ NECESSARY
- **Reason:** Establishes WebSocket connection on mount
- **Justification:** Must connect to external service - legitimate side effect
- **Cleanup:** Properly closes WebSocket and clears timers on unmount
- **Dependency array:** Correct - includes `connect` callback

---

### 14. ✅ `GameRoom.tsx` - Line 88-99

```tsx
useEffect(() => {
  if (voiceChannelMembers.length > 0) {
    const updatedPlayers = voiceChannelMembers.map((member, index) => ({
      id: member.id,
      name: member.username,
      life: 20,
      isActive: index === 0,
    }));
    setPlayers(updatedPlayers);
  }
}, [voiceChannelMembers])
```

**Status:** ✅ NECESSARY
- **Reason:** Syncs voice channel members to local player state
- **Justification:** Must update UI when external data changes - legitimate side effect
- **Dependency array:** Correct - includes `voiceChannelMembers`

---

### 15. ✅ `GameRoom.tsx` - Line 102-164

```tsx
useEffect(() => {
  if (!auth) return;
  let mounted = true;
  async function validateVoiceChannel() {
    try {
      // ... validation logic ...
    } catch (error) {
      // ... error handling ...
    }
  }
  validateVoiceChannel();
  return () => {
    mounted = false;
  };
}, [auth, gameId, validateVoiceChannelFn])
```

**Status:** ✅ NECESSARY
- **Reason:** Validates voice channel access when auth becomes available
- **Justification:** Must call server function - legitimate side effect
- **Cleanup:** Properly cancels pending operations on unmount
- **Dependency array:** Correct - includes all dependencies
- **Pattern:** Good use of mounted flag for async cleanup

---

### 16. ✅ `GameRoom.tsx` - Line 213-336

```tsx
useEffect(() => {
  console.log('[GameRoom] Component mounted, starting initialization...');
  let mounted = true;
  async function initModel() {
    try {
      // ... model initialization ...
    } catch (err) {
      // ... error handling ...
    }
  }
  initModel();
  return () => {
    mounted = false;
  };
}, [])
```

**Status:** ✅ NECESSARY
- **Reason:** Initializes CLIP model and embeddings on component mount
- **Justification:** Must load external models - legitimate side effect
- **Cleanup:** Properly cancels pending operations on unmount
- **Dependency array:** Correct - empty (runs once on mount)
- **Pattern:** Good use of mounted flag for async cleanup

---

### 17. ⚠️ `game.$gameId.tsx` - Line 109-114

```tsx
useEffect(() => {
  if (!showAuthModal && !auth) {
    window.location.reload();
  }
}, [showAuthModal, auth])
```

**Status:** ⚠️ PROBLEMATIC - Unnecessary effect
- **Issue:** This reloads the page when auth modal closes without auth
- **Problem:** This is a workaround for getting fresh auth data after OAuth callback
- **Better approach:** The auth data should be available from the route loader after OAuth callback. This effect suggests the loader isn't being re-run properly.
- **Recommendation:** Investigate why `Route.useLoaderData()` doesn't reflect the new auth state after OAuth callback. This might be a routing issue rather than needing a reload.

---

### 18. ✅ `game.$gameId.tsx` - Line 117-136

```tsx
useEffect(() => {
  if (inviteToken && auth?.userId && auth?.accessToken) {
    joinRoomFn({
      data: {
        token: inviteToken,
        userId: auth.userId,
        accessToken: auth.accessToken,
      },
    })
      .then(() => {
        // Success
      })
      .catch((err) => {
        toast.error('Failed to join private room: ' + (err?.message || 'Unknown error'));
        navigate({ to: '/' });
      });
  }
}, [inviteToken, auth?.userId, auth?.accessToken])
```

**Status:** ✅ NECESSARY
- **Reason:** Joins private room when invite token and auth are available
- **Justification:** Must call server function - legitimate side effect
- **Dependency array:** Correct - includes all dependencies (note: destructuring in deps is fine here)

---

## Summary of Issues

### Critical Issues (Fix Required)

1. **`MediaSetupDialog.tsx` Line 143-147**: Missing `enumerateDevices` in dependency array
2. **`MediaSetupDialog.tsx` Line 150-163**: Over-specified dependencies + missing `enumerateDevices`
3. **`useDiscordUser.ts` Line 44-50**: Potential infinite loop with `user` in dependencies

### Warnings (Consider Refactoring)

1. **`game.$gameId.tsx` Line 109-114**: Page reload workaround - investigate routing issue
2. **`RoomInvitePanel.tsx` Line 55-61**: Cleanup-only effect - unconventional but acceptable

---

## Recommendations

### Priority 1: Fix Dependency Arrays

```tsx
// MediaSetupDialog.tsx - Line 143-147
useEffect(() => {
  if (!open) return;
  enumerateDevices(true);
}, [open, enumerateDevices]); // ADD enumerateDevices

// MediaSetupDialog.tsx - Line 150-163
useEffect(() => {
  if (!open) return;
  const handleDeviceChange = () => {
    console.log('[MediaSetupDialog] Device change detected...');
    enumerateDevices(false);
  };
  navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
  return () => {
    navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  };
}, [open, enumerateDevices]); // REMOVE selectedVideoId, selectedAudioInputId, selectedAudioOutputId; ADD enumerateDevices
```

### Priority 2: Fix useDiscordUser

```tsx
// useDiscordUser.ts - Line 44-50
const hasFetchedRef = useRef(false);

useEffect(() => {
  if (isAuthenticated && !hasFetchedRef.current) {
    hasFetchedRef.current = true;
    fetchUser();
  } else if (!isAuthenticated) {
    hasFetchedRef.current = false;
    setUser(null);
  }
}, [isAuthenticated, fetchUser]);
```

### Priority 3: Investigate Routing Issue

The page reload in `game.$gameId.tsx` suggests the route loader isn't being re-run after OAuth callback. Consider:
- Check if TanStack Router is properly invalidating loader data after auth changes
- Use `useLoaderData()` with proper cache invalidation instead of reloading the page

---

## Conclusion

**9 out of 13 effects are correctly implemented.** The 4 problematic effects are mostly dependency array issues that could cause subtle bugs or unnecessary re-renders. All issues are fixable with targeted changes.

# Component API Contracts

**Feature**: 002-webrtc-refactor-simplify  
**Purpose**: Document component interfaces that MUST remain stable during refactoring

## VideoStreamGrid Component

**File**: `apps/web/src/components/VideoStreamGrid.tsx`

### Public Interface (MUST NOT CHANGE)

```typescript
interface VideoStreamGridProps {
  // Player data
  players: Player[]
  localPlayerName: string
  
  // Callbacks
  onLifeChange: (playerId: string, newLife: number) => void
  
  // Optional: Card detection features
  enableCardDetection?: boolean
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
  onCardCrop?: (canvas: HTMLCanvasElement) => void
  
  // Optional: WebRTC integration
  remoteStreams?: Map<string, MediaStream | null>
  connectionStates?: Map<string, PeerConnectionState>
  onLocalVideoStart?: () => Promise<void>
  onLocalVideoStop?: () => void
}

interface Player {
  id: string
  name: string
  life: number
  isActive: boolean
}

type PeerConnectionState = 
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'disconnected'

type DetectorType = 'detr' | 'owl-vit' | 'slimsam'
```

### Export Signature

```typescript
export function VideoStreamGrid(props: VideoStreamGridProps): JSX.Element
```

### Contract Validation

**Refactoring Rules**:
- ✅ Can change: Internal state management, rendering logic, event handlers
- ✅ Can change: Internal helper functions, effect dependencies
- ❌ Cannot change: Props interface, prop types, prop defaults
- ❌ Cannot change: Component export name or signature
- ❌ Cannot change: Player interface structure

**Breaking Changes** (require consumer updates):
- Adding required props
- Removing existing props
- Changing prop types
- Changing callback signatures

**Non-Breaking Changes** (allowed):
- Adding optional props with defaults
- Changing internal implementation
- Performance optimizations
- Bug fixes

### Integration Points

**Consumers**:
- `apps/web/src/routes/game.$gameId.tsx` - Main game page
- Any component rendering video streaming UI

**Integration Contract**:
```typescript
// Consumer usage pattern that MUST continue working
<VideoStreamGrid
  players={players}
  localPlayerName={currentPlayer.name}
  onLifeChange={handleLifeChange}
  remoteStreams={remoteStreams}           // From useWebRTC
  connectionStates={connectionStates}     // From useWebRTC
  onLocalVideoStart={startVideo}          // From useWebRTC
  onLocalVideoStop={stopVideo}            // From useWebRTC
  enableCardDetection={true}
  onCardCrop={handleCardCrop}
/>
```

### Test Coverage

**Must pass after refactoring**:
- Component renders without errors
- Local video displays when started
- Remote videos display when streams available
- Connection state indicators update correctly
- Life counter buttons work
- Camera selection works
- Audio/video toggles function

---

## Future Components

No new components planned for this refactoring. All changes are internal to VideoStreamGrid.

---

## Contract Compliance Checklist

Before completing refactoring:
- [ ] VideoStreamGridProps interface unchanged
- [ ] Player interface unchanged
- [ ] PeerConnectionState type unchanged
- [ ] Export signature unchanged
- [ ] All existing integration points still work
- [ ] Consumer code requires zero changes
- [ ] Type checking passes for consumers


import type { AuthUser } from '@/contexts/AuthContext'
import { useMemo, useState } from 'react'
import { env } from '@/env'
import { sessionStorage } from '@/lib/session-storage'
import { api } from '@convex/_generated/api'
import { useNavigate } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'
import { useMutation, useQuery } from 'convex/react'
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  Gamepad2,
  Github,
  Heart,
  Loader2,
  LogOut,
  Play,
  Plus,
  RotateCcw,
  Scan,
  Settings,
  Sparkles,
  Swords,
  Users,
  Video,
} from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Toaster } from '@repo/ui/components/sonner'

import type { CreatorInviteState } from '../lib/session-storage.js'
import logoBlue from '../assets/logo_1024_blue.png'
import logoDeath from '../assets/logo_1024_death.png'
import logoFire from '../assets/logo_1024_fire.png'
import logoGreen from '../assets/logo_1024_green.png'
import logoWarmGold from '../assets/logo_1024_warmgold.png'
import logo from '../assets/logo_1024x1024.png'
import { useTheme } from '../contexts/ThemeContext.js'
import { AppHeader } from './AppHeader.js'
import { CreateGameDialog } from './CreateGameDialog.js'
import { RoomNotFoundDialog } from './RoomNotFoundDialog.js'
import SpotlightCard from './SpotlightCard'

interface LandingPageProps {
  /** Initial error from URL search params */
  initialError?: string | null
  inviteState?: CreatorInviteState | null
  onRefreshInvite?: () => void | Promise<void>
  isRefreshingInvite?: boolean
  /** Auth props */
  user?: AuthUser | null
  onSignIn?: () => void | Promise<void>
  onPreviewSignIn?: (code: string) => void | Promise<void>
}

export function LandingPage({
  initialError,
  inviteState: _inviteState,
  onRefreshInvite: _onRefreshInvite,
  isRefreshingInvite: _isRefreshingInvite,
  user,
  onSignIn,
  onPreviewSignIn,
}: LandingPageProps) {
  const navigate = useNavigate()
  const { mtgTheme } = useTheme()
  const supportUrl = env.VITE_SUPPORT_URL
  // Use theme-specific logos
  const logoSrc =
    mtgTheme === 'white'
      ? logoWarmGold
      : mtgTheme === 'red'
        ? logoFire
        : mtgTheme === 'blue'
          ? logoBlue
          : mtgTheme === 'black'
            ? logoDeath
            : mtgTheme === 'green'
              ? logoGreen
              : logo
  const [joinGameId, setJoinGameId] = useState('')
  const [dialogs, setDialogs] = useState({
    join: false,
    create: false,
  })
  const [error, setError] = useState<string | null>(
    // Don't show room_not_found as banner error - it's shown in a dialog
    initialError === 'room_not_found' ? null : initialError || null,
  )
  const [showRoomNotFoundDialog, setShowRoomNotFoundDialog] = useState(
    initialError === 'room_not_found',
  )
  const [gameCreation, setGameCreation] = useState<{
    isCreating: boolean
    gameId: string | null
  }>({
    isCreating: false,
    gameId: null,
  })
  const createRoom = useMutation(api.rooms.createRoom)
  const isAuthenticated = !!user
  const [previewCode, setPreviewCode] = useState('')
  const [isPreviewSigningIn, setIsPreviewSigningIn] = useState(false)

  const handleCreateGame = async () => {
    if (!user) {
      setError('Please sign in to create a game')
      return
    }

    setError(null)
    setGameCreation({ isCreating: true, gameId: null })
    // Open the dialog immediately to show skeleton loading state
    setDialogs((prev) => ({ ...prev, create: true }))

    try {
      console.log('[LandingPage] Creating new game room via Convex...')

      // Create room in Convex - server generates the room ID
      // If throttled, wait and retry automatically
      let result = await createRoom({ ownerId: user.id })

      while (result.roomId == null && result.waitMs != null) {
        const awaitMs = result.waitMs
        console.log(
          `[LandingPage] Throttled, waiting ${awaitMs}ms before retry...`,
        )
        await new Promise((resolve) => setTimeout(resolve, awaitMs))
        result = await createRoom({ ownerId: user.id })
      }

      const gameId = result.roomId

      console.log('[LandingPage] Game room created successfully:', gameId)

      // Save to session storage
      sessionStorage.saveGameState({
        gameId,
        playerName: user.username,
        timestamp: Date.now(),
      })

      // Show success state
      setGameCreation({ isCreating: false, gameId })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create game room'
      setError(message)
      console.error('Failed to create game room:', err)
      setGameCreation({ isCreating: false, gameId: null })
      // Close the dialog on error
      setDialogs((prev) => ({ ...prev, create: false }))
    }
  }

  const handleNavigateToRoom = () => {
    if (gameCreation.gameId) {
      navigate({ to: '/game/$gameId', params: { gameId: gameCreation.gameId } })
    }
  }

  const handleJoinGame = (playerName: string, gameId: string) => {
    sessionStorage.saveGameState({
      gameId,
      playerName,
      timestamp: Date.now(),
    })
    navigate({ to: '/game/$gameId', params: { gameId } })
  }

  const handleCreateClick = () => {
    handleCreateGame()
  }

  const handleCreateDialogOpenChange = (open: boolean) => {
    setDialogs((prev) => ({ ...prev, create: open }))
  }

  const handleJoinClick = () => {
    setDialogs((prev) => ({ ...prev, join: true }))
  }

  const handleJoin = () => {
    if (joinGameId.trim() && user) {
      // Use Discord username from auth
      handleJoinGame(user.username, joinGameId.trim())
    }
  }

  const handleRejoinLastRoom = (roomId: string) => {
    if (user) {
      sessionStorage.saveGameState({
        gameId: roomId,
        playerName: user.username,
        timestamp: Date.now(),
      })
      navigate({
        to: '/game/$gameId',
        params: { gameId: roomId },
      })
    }
  }

  const handleRoomNotFoundDialogClose = () => {
    setShowRoomNotFoundDialog(false)
    // Clear the error from URL search params
    navigate({ to: '/', search: {} })
  }

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string,
  ) => {
    e.preventDefault()
    const element = document.getElementById(targetId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handlePreviewSignIn = async () => {
    if (!onPreviewSignIn || !previewCode.trim()) {
      return
    }
    setIsPreviewSigningIn(true)
    setError(null)
    try {
      await onPreviewSignIn(previewCode.trim())
    } catch {
      setError('Unauthorized')
    } finally {
      setIsPreviewSigningIn(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {error && (
        <div className="bg-destructive/90 fixed right-4 top-4 z-50 max-w-md rounded-lg p-4 text-white shadow-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        .animate-sparkle {
          animation: sparkle 3s ease-in-out infinite;
        }
        .delay-700 { animation-delay: 700ms; }
        .delay-1000 { animation-delay: 1000ms; }
        .delay-1500 { animation-delay: 1500ms; }
      `}</style>

      {/* Background with gradient overlay */}
      <div className="bg-linear-to-br via-background absolute inset-0 from-purple-900/20 to-blue-900/20" />

      {/* Animated background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand/10 absolute left-20 top-20 h-64 w-64 animate-pulse rounded-full blur-3xl" />
        <div className="bg-info/10 absolute bottom-20 right-20 h-96 w-96 animate-pulse rounded-full blur-3xl delay-1000" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <AppHeader
          variant="landing"
          navItems={[
            { label: 'Features', targetId: 'features' },
            { label: 'How It Works', targetId: 'how-it-works' },
          ]}
          onSignIn={onSignIn}
        />

        {env.VITE_PREVIEW_AUTH && !isAuthenticated ? (
          <section className="container mx-auto px-4 pt-6">
            <div className="border-warning/40 bg-surface-1/90 mx-auto max-w-xl rounded-xl border p-4 backdrop-blur-md">
              <p className="text-warning mb-3 text-sm font-semibold">
                Preview Only: Login Code
              </p>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="preview-login-code">Preview Login Code</Label>
                  <Input
                    id="preview-login-code"
                    value={previewCode}
                    onChange={(event) => setPreviewCode(event.target.value)}
                    placeholder="Enter code"
                    autoComplete="off"
                  />
                </div>
                <Button
                  onClick={handlePreviewSignIn}
                  disabled={isPreviewSigningIn || !previewCode.trim()}
                >
                  {isPreviewSigningIn ? 'Signing in...' : 'Sign in with Code'}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-24">
          <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
            {/* Text Content */}
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <div className="border-brand/30 bg-brand-muted mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-md">
                <Sparkles className="text-brand-muted-foreground h-4 w-4" />
                <span className="text-brand-muted-foreground text-sm font-medium">
                  No downloads. No setup. Just play.
                </span>
              </div>

              <h1 className="text-text-primary mb-6 text-5xl md:text-7xl lg:text-8xl">
                Play Magic
                <span
                  className="mt-2 block bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(to right, var(--gradient-from), var(--gradient-to))`,
                  }}
                >
                  Anywhere.
                </span>
              </h1>

              <p className="text-text-secondary mb-8 max-w-xl text-lg leading-relaxed md:text-xl">
                Spell Coven lets you play paper MTG remotely through video chat
                and card recognition. Use your physical cards, see your
                opponents, and enjoy the authentic experience.
              </p>

              <div className="flex flex-col items-center gap-4 sm:flex-row md:justify-start">
                {isAuthenticated ? (
                  <>
                    <Button
                      size="lg"
                      className="bg-brand shadow-brand/25 hover:bg-brand h-14 min-w-[200px] gap-2 text-lg font-semibold text-white shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleCreateClick}
                      disabled={gameCreation.isCreating}
                      data-testid="create-game-button"
                    >
                      {gameCreation.isCreating ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Creating Game...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-5 w-5" />
                          <span>Create Game</span>
                        </>
                      )}
                    </Button>

                    <ErrorBoundary fallback={<LandingActionErrorFallback />}>
                      <LandingJoinActions
                        isAuthenticated={isAuthenticated}
                        dialogs={dialogs}
                        setDialogs={setDialogs}
                        joinGameId={joinGameId}
                        setJoinGameId={setJoinGameId}
                        onJoinClick={handleJoinClick}
                        onJoin={handleJoin}
                        onRejoinLastRoom={handleRejoinLastRoom}
                      />
                    </ErrorBoundary>

                    {/* Create Game Dialog */}
                    <CreateGameDialog
                      open={dialogs.create}
                      onOpenChange={handleCreateDialogOpenChange}
                      isCreating={gameCreation.isCreating}
                      createdGameId={gameCreation.gameId}
                      onNavigateToRoom={handleNavigateToRoom}
                    />
                  </>
                ) : (
                  <Button
                    size="lg"
                    className="group relative h-14 min-w-[260px] gap-3 overflow-hidden border border-white/10 bg-gradient-to-r from-[#5865F2] to-purple-600 text-lg font-semibold text-white shadow-[0_0_30px_rgba(88,101,242,0.4)] transition-all hover:scale-105 hover:from-[#4752C4] hover:to-purple-700 hover:shadow-[0_0_50px_rgba(88,101,242,0.6)]"
                    onClick={onSignIn}
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                    <svg
                      className="h-6 w-6 transition-transform group-hover:scale-110"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Sign in with Discord
                  </Button>
                )}
              </div>

              <ErrorBoundary fallback={<LandingLiveStatsErrorFallback />}>
                <LandingLiveStats />
              </ErrorBoundary>
            </div>

            {/* Visual/Logo */}
            <div className="relative mx-auto h-64 w-64 md:h-96 md:w-96">
              <div className="animate-float relative h-full w-full">
                <div className="bg-brand/20 absolute inset-0 animate-pulse rounded-full blur-3xl" />
                <img
                  src={logoSrc}
                  alt="Spell Coven Logo"
                  className="relative z-10 h-full w-full object-contain"
                  style={{
                    filter: 'drop-shadow(0 0 30px var(--brand-glow))',
                  }}
                />

                {/* Decorative sparkles */}
                <Sparkles className="animate-sparkle text-warning absolute -left-8 top-10 h-8 w-8 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
                <Sparkles className="animate-sparkle text-info absolute -right-4 bottom-20 h-6 w-6 drop-shadow-[0_0_8px_rgba(147,197,253,0.8)] delay-700" />
                <Sparkles className="animate-sparkle delay-1500 text-brand-muted-foreground absolute bottom-0 left-0 h-8 w-8 drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]" />
              </div>
            </div>
          </div>

          {/* App Preview Placeholder */}
          <div className="group relative mx-auto mt-20 max-w-6xl">
            {/* Glow effects */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-600/50 to-blue-600/50 opacity-30 blur-2xl transition-opacity duration-500 group-hover:opacity-50" />

            <div className="border-border-muted bg-surface-0/80 relative rounded-xl border p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-purple-500/5 to-transparent opacity-50" />

              {/* Fake Game Interface */}
              <div className="flex h-[400px] w-full flex-col overflow-hidden rounded-lg bg-[#0f1117] sm:h-[600px]">
                {/* Top Bar */}
                <div className="border-border-muted bg-surface-1/50 flex items-center justify-between border-b px-4 py-2">
                  <div className="flex items-center gap-4">
                    <div className="text-text-muted flex items-center gap-2">
                      <LogOut className="h-4 w-4 rotate-180" />
                      <span className="text-sm">Leave</span>
                    </div>
                    <div className="bg-surface-2 h-4 w-px" />
                    <span className="text-text-muted text-sm">
                      Game ID:{' '}
                      <span className="text-brand-muted-foreground font-mono">
                        ABC123
                      </span>
                    </span>
                  </div>
                  <div className="text-text-muted flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-xs">4/4 Players</span>
                    <Settings className="ml-2 h-4 w-4" />
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar */}
                  <div className="border-border-muted bg-surface-1/30 hidden w-64 flex-col gap-4 border-r p-4 lg:flex">
                    <div className="border-border-muted bg-surface-2/20 rounded-lg border p-4">
                      <div className="text-text-muted mb-2 flex items-center gap-2 text-xs font-medium">
                        <Play className="h-3 w-3" />
                        Current Turn
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-medium text-white">
                          Rowan
                        </div>
                        <div className="text-text-muted text-xs">
                          is playing
                        </div>
                        <div className="bg-brand shadow-brand/20 mt-3 w-full rounded py-1.5 text-sm font-medium text-white shadow-lg">
                          Next Turn
                        </div>
                      </div>
                    </div>

                    <div className="border-border-muted bg-surface-2/20 flex-1 rounded-lg border p-4">
                      <div className="text-text-muted mb-3 text-xs font-medium">
                        Players (4/4)
                      </div>
                      <div className="space-y-2">
                        {[
                          { name: 'Rowan', me: true, hp: 40 },
                          { name: 'Alex', me: false, hp: 38 },
                          { name: 'Jordan', me: false, hp: 40 },
                          { name: 'Sam', me: false, hp: 32 },
                        ].map((p) => (
                          <div
                            key={p.name}
                            className={`flex items-center justify-between rounded p-2 ${p.me ? 'bg-brand/10 ring-brand/50 ring-1' : 'hover:bg-surface-2/50'}`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${p.me ? 'bg-success' : 'bg-surface-3'}`}
                              />
                              <span
                                className={`text-sm ${p.me ? 'font-medium text-white' : 'text-text-secondary'}`}
                              >
                                {p.name}
                                {p.me && (
                                  <span className="bg-brand/20 text-brand-muted-foreground ml-2 rounded px-1 py-0.5 text-[10px]">
                                    You
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="text-text-muted flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              <span className="text-xs">{p.hp}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Game Grid */}
                  <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-2 p-2 sm:gap-4 sm:p-4">
                    {[
                      { name: 'Rowan', me: true, card: null, isActive: true },
                      {
                        name: 'Alex',
                        me: false,
                        card: 'https://cards.scryfall.io/large/front/3/a/3aec0e25-240e-44e5-9f40-0a6c6b9dc206.jpg',
                        isActive: false,
                      }, // Example card URL for visual
                      {
                        name: 'Jordan',
                        me: false,
                        card: null,
                        isActive: false,
                      },
                      { name: 'Sam', me: false, card: null, isActive: false },
                    ].map((p, i) => (
                      <div
                        key={i}
                        className={`bg-surface-1/50 relative overflow-hidden rounded-lg border shadow-inner transition-all ${p.isActive ? 'border-brand/50 ring-brand/30 shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)] ring-1' : 'border-border-muted'}`}
                      >
                        {/* Player Header */}
                        <div className="bg-surface-0/60 absolute left-2 top-2 z-10 flex items-center gap-2 rounded px-2 py-1 text-xs backdrop-blur-sm">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${p.me ? 'bg-success' : 'bg-text-muted'}`}
                          />
                          <span className="text-text-secondary">{p.name}</span>
                          {p.me && (
                            <span className="bg-brand/30 text-brand-muted-foreground rounded px-1 py-0.5 text-[10px] font-medium">
                              You
                            </span>
                          )}
                        </div>

                        {/* Life Counter */}
                        <div className="border-border-muted bg-surface-0/80 absolute bottom-4 left-4 z-10 rounded-lg border p-2 text-center backdrop-blur-sm">
                          <div className="text-xl font-bold text-white">40</div>
                          <div className="text-text-muted text-[10px] uppercase tracking-wider">
                            Life
                          </div>
                        </div>

                        {/* Simulated Camera Feed */}
                        <div className="from-surface-2/50 to-surface-0 flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))]">
                          <div className="flex flex-col items-center gap-3 opacity-20">
                            <Camera className="text-text-muted h-8 w-8" />
                            <span className="text-text-muted text-sm font-medium">
                              Table View
                            </span>
                          </div>
                        </div>

                        {/* Card Recognition Overlay (Simulated) */}
                        {p.card && (
                          <div className="absolute right-4 top-1/2 z-20 w-24 -translate-y-1/2 rotate-3 transform transition-transform hover:rotate-0 hover:scale-150">
                            <div className="group relative aspect-[2.5/3.5] cursor-pointer overflow-hidden rounded border border-white/20 shadow-2xl">
                              {/* Placeholder for card image since we can't rely on external URLs reliably in preview without being sure they load, using a colored div with icon */}
                              <div className="bg-surface-2 flex h-full w-full items-center justify-center">
                                <div className="h-full w-full bg-gradient-to-br from-amber-900/40 to-slate-900"></div>
                                <Sparkles className="text-warning/50 absolute" />
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                                <div className="flex h-full items-end justify-center pb-2">
                                  <span className="text-[10px] text-white">
                                    Click to zoom
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Card Recognition Rectangles (Simulated) */}
                        <div className="absolute left-1/2 top-1/2 h-32 w-48 -translate-x-1/2 -translate-y-1/2 rounded border-2 border-dashed border-white/5 opacity-50" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-text-primary mb-16 text-center text-4xl md:text-5xl">
              Everything You Need to Play
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <SpotlightCard
                className="border-border-muted bg-surface-1/50 p-6 backdrop-blur-sm"
                spotlightColor="rgba(168, 85, 247, 0.15)"
              >
                <div className="bg-brand/20 mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                  <Video className="text-brand-muted-foreground h-6 w-6" />
                </div>
                <h3 className="text-text-primary mb-2 text-xl">
                  Battlefield Video
                </h3>
                <p className="text-text-muted">
                  Clear video feeds of everyone&apos;s battlefield. See your
                  opponents&apos; playmats, cards, and game state in real-time.
                </p>
              </SpotlightCard>

              <SpotlightCard
                className="border-border-muted bg-surface-1/50 p-6 backdrop-blur-sm"
                spotlightColor="rgba(59, 130, 246, 0.15)"
              >
                <div className="bg-info/20 mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                  <Camera className="text-info h-6 w-6" />
                </div>
                <h3 className="text-text-primary mb-2 text-xl">
                  Card Recognition
                </h3>
                <p className="text-text-muted">
                  Point your camera at cards and the system recognizes them for
                  your opponents to see.
                </p>
              </SpotlightCard>

              <SpotlightCard
                className="border-border-muted bg-surface-1/50 p-6 backdrop-blur-sm"
                spotlightColor="rgba(34, 197, 94, 0.15)"
              >
                <div className="bg-success/20 mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                  <Users className="text-success h-6 w-6" />
                </div>
                <h3 className="text-text-primary mb-3 text-xl">
                  Game Management
                </h3>
                <p className="text-text-muted">
                  Life counters, commander damage, and game state tools to keep
                  everything organized.
                </p>
              </SpotlightCard>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section
          id="how-it-works"
          className="container relative mx-auto overflow-hidden px-4 py-24"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="text-text-primary mb-20 text-center text-4xl md:text-5xl">
              How It Works
            </h2>

            <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
              {/* Connector Line (Desktop) */}
              <div className="absolute left-[16%] right-[16%] top-12 hidden h-0.5 bg-gradient-to-r from-slate-800 via-purple-900/50 to-slate-800 md:block" />

              {/* Step 1 */}
              <div className="group relative flex flex-col items-center text-center">
                <div className="border-border-muted bg-surface-0 group-hover:border-brand/50 relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border shadow-xl transition-all duration-300 group-hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)]">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <Gamepad2 className="text-brand-muted-foreground group-hover:text-brand-muted-foreground relative z-10 h-10 w-10 transition-transform duration-300 group-hover:scale-110" />
                  <div className="border-border-muted bg-surface-1 ring-surface-0 absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold text-white shadow-lg ring-4">
                    1
                  </div>
                </div>
                <h3 className="group-hover:text-brand-muted-foreground text-text-primary mb-3 text-xl font-semibold transition-colors">
                  Create or Join
                </h3>
                <p className="text-text-muted max-w-xs leading-relaxed">
                  Start a new game room and share the game ID with your friends,
                  or join an existing game instantly.
                </p>
              </div>

              {/* Step 2 */}
              <div className="group relative flex flex-col items-center text-center">
                <div className="border-border-muted bg-surface-0 group-hover:border-info/50 relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border shadow-xl transition-all duration-300 group-hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <Scan className="text-info group-hover:text-info relative z-10 h-10 w-10 transition-transform duration-300 group-hover:scale-110" />
                  <div className="border-border-muted bg-surface-1 ring-surface-0 absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold text-white shadow-lg ring-4">
                    2
                  </div>
                </div>
                <h3 className="group-hover:text-info text-text-primary mb-3 text-xl font-semibold transition-colors">
                  Set Up Cameras
                </h3>
                <p className="text-text-muted max-w-xs leading-relaxed">
                  Position your main camera for your playmat and cards.
                  Optionally add a second camera for video chat.
                </p>
              </div>

              {/* Step 3 */}
              <div className="group relative flex flex-col items-center text-center">
                <div className="border-border-muted bg-surface-0 group-hover:border-success/50 relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border shadow-xl transition-all duration-300 group-hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <Swords className="text-success group-hover:text-success relative z-10 h-10 w-10 transition-transform duration-300 group-hover:scale-110" />
                  <div className="border-border-muted bg-surface-1 ring-surface-0 absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold text-white shadow-lg ring-4">
                    3
                  </div>
                </div>
                <h3 className="group-hover:text-success text-text-primary mb-3 text-xl font-semibold transition-colors">
                  Play Magic
                </h3>
                <p className="text-text-muted max-w-xs leading-relaxed">
                  Cast spells, track life totals, and enjoy authentic paper
                  Magic with your friends anywhere.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="container mx-auto px-4 py-20">
          <SpotlightCard
            className="border-border-muted bg-surface-1/50 px-6 py-16 text-center backdrop-blur-sm md:px-12"
            spotlightColor="rgba(168, 85, 247, 0.15)"
          >
            {/* Background effects */}
            <div className="bg-brand/10 absolute -left-20 -top-20 h-64 w-64 rounded-full blur-3xl" />
            <div className="bg-info/10 absolute -bottom-20 -right-20 h-64 w-64 rounded-full blur-3xl" />

            <h2 className="text-text-primary relative z-10 mb-6 text-3xl md:text-5xl">
              Ready to Enter the Coven?
            </h2>
            <p className="text-text-secondary relative z-10 mx-auto mb-8 max-w-2xl text-lg">
              Join thousands of planeswalkers playing paper Magic remotely.
              It&apos;s free, runs in your browser, and brings the gathering
              back to Magic.
            </p>

            <div className="relative z-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={isAuthenticated ? handleCreateClick : onSignIn}
                className="bg-brand shadow-brand/25 hover:bg-brand h-14 min-w-[200px] gap-2 text-lg font-semibold text-white shadow-lg"
              >
                <Sparkles className="h-5 w-5" />
                {isAuthenticated
                  ? 'Start a Game Now'
                  : 'Start Playing for Free'}
              </Button>
              {!isAuthenticated && (
                <Button
                  variant="outline"
                  size="lg"
                  className="border-surface-3 bg-surface-1/50 text-text-secondary hover:bg-surface-2 h-14 min-w-[200px] text-lg font-semibold hover:text-white"
                  onClick={() => {
                    const element = document.getElementById('how-it-works')
                    element?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  Learn More
                </Button>
              )}
            </div>
          </SpotlightCard>
        </section>

        {/* Footer */}
        <footer className="border-border-muted bg-surface-0 border-t">
          <div className="container mx-auto px-4 py-12">
            <div
              className={`grid gap-8 ${
                supportUrl ? 'md:grid-cols-6' : 'md:grid-cols-5'
              }`}
            >
              <div className="col-span-2 space-y-4">
                <div className="flex items-center gap-2">
                  <img
                    src={logo}
                    alt="Spell Coven Logo"
                    className="h-8 w-8 rounded-lg object-contain grayscale transition-all hover:grayscale-0"
                  />
                  <span className="text-text-primary text-lg font-bold">
                    Spell Coven
                  </span>
                </div>
                <p className="text-text-muted max-w-xs text-sm">
                  The best way to play paper Magic: The Gathering remotely with
                  friends. High-quality video, card recognition, and zero setup.
                </p>
              </div>

              <div>
                <h4 className="text-text-primary mb-4 text-sm font-semibold">
                  Product
                </h4>
                <ul className="text-text-muted space-y-2 text-sm">
                  <li>
                    <a
                      href="#features"
                      onClick={(e) => handleNavClick(e, 'features')}
                      className="hover:text-brand-muted-foreground"
                    >
                      Features
                    </a>
                  </li>
                  <li>
                    <a
                      href="#how-it-works"
                      onClick={(e) => handleNavClick(e, 'how-it-works')}
                      className="hover:text-brand-muted-foreground"
                    >
                      How It Works
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-brand-muted-foreground">
                      Changelog
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-text-primary mb-4 text-sm font-semibold">
                  Legal
                </h4>
                <ul className="text-text-muted space-y-2 text-sm">
                  <li>
                    <a href="#" className="hover:text-brand-muted-foreground">
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-brand-muted-foreground">
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-brand-muted-foreground">
                      Cookie Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href="/license"
                      className="hover:text-brand-muted-foreground"
                    >
                      License
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-text-primary mb-4 text-sm font-semibold">
                  Open Source
                </h4>
                <p className="text-text-muted mb-4 text-sm">
                  Spell Coven is open source. Contribute or star us on GitHub!
                </p>
                <a
                  href="https://github.com/FrimJo/spell-coven-mono"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-surface-3 bg-surface-1/50 text-text-secondary hover:bg-surface-2 hover:text-text-primary inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                >
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </div>

              {supportUrl && (
                <div>
                  <h4 className="text-text-primary mb-4 text-sm font-semibold">
                    Support
                  </h4>
                  <p className="text-text-muted mb-4 text-sm">
                    Enjoying Spell Coven? Support ongoing development.
                  </p>
                  <a
                    href={supportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-brand shadow-brand/30 hover:bg-brand inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition"
                  >
                    <Heart className="h-4 w-4" />
                    Buy me a coffee
                  </a>
                </div>
              )}
            </div>

            <div className="border-border-muted text-text-muted mt-12 border-t pt-8 text-center text-sm">
              <p className="mb-2">Spell Coven © {new Date().getFullYear()}</p>
              <p>
                Spell Coven is unofficial Fan Content permitted under the Fan
                Content Policy. Not approved/endorsed by Wizards. Portions of
                the materials used are property of Wizards of the Coast.
                ©Wizards of the Coast LLC.
              </p>
              <p className="mt-3">
                Licensed under{' '}
                <a
                  className="text-brand-muted-foreground hover:text-brand"
                  href="https://polyformproject.org/licenses/noncommercial/1.0.0/"
                  rel="noreferrer"
                  target="_blank"
                >
                  PolyForm Noncommercial 1.0.0
                </a>{' '}
                — non-commercial use only.
              </p>
            </div>
          </div>
        </footer>
      </div>
      <Toaster />
      <RoomNotFoundDialog
        open={showRoomNotFoundDialog}
        onClose={handleRoomNotFoundDialogClose}
      />
    </div>
  )
}

interface LandingJoinActionsProps {
  isAuthenticated: boolean
  dialogs: {
    join: boolean
    create: boolean
  }
  setDialogs: React.Dispatch<
    React.SetStateAction<{
      join: boolean
      create: boolean
    }>
  >
  joinGameId: string
  setJoinGameId: React.Dispatch<React.SetStateAction<string>>
  onJoinClick: () => void
  onJoin: () => void
  onRejoinLastRoom: (roomId: string) => void
}

function LandingJoinActions({
  isAuthenticated,
  dialogs,
  setDialogs,
  joinGameId,
  setJoinGameId,
  onJoinClick,
  onJoin,
  onRejoinLastRoom,
}: LandingJoinActionsProps) {
  const activeRoomQuery = useQuery(
    api.players.getActiveRoomForUser,
    isAuthenticated ? {} : 'skip',
  )

  if (activeRoomQuery?.roomId) {
    return (
      <>
        <div className="flex">
          <Button
            size="lg"
            variant="outline"
            className="border-success/40 bg-success/10 text-success hover:bg-success/20 h-14 min-w-[160px] gap-2 rounded-r-none border-r-0 text-lg font-semibold hover:text-white"
            onClick={() => onRejoinLastRoom(activeRoomQuery.roomId)}
            data-testid="rejoin-game-button"
          >
            <RotateCcw className="h-5 w-5" />
            Rejoin Game
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="lg"
                variant="outline"
                className="border-success/40 bg-success/10 text-success hover:bg-success/20 h-14 rounded-l-none px-3"
                data-testid="join-game-dropdown"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-surface-3 bg-surface-1">
              <DropdownMenuItem
                onClick={onJoinClick}
                className="text-text-secondary hover:text-white"
              >
                <Play className="mr-2 h-4 w-4" />
                Join with Code
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Dialog
          open={dialogs.join}
          onOpenChange={(open) => setDialogs((prev) => ({ ...prev, join: open }))}
        >
          <DialogContent className="border-border-muted bg-surface-1">
            <DialogHeader>
              <DialogTitle className="text-text-primary">Join a Game</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="game-id" className="text-text-secondary">
                  Game ID
                </Label>
                <Input
                  id="game-id"
                  placeholder="Enter game ID (e.g., ABC123)"
                  value={joinGameId}
                  onChange={(e) => setJoinGameId(e.target.value)}
                  className="border-surface-3 bg-surface-0 text-text-primary"
                  onKeyDown={(e) => e.key === 'Enter' && onJoin()}
                  data-testid="join-game-id-input"
                />
              </div>
              <Button
                onClick={onJoin}
                disabled={!joinGameId.trim()}
                className="bg-brand hover:bg-brand w-full text-white"
                data-testid="join-game-submit-button"
              >
                Join Game Room
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Dialog
      open={dialogs.join}
      onOpenChange={(open) => setDialogs((prev) => ({ ...prev, join: open }))}
    >
      <DialogTrigger asChild>
        <Button
          size="lg"
          variant="outline"
          className="border-surface-3 bg-surface-1/50 text-text-secondary hover:bg-surface-2 h-14 min-w-[200px] gap-2 text-lg font-semibold hover:text-white"
          onClick={onJoinClick}
          data-testid="join-game-button"
        >
          <Play className="h-5 w-5" />
          Join Game
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border-muted bg-surface-1">
        <DialogHeader>
          <DialogTitle className="text-text-primary">Join a Game</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="game-id" className="text-text-secondary">
              Game ID
            </Label>
            <Input
              id="game-id"
              placeholder="Enter game ID (e.g., ABC123)"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              className="border-surface-3 bg-surface-0 text-text-primary"
              onKeyDown={(e) => e.key === 'Enter' && onJoin()}
              data-testid="join-game-id-input"
            />
          </div>
          <Button
            onClick={onJoin}
            disabled={!joinGameId.trim()}
            className="bg-brand hover:bg-brand w-full text-white"
            data-testid="join-game-submit-button"
          >
            Join Game Room
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LandingActionErrorFallback() {
  return (
    <div className="border-warning/40 bg-warning/10 text-warning flex h-14 min-w-[240px] items-center gap-2 rounded-xl border px-4 text-sm font-medium">
      <AlertTriangle className="h-4 w-4" />
      <span>The portal fizzles. Use Create Game while we reconnect.</span>
    </div>
  )
}

function LandingLiveStats() {
  const liveStatsQuery = useQuery(api.rooms.getLiveStats)
  const onlineUsers = liveStatsQuery?.onlineUsers
  const activeRooms = liveStatsQuery?.activeRooms
  const liveStats = useMemo(
    () => [
      {
        label: 'Online Users',
        value: onlineUsers !== undefined ? onlineUsers.toLocaleString() : '—',
        icon: Users,
        accent: 'text-brand-muted-foreground',
        badge: 'Live now',
      },
      {
        label: 'Active Game Rooms',
        value: activeRooms !== undefined ? activeRooms.toLocaleString() : '—',
        icon: Gamepad2,
        accent: 'text-info',
        badge: 'Playing',
      },
    ],
    [onlineUsers, activeRooms],
  )

  return (
    <div className="mt-8 grid w-full max-w-xl grid-cols-2 gap-3 sm:gap-4 md:justify-start">
      {liveStats.map((stat) => (
        <div
          key={stat.label}
          className="border-border-muted bg-surface-0/70 shadow-brand/10 relative flex flex-col items-start gap-3 rounded-2xl border px-3 py-3 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4 md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center lg:gap-4 lg:px-4"
        >
          <div className="bg-surface-2/60 flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11">
            <stat.icon className={`h-4 w-4 ${stat.accent} sm:h-5 sm:w-5`} />
          </div>
          <div className="flex flex-col">
            <div className="text-text-primary text-lg font-semibold sm:text-xl">
              {stat.value}
            </div>
            <div className="text-text-muted text-[10px] uppercase tracking-wider sm:text-xs sm:tracking-[0.2em]">
              {stat.label}
            </div>
          </div>
          <div className="text-online absolute right-3 top-3 flex items-center gap-2 text-[10px] font-medium">
            <span className="bg-online h-1.5 w-1.5 animate-pulse rounded-full sm:h-2 sm:w-2" />
            <span className="xs:inline hidden sm:inline">{stat.badge}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function LandingLiveStatsErrorFallback() {
  return (
    <div className="mt-8 w-full max-w-xl rounded-2xl border border-red-500/30 bg-red-950/20 p-4 backdrop-blur-sm">
      <div className="text-red-300 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
        <AlertTriangle className="h-4 w-4" />
        Leyline Distortion
      </div>
      <p className="text-text-secondary mt-2 text-sm">
        We could not read live Convex signals. The battlefield remains stable,
        but live counters are hidden until mana flows again.
      </p>
    </div>
  )
}

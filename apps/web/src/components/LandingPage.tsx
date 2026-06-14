import type { AuthUser } from '@/contexts/AuthContext'
import type { FallbackProps } from 'react-error-boundary'
import { useMemo, useState } from 'react'
import { env } from '@/env'
import { createRoomWithObservability } from '@/lib/observed-room-actions'
import { sessionStorage } from '@/lib/session-storage'
import { api } from '@convex/_generated/api'
import { useNavigate } from '@tanstack/react-router'
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
import { ErrorBoundary } from 'react-error-boundary'

import { Button } from '@repo/ui/components/button'
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
import { JoinGameDialog } from './JoinGameDialog.js'

import './LandingPage.css'

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
  isAuthLoading?: boolean
  onSignIn?: () => void | Promise<void>
  onPreviewSignIn?: (code: string) => void | Promise<void>
}

export function LandingPage({
  initialError,
  inviteState: _inviteState,
  onRefreshInvite: _onRefreshInvite,
  isRefreshingInvite: _isRefreshingInvite,
  user,
  isAuthLoading = false,
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
      const result = await createRoomWithObservability(createRoom, user.id)

      const gameId = result.roomId
      if (!gameId) {
        throw new Error('Failed to create game room')
      }

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

  const handleJoin = (validatedGameId: string) => {
    if (validatedGameId && user) {
      handleJoinGame(user.username, validatedGameId)
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
        <div
          className="
          fixed top-4 right-4 z-50 max-w-md rounded-lg bg-destructive/90 p-4
          text-white shadow-lg
        "
        >
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
      {/* Background with gradient overlay */}
      <div
        className="
        absolute inset-0 bg-linear-to-br from-purple-900/20 via-background
        to-blue-900/20
      "
      />

      {/* Animated background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="
          absolute top-20 left-20 size-64 animate-pulse rounded-full bg-brand/10
          blur-3xl
        "
        />
        <div
          className="
          absolute right-20 bottom-20 size-96 animate-pulse rounded-full
          bg-info/10 blur-3xl delay-1000
        "
        />
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
            <div
              className="
              mx-auto max-w-xl rounded-xl border border-warning/40
              bg-surface-1/90 p-4 backdrop-blur-md
            "
            >
              <p className="mb-3 text-sm font-semibold text-warning">
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
        <section
          className="
          container mx-auto px-4 py-12
          md:py-24
        "
        >
          <div
            className="
            grid items-center gap-12
            md:grid-cols-2
            lg:gap-20
          "
          >
            {/* Text Content */}
            <div
              className="
              flex flex-col items-center text-center
              md:items-start md:text-left
            "
            >
              <div
                className="
                mb-6 inline-flex items-center gap-2 rounded-full border
                border-brand/30 bg-brand-muted px-4 py-2 backdrop-blur-md
              "
              >
                <Sparkles className="size-4 text-brand-muted-foreground" />
                <span
                  className="
                  text-sm font-medium text-brand-muted-foreground
                "
                >
                  No downloads. No setup. Just play.
                </span>
              </div>

              <h1
                className="
                mb-6 text-5xl leading-[1.08] text-text-primary
                md:text-7xl
                lg:text-8xl
              "
              >
                Play Magic
                <span
                  className="mt-2 block bg-clip-text pb-2 text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(to right, var(--gradient-from), var(--gradient-to))`,
                  }}
                >
                  Anywhere.
                </span>
              </h1>

              <p
                className="
                mb-8 max-w-xl text-lg leading-relaxed text-text-secondary
                md:text-xl
              "
              >
                Spell Coven lets you play paper MTG remotely through video chat
                and card recognition. Use your physical cards, see your
                opponents, and enjoy the authentic experience.
              </p>

              <div
                className="
                flex flex-col items-center gap-4
                sm:flex-row
                md:justify-start
              "
              >
                {isAuthLoading ? (
                  <>
                    <div
                      className="
                      h-14 min-w-[200px] animate-pulse rounded-md bg-surface-2
                    "
                    />
                    <div
                      className="
                      h-14 min-w-[200px] animate-pulse rounded-md bg-surface-2
                    "
                    />
                  </>
                ) : isAuthenticated ? (
                  <>
                    <div
                      className={`
                        create-game-btn-wrap
                        relative${gameCreation.isCreating ? `is-loading` : ''}
                      `}
                    >
                      <Button
                        size="lg"
                        className="
                          h-14 min-w-[200px] gap-2 bg-brand text-lg
                          font-semibold text-white shadow-lg shadow-brand/25
                          transition-all duration-200
                          hover:bg-brand
                          disabled:cursor-not-allowed disabled:opacity-50
                        "
                        onClick={handleCreateClick}
                        disabled={gameCreation.isCreating}
                        data-testid="create-game-button"
                      >
                        {gameCreation.isCreating ? (
                          <>
                            <Loader2 className="size-5 animate-spin" />
                            <span>Creating Game...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="size-5" />
                            <span>Create Game</span>
                          </>
                        )}
                      </Button>
                      <div className="glimmer-sweep" />
                    </div>

                    <ErrorBoundary
                      FallbackComponent={LandingActionErrorFallback}
                      resetKeys={[isAuthenticated]}
                    >
                      <LandingJoinActions
                        isAuthenticated={isAuthenticated}
                        dialogs={dialogs}
                        setDialogs={setDialogs}
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
                    className="
                      group relative h-14 min-w-[260px] gap-3 overflow-hidden
                      border border-white/10 bg-linear-to-r from-[#5865F2]
                      to-purple-600 text-lg font-semibold text-white
                      shadow-[0_0_30px_rgba(88,101,242,0.4)] transition-all
                      hover:scale-105 hover:from-[#4752C4] hover:to-purple-700
                      hover:shadow-[0_0_50px_rgba(88,101,242,0.6)]
                    "
                    onClick={onSignIn}
                  >
                    <div
                      className="
                      absolute inset-0 bg-white/20 opacity-0 transition-opacity
                      group-hover:opacity-100
                    "
                    />
                    <svg
                      className="
                        size-6 transition-transform
                        group-hover:scale-110
                      "
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Sign in with Discord
                  </Button>
                )}
              </div>

              <ErrorBoundary FallbackComponent={LandingLiveStatsErrorFallback}>
                <LandingLiveStats />
              </ErrorBoundary>
            </div>

            {/* Visual/Logo */}
            <div
              className="
              relative mx-auto size-64
              md:size-96
            "
            >
              <div className="animate-float relative size-full">
                <div
                  className="
                  absolute inset-0 animate-pulse rounded-full bg-brand/20
                  blur-3xl
                "
                />
                <img
                  src={logoSrc}
                  alt="Spell Coven Logo"
                  className="relative z-10 size-full object-contain"
                  style={{
                    filter: 'drop-shadow(0 0 30px var(--brand-glow))',
                  }}
                />

                {/* Decorative sparkles */}
                <Sparkles
                  className="
                  animate-sparkle absolute top-10 -left-8 size-8 text-warning
                  drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]
                "
                />
                <Sparkles
                  className="
                  animate-sparkle absolute -right-4 bottom-20 size-6 text-info
                  drop-shadow-[0_0_8px_rgba(147,197,253,0.8)] delay-700
                "
                />
                <Sparkles
                  className="
                  animate-sparkle absolute bottom-0 left-0 size-8
                  text-brand-muted-foreground
                  drop-shadow-[0_0_8px_rgba(216,180,254,0.8)] delay-1500
                "
                />
              </div>
            </div>
          </div>

          {/* App Preview Placeholder */}
          <div className="group relative mx-auto mt-20 max-w-6xl">
            {/* Glow effects */}
            <div
              className="
              absolute -inset-1 rounded-2xl bg-linear-to-r from-purple-600/50
              to-blue-600/50 opacity-30 blur-2xl transition-opacity duration-500
              group-hover:opacity-50
            "
            />

            <div
              className="
              relative rounded-xl border border-border-muted bg-surface-0/80 p-2
              shadow-2xl ring-1 ring-white/10 backdrop-blur-sm
            "
            >
              <div
                className="
                absolute inset-0 -z-10 bg-linear-to-b from-purple-500/5
                to-transparent opacity-50
              "
              />

              {/* Fake Game Interface */}
              <div
                className="
                flex h-[400px] w-full flex-col overflow-hidden rounded-lg
                bg-[#0f1117]
                sm:h-[600px]
              "
              >
                {/* Top Bar */}
                <div
                  className="
                  flex items-center justify-between border-b border-border-muted
                  bg-surface-1/50 px-4 py-2
                "
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-text-muted">
                      <LogOut className="size-4 rotate-180" />
                      <span className="text-sm">Leave</span>
                    </div>
                    <div className="h-4 w-px bg-surface-2" />
                    <span className="text-sm text-text-muted">
                      Game ID:{' '}
                      <span className="font-mono text-brand-muted-foreground">
                        ABC123
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-text-muted">
                    <Users className="size-4" />
                    <span className="text-xs">4/4 Players</span>
                    <Settings className="ml-2 size-4" />
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar */}
                  <div
                    className="
                    hidden w-64 flex-col gap-4 border-r border-border-muted
                    bg-surface-1/30 p-4
                    lg:flex
                  "
                  >
                    <div
                      className="
                      rounded-lg border border-border-muted bg-surface-2/20 p-4
                    "
                    >
                      <div
                        className="
                        mb-2 flex items-center gap-2 text-xs font-medium
                        text-text-muted
                      "
                      >
                        <Play className="size-3" />
                        Current Turn
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-medium text-white">
                          Rowan
                        </div>
                        <div className="text-xs text-text-muted">
                          is playing
                        </div>
                        <div
                          className="
                          mt-3 w-full rounded-sm bg-brand py-1.5 text-sm
                          font-medium text-white shadow-lg shadow-brand/20
                        "
                        >
                          Next Turn
                        </div>
                      </div>
                    </div>

                    <div
                      className="
                      flex-1 rounded-lg border border-border-muted
                      bg-surface-2/20 p-4
                    "
                    >
                      <div className="mb-3 text-xs font-medium text-text-muted">
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
                            className={`
                              flex items-center justify-between rounded-sm p-2
                              ${
                                p.me
                                  ? `bg-brand/10 ring-1 ring-brand/50`
                                  : `
                                hover:bg-surface-2/50
                              `
                              }
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`
                                  size-2 rounded-full
                                  ${p.me ? `bg-success` : `bg-surface-3`}
                                `}
                              />
                              <span
                                className={`
                                  text-sm
                                  ${
                                    p.me
                                      ? `font-medium text-white`
                                      : `
                                    text-text-secondary
                                  `
                                  }
                                `}
                              >
                                {p.name}
                                {p.me && (
                                  <span
                                    className="
                                    ml-2 rounded-sm bg-brand/20 px-1 py-0.5
                                    text-[10px] text-brand-muted-foreground
                                  "
                                  >
                                    You
                                  </span>
                                )}
                              </span>
                            </div>
                            <div
                              className="
                              flex items-center gap-1 text-text-muted
                            "
                            >
                              <Heart className="size-3" />
                              <span className="text-xs">{p.hp}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Game Grid */}
                  <div
                    className="
                    grid flex-1 grid-cols-2 grid-rows-2 gap-2 p-2
                    sm:gap-4 sm:p-4
                  "
                  >
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
                        className={`
                          relative overflow-hidden rounded-lg border
                          bg-surface-1/50 shadow-inner transition-all
                          ${
                            p.isActive
                              ? `
                            border-brand/50
                            shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)] ring-1
                            ring-brand/30
                          `
                              : `border-border-muted`
                          }
                        `}
                      >
                        {/* Player Header */}
                        <div
                          className="
                          absolute top-2 left-2 z-10 flex items-center gap-2
                          rounded-sm bg-surface-0/60 px-2 py-1 text-xs
                          backdrop-blur-sm
                        "
                        >
                          <div
                            className={`
                              size-1.5 rounded-full
                              ${p.me ? `bg-success` : `bg-text-muted`}
                            `}
                          />
                          <span className="text-text-secondary">{p.name}</span>
                          {p.me && (
                            <span
                              className="
                              rounded-sm bg-brand/30 px-1 py-0.5 text-[10px]
                              font-medium text-brand-muted-foreground
                            "
                            >
                              You
                            </span>
                          )}
                        </div>

                        {/* Life Counter */}
                        <div
                          className="
                          absolute bottom-4 left-4 z-10 rounded-lg border
                          border-border-muted bg-surface-0/80 p-2 text-center
                          backdrop-blur-sm
                        "
                        >
                          <div className="text-xl font-bold text-white">40</div>
                          <div
                            className="
                            text-[10px] tracking-wider text-text-muted uppercase
                          "
                          >
                            Life
                          </div>
                        </div>

                        {/* Simulated Camera Feed */}
                        <div
                          className="
                          flex size-full items-center justify-center
                          bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))]
                          from-surface-2/50 to-surface-0
                        "
                        >
                          <div
                            className="
                            flex flex-col items-center gap-3 opacity-20
                          "
                          >
                            <Camera className="size-8 text-text-muted" />
                            <span
                              className="
                              text-sm font-medium text-text-muted
                            "
                            >
                              Table View
                            </span>
                          </div>
                        </div>

                        {/* Card Recognition Overlay (Simulated) */}
                        {p.card && (
                          <div
                            className="
                            absolute top-1/2 right-4 z-20 w-24 -translate-y-1/2
                            rotate-3 transform transition-transform
                            hover:scale-150 hover:rotate-0
                          "
                          >
                            <div
                              className="
                              group relative aspect-[2.5/3.5] cursor-pointer
                              overflow-hidden rounded-sm border border-white/20
                              shadow-2xl
                            "
                            >
                              {/* Placeholder for card image since we can't rely on external URLs reliably in preview without being sure they load, using a colored div with icon */}
                              <div
                                className="
                                flex size-full items-center justify-center
                                bg-surface-2
                              "
                              >
                                <div
                                  className="
                                  size-full bg-linear-to-br from-amber-900/40
                                  to-slate-900
                                "
                                ></div>
                                <Sparkles className="absolute text-warning/50" />
                              </div>
                              <div
                                className="
                                absolute inset-0 bg-linear-to-t from-black/60
                                to-transparent opacity-0 transition-opacity
                                group-hover:opacity-100
                              "
                              >
                                <div
                                  className="
                                  flex h-full items-end justify-center pb-2
                                "
                                >
                                  <span className="text-[10px] text-white">
                                    Click to zoom
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Card Recognition Rectangles (Simulated) */}
                        <div
                          className="
                          absolute top-1/2 left-1/2 h-32 w-48 -translate-x-1/2
                          -translate-y-1/2 rounded-sm border-2 border-dashed
                          border-white/5 opacity-50
                        "
                        />
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
            <h2
              className="
              mb-16 text-center text-4xl text-text-primary
              md:text-5xl
            "
            >
              Everything You Need to Play
            </h2>
            <div
              className="
              grid gap-8
              md:grid-cols-3
            "
            >
              <SpotlightCard
                className="
                  border-border-muted bg-surface-1/50 p-6 backdrop-blur-sm
                "
                spotlightColor="rgba(168, 85, 247, 0.15)"
              >
                <div
                  className="
                  mb-4 flex size-12 shrink-0 items-center justify-center
                  rounded-lg bg-brand/20
                "
                >
                  <Video className="size-6 text-brand-muted-foreground" />
                </div>
                <h3 className="mb-2 text-xl text-text-primary">
                  Battlefield Video
                </h3>
                <p className="text-text-muted">
                  Clear video feeds of everyone&apos;s battlefield. See your
                  opponents&apos; playmats, cards, and game state in real-time.
                </p>
              </SpotlightCard>

              <SpotlightCard
                className="
                  border-border-muted bg-surface-1/50 p-6 backdrop-blur-sm
                "
                spotlightColor="rgba(59, 130, 246, 0.15)"
              >
                <div
                  className="
                  mb-4 flex size-12 shrink-0 items-center justify-center
                  rounded-lg bg-info/20
                "
                >
                  <Camera className="size-6 text-info" />
                </div>
                <h3 className="mb-2 text-xl text-text-primary">
                  Card Recognition
                </h3>
                <p className="text-text-muted">
                  Point your camera at cards and the system recognizes them for
                  your opponents to see.
                </p>
              </SpotlightCard>

              <SpotlightCard
                className="
                  border-border-muted bg-surface-1/50 p-6 backdrop-blur-sm
                "
                spotlightColor="rgba(34, 197, 94, 0.15)"
              >
                <div
                  className="
                  mb-4 flex size-12 shrink-0 items-center justify-center
                  rounded-lg bg-success/20
                "
                >
                  <Users className="size-6 text-success" />
                </div>
                <h3 className="mb-3 text-xl text-text-primary">
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
          className="relative container mx-auto overflow-hidden px-4 py-24"
        >
          <div className="mx-auto max-w-6xl">
            <h2
              className="
              mb-20 text-center text-4xl text-text-primary
              md:text-5xl
            "
            >
              How It Works
            </h2>

            <div
              className="
              relative grid gap-12
              md:grid-cols-3 md:gap-8
            "
            >
              {/* Connector Line (Desktop) */}
              <div
                className="
                absolute top-12 right-[16%] left-[16%] hidden h-0.5
                bg-linear-to-r from-slate-800 via-purple-900/50 to-slate-800
                md:block
              "
              />

              {/* Step 1 */}
              <div
                className="
                group relative flex flex-col items-center text-center
              "
              >
                <div
                  className="
                  relative z-10 mb-6 flex size-24 items-center justify-center
                  rounded-2xl border border-border-muted bg-surface-0 shadow-xl
                  transition-all duration-300
                  group-hover:border-brand/50
                  group-hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)]
                "
                >
                  <div
                    className="
                    absolute inset-0 rounded-2xl bg-linear-to-br
                    from-purple-500/20 to-blue-500/20 opacity-0
                    transition-opacity
                    group-hover:opacity-100
                  "
                  />
                  <Gamepad2
                    className="
                    relative z-10 size-10 text-brand-muted-foreground
                    transition-transform duration-300
                    group-hover:scale-110
                    group-hover:text-brand-muted-foreground
                  "
                  />
                  <div
                    className="
                    absolute -top-3 -right-3 flex size-8 items-center
                    justify-center rounded-full border border-border-muted
                    bg-surface-1 text-sm font-bold text-white shadow-lg ring-4
                    ring-surface-0
                  "
                  >
                    1
                  </div>
                </div>
                <h3
                  className="
                  mb-3 text-xl font-semibold text-text-primary transition-colors
                  group-hover:text-brand-muted-foreground
                "
                >
                  Create or Join
                </h3>
                <p className="max-w-xs leading-relaxed text-text-muted">
                  Start a new game room and share the game ID with your friends,
                  or join an existing game instantly.
                </p>
              </div>

              {/* Step 2 */}
              <div
                className="
                group relative flex flex-col items-center text-center
              "
              >
                <div
                  className="
                  relative z-10 mb-6 flex size-24 items-center justify-center
                  rounded-2xl border border-border-muted bg-surface-0 shadow-xl
                  transition-all duration-300
                  group-hover:border-info/50
                  group-hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]
                "
                >
                  <div
                    className="
                    absolute inset-0 rounded-2xl bg-linear-to-br
                    from-blue-500/20 to-cyan-500/20 opacity-0 transition-opacity
                    group-hover:opacity-100
                  "
                  />
                  <Scan
                    className="
                    relative z-10 size-10 text-info transition-transform
                    duration-300
                    group-hover:scale-110 group-hover:text-info
                  "
                  />
                  <div
                    className="
                    absolute -top-3 -right-3 flex size-8 items-center
                    justify-center rounded-full border border-border-muted
                    bg-surface-1 text-sm font-bold text-white shadow-lg ring-4
                    ring-surface-0
                  "
                  >
                    2
                  </div>
                </div>
                <h3
                  className="
                  mb-3 text-xl font-semibold text-text-primary transition-colors
                  group-hover:text-info
                "
                >
                  Set Up Cameras
                </h3>
                <p className="max-w-xs leading-relaxed text-text-muted">
                  Position your main camera for your playmat and cards.
                  Optionally add a second camera for video chat.
                </p>
              </div>

              {/* Step 3 */}
              <div
                className="
                group relative flex flex-col items-center text-center
              "
              >
                <div
                  className="
                  relative z-10 mb-6 flex size-24 items-center justify-center
                  rounded-2xl border border-border-muted bg-surface-0 shadow-xl
                  transition-all duration-300
                  group-hover:border-success/50
                  group-hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]
                "
                >
                  <div
                    className="
                    absolute inset-0 rounded-2xl bg-linear-to-br
                    from-green-500/20 to-emerald-500/20 opacity-0
                    transition-opacity
                    group-hover:opacity-100
                  "
                  />
                  <Swords
                    className="
                    relative z-10 size-10 text-success transition-transform
                    duration-300
                    group-hover:scale-110 group-hover:text-success
                  "
                  />
                  <div
                    className="
                    absolute -top-3 -right-3 flex size-8 items-center
                    justify-center rounded-full border border-border-muted
                    bg-surface-1 text-sm font-bold text-white shadow-lg ring-4
                    ring-surface-0
                  "
                  >
                    3
                  </div>
                </div>
                <h3
                  className="
                  mb-3 text-xl font-semibold text-text-primary transition-colors
                  group-hover:text-success
                "
                >
                  Play Magic
                </h3>
                <p className="max-w-xs leading-relaxed text-text-muted">
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
            className="
              border-border-muted bg-surface-1/50 px-6 py-16 text-center
              backdrop-blur-sm
              md:px-12
            "
            spotlightColor="rgba(168, 85, 247, 0.15)"
          >
            {/* Background effects */}
            <div
              className="
              absolute -top-20 -left-20 size-64 rounded-full bg-brand/10
              blur-3xl
            "
            />
            <div
              className="
              absolute -right-20 -bottom-20 size-64 rounded-full bg-info/10
              blur-3xl
            "
            />

            <h2
              className="
              relative z-10 mb-6 text-3xl text-text-primary
              md:text-5xl
            "
            >
              Ready to Enter the Coven?
            </h2>
            <p
              className="
              relative z-10 mx-auto mb-8 max-w-2xl text-lg text-text-secondary
            "
            >
              Join thousands of planeswalkers playing paper Magic remotely.
              It&apos;s free, runs in your browser, and brings the gathering
              back to Magic.
            </p>

            <div
              className="
              relative z-10 flex flex-col items-center justify-center gap-4
              sm:flex-row
            "
            >
              {isAuthLoading ? (
                <>
                  <div
                    className="
                    h-14 min-w-[200px] animate-pulse rounded-md bg-surface-2
                  "
                  />
                  <div
                    className="
                    h-14 min-w-[200px] animate-pulse rounded-md bg-surface-2
                  "
                  />
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={isAuthenticated ? handleCreateClick : onSignIn}
                    className="
                      h-14 min-w-[200px] gap-2 bg-brand text-lg font-semibold
                      text-white shadow-lg shadow-brand/25
                      hover:bg-brand
                    "
                  >
                    <Sparkles className="size-5" />
                    {isAuthenticated
                      ? 'Start a Game Now'
                      : 'Start Playing for Free'}
                  </Button>
                  {!isAuthenticated && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="
                        h-14 min-w-[200px] border-surface-3 bg-surface-1/50
                        text-lg font-semibold text-text-secondary
                        hover:bg-surface-2 hover:text-white
                      "
                      onClick={() => {
                        const element = document.getElementById('how-it-works')
                        element?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      Learn More
                    </Button>
                  )}
                </>
              )}
            </div>
          </SpotlightCard>
        </section>

        {/* Footer */}
        <footer className="border-t border-border-muted bg-surface-0">
          <div className="container mx-auto px-4 py-12">
            <div
              className={`
                grid gap-8
                ${supportUrl ? 'md:grid-cols-6' : 'md:grid-cols-5'}
              `}
            >
              <div className="col-span-2 space-y-4">
                <div className="flex items-center gap-2">
                  <img
                    src={logo}
                    alt="Spell Coven Logo"
                    className="
                      size-8 rounded-lg object-contain grayscale transition-all
                      hover:grayscale-0
                    "
                  />
                  <span className="text-lg font-bold text-text-primary">
                    Spell Coven
                  </span>
                </div>
                <p className="max-w-xs text-sm text-text-muted">
                  The best way to play paper Magic: The Gathering remotely with
                  friends. High-quality video, card recognition, and zero setup.
                </p>
              </div>

              <div>
                <h4 className="mb-4 text-sm font-semibold text-text-primary">
                  Product
                </h4>
                <ul className="space-y-2 text-sm text-text-muted">
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
                <h4 className="mb-4 text-sm font-semibold text-text-primary">
                  Legal
                </h4>
                <ul className="space-y-2 text-sm text-text-muted">
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
                <h4 className="mb-4 text-sm font-semibold text-text-primary">
                  Open Source
                </h4>
                <p className="mb-4 text-sm text-text-muted">
                  Spell Coven is open source. Contribute or star us on GitHub!
                </p>
                <a
                  href="https://github.com/FrimJo/spell-coven-mono"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex items-center gap-2 rounded-full border
                    border-surface-3 bg-surface-1/50 px-4 py-2 text-sm
                    font-medium text-text-secondary transition-colors
                    hover:bg-surface-2 hover:text-text-primary
                  "
                >
                  <Github className="size-4" />
                  View on GitHub
                </a>
              </div>

              {supportUrl && (
                <div>
                  <h4 className="mb-4 text-sm font-semibold text-text-primary">
                    Support
                  </h4>
                  <p className="mb-4 text-sm text-text-muted">
                    Enjoying Spell Coven? Support ongoing development.
                  </p>
                  <a
                    href={supportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="
                      inline-flex items-center gap-2 rounded-full bg-brand px-4
                      py-2 text-sm font-semibold text-white shadow-lg
                      shadow-brand/30 transition
                      hover:bg-brand
                    "
                  >
                    <Heart className="size-4" />
                    Buy me a coffee
                  </a>
                </div>
              )}
            </div>

            <div
              className="
              mt-12 border-t border-border-muted pt-8 text-center text-sm
              text-text-muted
            "
            >
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
                  className="
                    text-brand-muted-foreground
                    hover:text-brand
                  "
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
  onJoinClick: () => void
  onJoin: (validatedGameId: string) => void
  onRejoinLastRoom: (roomId: string) => void
}

function LandingJoinActions({
  isAuthenticated,
  dialogs,
  setDialogs,
  onJoinClick,
  onJoin,
  onRejoinLastRoom,
}: LandingJoinActionsProps) {
  const activeRoomQuery = useQuery(
    api.players.getActiveRoomForUser,
    isAuthenticated ? {} : 'skip',
  )

  const handleJoinDialogChange = (open: boolean) =>
    setDialogs((prev) => ({ ...prev, join: open }))

  if (activeRoomQuery?.roomId) {
    return (
      <>
        <div className="flex">
          <Button
            size="lg"
            variant="outline"
            className="
              h-14 min-w-[160px] gap-2 rounded-r-none border-r-0
              border-success/40 bg-success/10 text-lg font-semibold text-success
              hover:bg-success/20 hover:text-white
            "
            onClick={() => onRejoinLastRoom(activeRoomQuery.roomId)}
            data-testid="rejoin-game-button"
          >
            <RotateCcw className="size-5" />
            Rejoin Game
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="lg"
                variant="outline"
                className="
                  h-14 rounded-l-none border-success/40 bg-success/10 px-3
                  text-success
                  hover:bg-success/20
                "
                data-testid="join-game-dropdown"
              >
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-surface-3 bg-surface-1"
            >
              <DropdownMenuItem
                onClick={onJoinClick}
                className="
                  text-text-secondary
                  hover:text-white
                "
              >
                <Play className="mr-2 size-4" />
                Join with Code
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <JoinGameDialog
          open={dialogs.join}
          onOpenChange={handleJoinDialogChange}
          onJoin={onJoin}
        />
      </>
    )
  }

  return (
    <>
      <Button
        size="lg"
        variant="outline"
        className="
          h-14 min-w-[200px] gap-2 border-surface-3 bg-surface-1/50 text-lg
          font-semibold text-text-secondary
          hover:bg-surface-2 hover:text-white
        "
        onClick={onJoinClick}
        data-testid="join-game-button"
      >
        <Play className="size-5" />
        Join Game
      </Button>

      <JoinGameDialog
        open={dialogs.join}
        onOpenChange={handleJoinDialogChange}
        onJoin={onJoin}
      />
    </>
  )
}

function LandingActionErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <button
      onClick={resetErrorBoundary}
      className="
        flex h-14 min-w-[240px] cursor-pointer items-center gap-2 rounded-xl
        border border-warning/40 bg-warning/10 px-4 text-sm font-medium
        text-warning transition-colors
        hover:bg-warning/20
      "
    >
      <AlertTriangle className="size-4 shrink-0" />
      <span>The portal fizzles. Click to retry.</span>
    </button>
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
    <div
      className="
      mt-8 grid w-full max-w-xl grid-cols-2 gap-3
      sm:gap-4
      md:justify-start
    "
    >
      {liveStats.map((stat) => (
        <div
          key={stat.label}
          className="
            relative flex flex-col items-start gap-3 rounded-2xl border
            border-border-muted bg-surface-0/70 p-3 shadow-lg shadow-brand/10
            backdrop-blur-sm
            sm:flex-row sm:items-center sm:gap-4
            md:flex-col md:items-start md:gap-3
            lg:flex-row lg:items-center lg:gap-4 lg:px-4
          "
        >
          <div
            className="
            flex size-10 shrink-0 items-center justify-center rounded-full
            bg-surface-2/60
            sm:size-11
          "
          >
            <stat.icon
              className={`
              size-4
              ${stat.accent}
              sm:size-5
            `}
            />
          </div>
          <div className="flex flex-col">
            <div
              className="
              text-lg font-semibold text-text-primary
              sm:text-xl
            "
            >
              {stat.value}
            </div>
            <div
              className="
              text-[10px] tracking-wider text-text-muted uppercase
              sm:text-xs sm:tracking-[0.2em]
            "
            >
              {stat.label}
            </div>
          </div>
          <div
            className="
            absolute top-3 right-3 flex items-center gap-2 text-[10px]
            font-medium text-online
          "
          >
            <span
              className="
              size-1.5 animate-pulse rounded-full bg-online
              sm:size-2
            "
            />
            <span
              className="
              xs:inline
              hidden
              sm:inline
            "
            >
              {stat.badge}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function LandingLiveStatsErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div
      className="
      mt-8 w-full max-w-xl rounded-2xl border border-red-500/30 bg-red-950/20
      p-4 backdrop-blur-sm
    "
    >
      <div
        className="
        flex items-center gap-2 text-sm font-semibold tracking-wider
        text-red-300 uppercase
      "
      >
        <AlertTriangle className="size-4" />
        Leyline Distortion
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        We could not read live Convex signals. The battlefield remains stable,
        but live counters are hidden until mana flows again.
      </p>
      <button
        onClick={resetErrorBoundary}
        className="
          mt-3 cursor-pointer text-sm font-medium text-brand-muted-foreground
          underline underline-offset-2 transition-colors
          hover:text-brand
        "
      >
        Retry
      </button>
    </div>
  )
}

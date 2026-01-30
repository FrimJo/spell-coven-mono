import type { AuthUser } from '@/contexts/AuthContext'
import { useMemo, useState } from 'react'
import { sessionStorage } from '@/lib/session-storage'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  Camera,
  Gamepad2,
  Heart,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  Play,
  Plus,
  Scan,
  Settings,
  Sparkles,
  Swords,
  Users,
  Video,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui/components/sheet'
import { Toaster } from '@repo/ui/components/sonner'

import type { CreatorInviteState } from '../lib/session-storage.js'
import { api } from '../../../../convex/_generated/api'
import logo from '../assets/logo_1024x1024.png'
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
  isAuthLoading?: boolean
  onSignIn?: () => void | Promise<void>
  onSignOut?: () => void | Promise<void>
}

export function LandingPage({
  initialError,
  inviteState: _inviteState,
  onRefreshInvite: _onRefreshInvite,
  isRefreshingInvite: _isRefreshingInvite,
  user,
  isAuthLoading,
  onSignIn,
  onSignOut,
}: LandingPageProps) {
  const navigate = useNavigate()
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
  const liveStatsQuery = useQuery(api.rooms.getLiveStats)
  const createRoom = useMutation(api.rooms.createRoom)
  const liveStats = useMemo(
    () => [
      {
        label: 'Online Users',
        value:
          liveStatsQuery?.onlineUsers !== undefined
            ? liveStatsQuery.onlineUsers.toLocaleString()
            : '—',
        icon: Users,
        accent: 'text-purple-300',
        badge: 'Live now',
      },
      {
        label: 'Active Game Rooms',
        value:
          liveStatsQuery?.activeRooms !== undefined
            ? liveStatsQuery.activeRooms.toLocaleString()
            : '—',
        icon: Gamepad2,
        accent: 'text-blue-300',
        badge: 'Playing',
      },
    ],
    [liveStatsQuery],
  )
  const isAuthenticated = !!user

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

  const handleRoomNotFoundDialogClose = () => {
    setShowRoomNotFoundDialog(false)
    // Clear the error from URL search params
    navigate({ to: '/', search: {} })
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {error && (
        <div className="fixed right-4 top-4 z-50 max-w-md rounded-lg bg-red-500/90 p-4 text-white shadow-lg">
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
      <div className="bg-linear-to-br absolute inset-0 from-purple-900/20 via-slate-950 to-blue-900/20" />

      {/* Animated background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-20 top-20 h-64 w-64 animate-pulse rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-20 right-20 h-96 w-96 animate-pulse rounded-full bg-blue-500/10 blur-3xl delay-1000" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <img
                src={logo}
                alt="Spell Coven Logo"
                className="h-10 w-10 rounded-xl object-contain"
              />
              <span className="text-xl font-bold text-white">Spell Coven</span>
            </div>
            <nav className="hidden items-center gap-6 md:flex">
              <a
                href="#features"
                onClick={(e) => handleNavClick(e, 'features')}
                className="text-slate-300 transition-colors hover:text-white"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={(e) => handleNavClick(e, 'how-it-works')}
                className="text-slate-300 transition-colors hover:text-white"
              >
                How It Works
              </a>

              {/* Auth section */}
              {isAuthLoading ? (
                <div className="h-9 w-24 animate-pulse rounded-md bg-slate-800" />
              ) : isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 text-slate-300 hover:text-white"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="bg-purple-600 text-white">
                          {user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="inline">{user.username}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-slate-700 bg-slate-900"
                  >
                    <DropdownMenuItem
                      onClick={onSignOut}
                      className="cursor-pointer text-slate-300 focus:bg-slate-800 focus:text-white"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSignIn}
                  className="gap-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign in with Discord</span>
                </Button>
              )}
            </nav>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="flex w-full flex-col border-l border-slate-800 bg-slate-950/95 p-0 backdrop-blur-xl sm:max-w-sm"
                >
                  <SheetHeader className="border-b border-slate-800 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <img
                        src={logo}
                        alt="Spell Coven"
                        className="h-8 w-8 rounded-lg object-contain"
                      />
                      <SheetTitle className="text-lg font-bold text-white">
                        Spell Coven
                      </SheetTitle>
                    </div>
                  </SheetHeader>

                  <div className="flex flex-1 flex-col gap-1 px-4 py-6">
                    <a
                      href="#features"
                      onClick={(e) => handleNavClick(e, 'features')}
                      className="flex items-center rounded-lg px-4 py-3 text-lg font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                    >
                      Features
                    </a>
                    <a
                      href="#how-it-works"
                      onClick={(e) => handleNavClick(e, 'how-it-works')}
                      className="flex items-center rounded-lg px-4 py-3 text-lg font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                    >
                      How It Works
                    </a>
                  </div>

                  <div className="border-t border-slate-800 p-6">
                    {isAuthLoading ? (
                      <div className="h-12 w-full animate-pulse rounded-lg bg-slate-800" />
                    ) : isAuthenticated && user ? (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                          <Avatar className="h-10 w-10 border border-slate-700">
                            <AvatarImage src={user.avatar || undefined} />
                            <AvatarFallback className="bg-purple-600 text-white">
                              {user.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-white">
                              {user.username}
                            </span>
                            <span className="text-xs text-slate-400">
                              Logged in
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={onSignOut}
                          className="h-12 w-full justify-center gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="lg"
                        onClick={onSignIn}
                        className="group relative h-14 w-full gap-3 overflow-hidden border border-white/10 bg-gradient-to-r from-[#5865F2] to-purple-600 text-lg font-semibold text-white shadow-[0_0_30px_rgba(88,101,242,0.4)] transition-all hover:scale-105 hover:from-[#4752C4] hover:to-purple-700 hover:shadow-[0_0_50px_rgba(88,101,242,0.6)]"
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
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-24">
          <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
            {/* Text Content */}
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-900/30 px-4 py-2 backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-200">
                  No downloads. No setup. Just play.
                </span>
              </div>

              <h1 className="mb-6 text-5xl text-white md:text-7xl lg:text-8xl">
                Play Magic
                <span className="mt-2 block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  Anywhere.
                </span>
              </h1>

              <p className="mb-8 max-w-xl text-lg leading-relaxed text-slate-300 md:text-xl">
                Spell Coven lets you play paper MTG remotely through video chat
                and card recognition. Use your physical cards, see your
                opponents, and enjoy the authentic experience.
              </p>

              <div className="flex flex-col items-center gap-4 sm:flex-row md:justify-start">
                {isAuthenticated ? (
                  <>
                    <Button
                      size="lg"
                      className="h-14 min-w-[200px] gap-2 bg-purple-600 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
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

                    <Dialog
                      open={dialogs.join}
                      onOpenChange={(open) =>
                        setDialogs((prev) => ({ ...prev, join: open }))
                      }
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="lg"
                          variant="outline"
                          className="h-14 min-w-[200px] gap-2 border-slate-700 bg-slate-900/50 text-lg font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                          onClick={handleJoinClick}
                          data-testid="join-game-button"
                        >
                          <Play className="h-5 w-5" />
                          Join Game
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="border-slate-800 bg-slate-900">
                        <DialogHeader>
                          <DialogTitle className="text-white">
                            Join a Game
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label htmlFor="game-id" className="text-slate-300">
                              Game ID
                            </Label>
                            <Input
                              id="game-id"
                              placeholder="Enter game ID (e.g., ABC123)"
                              value={joinGameId}
                              onChange={(e) => setJoinGameId(e.target.value)}
                              className="border-slate-700 bg-slate-950 text-white"
                              onKeyDown={(e) =>
                                e.key === 'Enter' && handleJoin()
                              }
                              data-testid="join-game-id-input"
                            />
                          </div>
                          <Button
                            onClick={handleJoin}
                            disabled={!joinGameId.trim()}
                            className="w-full bg-purple-600 text-white hover:bg-purple-700"
                            data-testid="join-game-submit-button"
                          >
                            Join Game Room
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

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

              <div className="mt-8 grid w-full max-w-xl grid-cols-2 gap-3 sm:gap-4 md:justify-start">
                {liveStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="relative flex flex-col items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 shadow-lg shadow-purple-500/10 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4 md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center lg:gap-4 lg:px-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800/60 sm:h-11 sm:w-11">
                      <stat.icon
                        className={`h-4 w-4 ${stat.accent} sm:h-5 sm:w-5`}
                      />
                    </div>
                    <div className="flex flex-col">
                      <div className="text-lg font-semibold text-white sm:text-xl">
                        {stat.value}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 sm:text-xs sm:tracking-[0.2em]">
                        {stat.label}
                      </div>
                    </div>
                    <div className="absolute right-3 top-3 flex items-center gap-2 text-[10px] font-medium text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 sm:h-2 sm:w-2" />
                      <span className="xs:inline hidden sm:inline">
                        {stat.badge}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual/Logo */}
            <div className="relative mx-auto h-64 w-64 md:h-96 md:w-96">
              <div className="animate-float relative h-full w-full">
                <div className="absolute inset-0 animate-pulse rounded-full bg-purple-500/20 blur-3xl" />
                <img
                  src={logo}
                  alt="Spell Coven Logo"
                  className="relative z-10 h-full w-full object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.6)]"
                />

                {/* Decorative sparkles */}
                <Sparkles className="animate-sparkle absolute -left-8 top-10 h-8 w-8 text-yellow-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
                <Sparkles className="animate-sparkle absolute -right-4 bottom-20 h-6 w-6 text-blue-300 drop-shadow-[0_0_8px_rgba(147,197,253,0.8)] delay-700" />
                <Sparkles className="animate-sparkle delay-1500 absolute bottom-0 left-0 h-8 w-8 text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]" />
              </div>
            </div>
          </div>

          {/* App Preview Placeholder */}
          <div className="group relative mx-auto mt-20 max-w-6xl">
            {/* Glow effects */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-600/50 to-blue-600/50 opacity-30 blur-2xl transition-opacity duration-500 group-hover:opacity-50" />

            <div className="relative rounded-xl border border-slate-800 bg-slate-950/80 p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-purple-500/5 to-transparent opacity-50" />

              {/* Fake Game Interface */}
              <div className="flex h-[400px] w-full flex-col overflow-hidden rounded-lg bg-[#0f1117] sm:h-[600px]">
                {/* Top Bar */}
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <LogOut className="h-4 w-4 rotate-180" />
                      <span className="text-sm">Leave</span>
                    </div>
                    <div className="h-4 w-px bg-slate-800" />
                    <span className="text-sm text-slate-500">
                      Game ID:{' '}
                      <span className="font-mono text-purple-400">ABC123</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="h-4 w-4" />
                    <span className="text-xs">4/4 Players</span>
                    <Settings className="ml-2 h-4 w-4" />
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar */}
                  <div className="hidden w-64 flex-col gap-4 border-r border-slate-800 bg-slate-900/30 p-4 lg:flex">
                    <div className="rounded-lg border border-slate-800 bg-slate-800/20 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                        <Play className="h-3 w-3" />
                        Current Turn
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-medium text-white">
                          Rowan
                        </div>
                        <div className="text-xs text-slate-500">is playing</div>
                        <div className="mt-3 w-full rounded bg-purple-600 py-1.5 text-sm font-medium text-white shadow-lg shadow-purple-500/20">
                          Next Turn
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 rounded-lg border border-slate-800 bg-slate-800/20 p-4">
                      <div className="mb-3 text-xs font-medium text-slate-400">
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
                            className={`flex items-center justify-between rounded p-2 ${p.me ? 'bg-purple-500/10 ring-1 ring-purple-500/50' : 'hover:bg-slate-800/50'}`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${p.me ? 'bg-green-500' : 'bg-slate-600'}`}
                              />
                              <span
                                className={`text-sm ${p.me ? 'font-medium text-white' : 'text-slate-300'}`}
                              >
                                {p.name}
                                {p.me && (
                                  <span className="ml-2 rounded bg-purple-500/20 px-1 py-0.5 text-[10px] text-purple-300">
                                    You
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400">
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
                        className={`relative overflow-hidden rounded-lg border bg-slate-900/50 shadow-inner transition-all ${p.isActive ? 'border-purple-500/50 shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)] ring-1 ring-purple-500/30' : 'border-slate-800'}`}
                      >
                        {/* Player Header */}
                        <div className="absolute left-2 top-2 z-10 flex items-center gap-2 rounded bg-slate-950/60 px-2 py-1 text-xs backdrop-blur-sm">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${p.me ? 'bg-green-500' : 'bg-slate-500'}`}
                          />
                          <span className="text-slate-200">{p.name}</span>
                          {p.me && (
                            <span className="rounded bg-purple-500/30 px-1 py-0.5 text-[10px] font-medium text-purple-200">
                              You
                            </span>
                          )}
                        </div>

                        {/* Life Counter */}
                        <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-center backdrop-blur-sm">
                          <div className="text-xl font-bold text-white">40</div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            Life
                          </div>
                        </div>

                        {/* Simulated Camera Feed */}
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/50 to-slate-950">
                          <div className="flex flex-col items-center gap-3 opacity-20">
                            <Camera className="h-8 w-8 text-slate-400" />
                            <span className="text-sm font-medium text-slate-400">
                              Table View
                            </span>
                          </div>
                        </div>

                        {/* Card Recognition Overlay (Simulated) */}
                        {p.card && (
                          <div className="absolute right-4 top-1/2 z-20 w-24 -translate-y-1/2 rotate-3 transform transition-transform hover:rotate-0 hover:scale-150">
                            <div className="group relative aspect-[2.5/3.5] cursor-pointer overflow-hidden rounded border border-white/20 shadow-2xl">
                              {/* Placeholder for card image since we can't rely on external URLs reliably in preview without being sure they load, using a colored div with icon */}
                              <div className="flex h-full w-full items-center justify-center bg-slate-800">
                                <div className="h-full w-full bg-gradient-to-br from-amber-900/40 to-slate-900"></div>
                                <Sparkles className="absolute text-amber-200/50" />
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
            <h2 className="mb-16 text-center text-4xl text-white md:text-5xl">
              Everything You Need to Play
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <SpotlightCard
                className="border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm"
                spotlightColor="rgba(168, 85, 247, 0.15)"
              >
                <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                  <Video className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="mb-2 text-xl text-white">Battlefield Video</h3>
                <p className="text-slate-400">
                  Clear video feeds of everyone&apos;s battlefield. See your
                  opponents&apos; playmats, cards, and game state in real-time.
                </p>
              </SpotlightCard>

              <SpotlightCard
                className="border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm"
                spotlightColor="rgba(59, 130, 246, 0.15)"
              >
                <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/20">
                  <Camera className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="mb-2 text-xl text-white">Card Recognition</h3>
                <p className="text-slate-400">
                  Point your camera at cards and the system recognizes them for
                  your opponents to see.
                </p>
              </SpotlightCard>

              <SpotlightCard
                className="border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm"
                spotlightColor="rgba(34, 197, 94, 0.15)"
              >
                <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
                  <Users className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="mb-3 text-xl text-white">Game Management</h3>
                <p className="text-slate-400">
                  Life counters, turn tracking, and game state tools to keep
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
          {/* Background decoration */}
          <div className="pointer-events-none absolute left-0 top-1/2 -z-10 h-96 w-full -translate-y-1/2 bg-purple-900/5 blur-[120px]" />

          <div className="mx-auto max-w-6xl">
            <h2 className="mb-20 text-center text-4xl text-white md:text-5xl">
              How It Works
            </h2>

            <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
              {/* Connector Line (Desktop) */}
              <div className="absolute left-[16%] right-[16%] top-12 hidden h-0.5 bg-gradient-to-r from-slate-800 via-purple-900/50 to-slate-800 md:block" />

              {/* Step 1 */}
              <div className="group relative flex flex-col items-center text-center">
                <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 shadow-xl transition-all duration-300 group-hover:border-purple-500/50 group-hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)]">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <Gamepad2 className="relative z-10 h-10 w-10 text-purple-400 transition-transform duration-300 group-hover:scale-110 group-hover:text-purple-300" />
                  <div className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-sm font-bold text-white shadow-lg ring-4 ring-slate-950">
                    1
                  </div>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-white transition-colors group-hover:text-purple-300">
                  Create or Join
                </h3>
                <p className="max-w-xs leading-relaxed text-slate-400">
                  Start a new game room and share the game ID with your friends,
                  or join an existing game instantly.
                </p>
              </div>

              {/* Step 2 */}
              <div className="group relative flex flex-col items-center text-center">
                <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 shadow-xl transition-all duration-300 group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <Scan className="relative z-10 h-10 w-10 text-blue-400 transition-transform duration-300 group-hover:scale-110 group-hover:text-blue-300" />
                  <div className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-sm font-bold text-white shadow-lg ring-4 ring-slate-950">
                    2
                  </div>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-white transition-colors group-hover:text-blue-300">
                  Set Up Cameras
                </h3>
                <p className="max-w-xs leading-relaxed text-slate-400">
                  Position your main camera for your playmat and cards.
                  Optionally add a second camera for video chat.
                </p>
              </div>

              {/* Step 3 */}
              <div className="group relative flex flex-col items-center text-center">
                <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 shadow-xl transition-all duration-300 group-hover:border-green-500/50 group-hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <Swords className="relative z-10 h-10 w-10 text-green-400 transition-transform duration-300 group-hover:scale-110 group-hover:text-green-300" />
                  <div className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-sm font-bold text-white shadow-lg ring-4 ring-slate-950">
                    3
                  </div>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-white transition-colors group-hover:text-green-300">
                  Play Magic
                </h3>
                <p className="max-w-xs leading-relaxed text-slate-400">
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
            className="border-slate-800 bg-slate-900/50 px-6 py-16 text-center backdrop-blur-sm md:px-12"
            spotlightColor="rgba(168, 85, 247, 0.15)"
          >
            {/* Background effects */}
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

            <h2 className="relative z-10 mb-6 text-3xl text-white md:text-5xl">
              Ready to Enter the Coven?
            </h2>
            <p className="relative z-10 mx-auto mb-8 max-w-2xl text-lg text-slate-300">
              Join thousands of planeswalkers playing paper Magic remotely.
              It&apos;s free, runs in your browser, and brings the gathering
              back to Magic.
            </p>

            <div className="relative z-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={isAuthenticated ? handleCreateClick : onSignIn}
                className="h-14 min-w-[200px] gap-2 bg-purple-600 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 hover:bg-purple-700"
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
                  className="h-14 min-w-[200px] border-slate-700 bg-slate-900/50 text-lg font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
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
        <footer className="border-t border-slate-800 bg-slate-950">
          <div className="container mx-auto px-4 py-12">
            <div className="grid gap-8 md:grid-cols-4">
              <div className="col-span-2 space-y-4">
                <div className="flex items-center gap-2">
                  <img
                    src={logo}
                    alt="Spell Coven Logo"
                    className="h-8 w-8 rounded-lg object-contain grayscale transition-all hover:grayscale-0"
                  />
                  <span className="text-lg font-bold text-white">
                    Spell Coven
                  </span>
                </div>
                <p className="max-w-xs text-sm text-slate-400">
                  The best way to play paper Magic: The Gathering remotely with
                  friends. High-quality video, card recognition, and zero setup.
                </p>
              </div>

              <div>
                <h4 className="mb-4 text-sm font-semibold text-white">
                  Product
                </h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>
                    <a
                      href="#features"
                      onClick={(e) => handleNavClick(e, 'features')}
                      className="hover:text-purple-400"
                    >
                      Features
                    </a>
                  </li>
                  <li>
                    <a
                      href="#how-it-works"
                      onClick={(e) => handleNavClick(e, 'how-it-works')}
                      className="hover:text-purple-400"
                    >
                      How It Works
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-purple-400">
                      Changelog
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-4 text-sm font-semibold text-white">Legal</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>
                    <a href="#" className="hover:text-purple-400">
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-purple-400">
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-purple-400">
                      Cookie Policy
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-12 border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
              <p className="mb-2">Spell Coven © {new Date().getFullYear()}</p>
              <p>
                Spell Coven is unofficial Fan Content permitted under the Fan
                Content Policy. Not approved/endorsed by Wizards. Portions of
                the materials used are property of Wizards of the Coast.
                ©Wizards of the Coast LLC.
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

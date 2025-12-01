import type { AuthUser } from '@/lib/supabase/auth'
import { useState } from 'react'
import {
  Camera,
  LogIn,
  LogOut,
  Play,
  Plus,
  Sparkles,
  Users,
  Video,
  Wand2,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
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

import type { CreatorInviteState } from '../lib/session-storage.js'
import { CreateGameDialog } from './CreateGameDialog.js'

interface LandingPageProps {
  onCreateGame: () => void | Promise<void>
  onJoinGame: (playerName: string, gameId: string) => void
  isCreatingGame?: boolean
  createdGameId?: string | null
  onNavigateToRoom?: () => void
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
  onCreateGame,
  onJoinGame,
  isCreatingGame,
  createdGameId,
  onNavigateToRoom,
  inviteState: _inviteState,
  onRefreshInvite: _onRefreshInvite,
  isRefreshingInvite: _isRefreshingInvite,
  user,
  isAuthLoading,
  onSignIn,
  onSignOut,
}: LandingPageProps) {
  const [joinGameId, setJoinGameId] = useState('')
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const isAuthenticated = !!user

  const handleCreateClick = () => {
    setCreateDialogOpen(true)
    onCreateGame()
  }

  const handleJoinClick = () => {
    setJoinDialogOpen(true)
  }

  const handleJoin = () => {
    if (joinGameId.trim() && user) {
      // Use Discord username from auth
      onJoinGame(user.username, joinGameId.trim())
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
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
              <Wand2 className="h-8 w-8 text-purple-400" />
              <span className="text-xl text-white">Spell Coven</span>
            </div>
            <nav className="flex items-center gap-6">
              <a
                href="#features"
                className="hidden text-slate-300 transition-colors hover:text-white md:block"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="hidden text-slate-300 transition-colors hover:text-white md:block"
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
                      <span className="hidden md:inline">{user.username}</span>
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
                  <span className="hidden sm:inline">Sign in with Discord</span>
                  <span className="sm:hidden">Sign in</span>
                </Button>
              )}
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl space-y-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-purple-300">
                No downloads. No setup. Just play.
              </span>
            </div>

            {/* Discord invite panel removed - using Supabase now */}

            <h1 className="text-5xl text-white md:text-7xl">
              Play Magic: The Gathering
              <span className="bg-linear-to-r block from-purple-400 to-blue-400 bg-clip-text text-transparent">
                With Friends, Anywhere
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-xl text-slate-300">
              Spell Coven lets you play paper MTG remotely through video chat
              and card recognition. Use your physical cards, see your opponents,
              and enjoy the authentic experience.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 pt-8 sm:flex-row">
              {isAuthenticated ? (
                <>
                  <Button
                    size="lg"
                    className="min-w-[200px] gap-2 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                    onClick={handleCreateClick}
                    disabled={isCreatingGame}
                  >
                    <Plus className="h-5 w-5" />
                    {isCreatingGame ? 'Creating Game...' : 'Create Game'}
                  </Button>

                  <Dialog
                    open={joinDialogOpen}
                    onOpenChange={setJoinDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        size="lg"
                        variant="outline"
                        className="min-w-[200px] gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                        onClick={handleJoinClick}
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
                            placeholder="Enter game ID (e.g., game-ABC123)"
                            value={joinGameId}
                            onChange={(e) => setJoinGameId(e.target.value)}
                            className="border-slate-700 bg-slate-950 text-white"
                            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                          />
                        </div>
                        <Button
                          onClick={handleJoin}
                          disabled={!joinGameId.trim()}
                          className="w-full bg-purple-600 text-white hover:bg-purple-700"
                        >
                          Join Game Room
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Create Game Dialog */}
                  <CreateGameDialog
                    open={createDialogOpen}
                    onOpenChange={setCreateDialogOpen}
                    isCreating={isCreatingGame ?? false}
                    createdGameId={createdGameId ?? null}
                    onNavigateToRoom={onNavigateToRoom ?? (() => {})}
                  />
                </>
              ) : (
                <Button
                  size="lg"
                  className="min-w-[250px] gap-2 bg-[#5865F2] text-white hover:bg-[#4752C4]"
                  onClick={onSignIn}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Sign in with Discord to Play
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-16 text-center text-4xl text-white">
              Everything You Need to Play
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <Card className="border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                  <Video className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="mb-2 text-xl text-white">Video Chat</h3>
                <p className="text-slate-400">
                  See your opponents face-to-face with built-in video chat. No
                  third-party apps needed.
                </p>
              </Card>

              <Card className="border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/20">
                  <Camera className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="mb-2 text-xl text-white">Card Recognition</h3>
                <p className="text-slate-400">
                  Point your camera at cards and the system recognizes them for
                  your opponents to see.
                </p>
              </Card>

              <Card className="border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
                  <Users className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="mb-3 text-xl text-white">Game Management</h3>
                <p className="text-slate-400">
                  Life counters, turn tracking, and game state tools to keep
                  everything organized.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-16 text-center text-4xl text-white">
              How It Works
            </h2>
            <div className="space-y-8">
              <div className="flex items-start gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white">
                  1
                </div>
                <div>
                  <h3 className="mb-2 text-xl text-white">
                    Create or Join a Game
                  </h3>
                  <p className="text-slate-400">
                    Start a new game room and share the game ID with your
                    friends, or join an existing game.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white">
                  2
                </div>
                <div>
                  <h3 className="mb-2 text-xl text-white">
                    Set Up Your Cameras
                  </h3>
                  <p className="text-slate-400">
                    Position one camera for your face and optionally another for
                    your playmat and cards.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white">
                  3
                </div>
                <div>
                  <h3 className="mb-2 text-xl text-white">Play Magic</h3>
                  <p className="text-slate-400">
                    Use your physical cards, track life totals, and enjoy an
                    authentic MTG experience with friends anywhere in the world.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t border-slate-800 bg-slate-950/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="flex items-center gap-2">
                <Wand2 className="h-6 w-6 text-purple-400" />
                <span className="text-slate-400">Spell Coven © 2025</span>
              </div>
              <p className="text-center text-sm text-slate-500">
                Spell Coven is not affiliated with Wizards of the Coast or
                Magic: The Gathering
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

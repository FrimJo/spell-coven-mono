import { useState } from 'react'
import { Camera, Play, Plus, Sparkles, Users, Video, Wand2 } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'

import type { CreatorInviteState } from '../lib/session-storage'
import { useDiscordAuth } from '../hooks/useDiscordAuth'
import { DiscordAuthModal } from './discord/DiscordAuthModal'
import { DiscordUserProfile } from './discord/DiscordUserProfile'
import { RoomInvitePanel } from './discord/RoomInvitePanel'

interface LandingPageProps {
  onCreateGame: () => void | Promise<void>
  onJoinGame: (playerName: string, gameId: string) => void
  isCreatingGame?: boolean
  inviteState: CreatorInviteState | null
  onRefreshInvite: () => void | Promise<void>
  isRefreshingInvite?: boolean
}

export function LandingPage({
  onCreateGame,
  onJoinGame,
  isCreatingGame,
  inviteState,
  onRefreshInvite,
  isRefreshingInvite,
}: LandingPageProps) {
  const { isAuthenticated } = useDiscordAuth()
  const [joinName, setJoinName] = useState('')
  const [joinGameId, setJoinGameId] = useState('')
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleCreateClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }
    onCreateGame()
  }

  const handleJoinClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }
    setJoinDialogOpen(true)
  }


  const handleJoin = () => {
    if (joinName.trim() && joinGameId.trim()) {
      onJoinGame(joinName.trim(), joinGameId.trim())
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-950 to-blue-900/20" />

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
            <nav className="hidden items-center gap-6 md:flex">
              <a
                href="#features"
                className="text-slate-300 transition-colors hover:text-white"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-slate-300 transition-colors hover:text-white"
              >
                How It Works
              </a>
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <DiscordUserProfile />
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
                  onClick={() => setShowAuthModal(true)}
                >
                  Sign In with Discord
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

            {inviteState && (
              <div className="mx-auto w-full max-w-3xl text-left">
                <RoomInvitePanel
                  invite={inviteState}
                  onRefreshInvite={onRefreshInvite}
                  isRefreshingInvite={isRefreshingInvite}
                />
              </div>
            )}

            <h1 className="text-5xl text-white md:text-7xl">
              Play Magic: The Gathering
              <span className="block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                With Friends, Anywhere
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-xl text-slate-300">
              Spell Coven lets you play paper MTG remotely through video chat
              and card recognition. Use your physical cards, see your opponents,
              and enjoy the authentic experience.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 pt-8 sm:flex-row">
              <Button
                size="lg"
                className="min-w-[200px] gap-2 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                onClick={handleCreateClick}
                disabled={isCreatingGame}
              >
                <Plus className="h-5 w-5" />
                {isCreatingGame ? 'Creating Game...' : 'Create Game'}
              </Button>

              <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
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
                      <Label htmlFor="join-name" className="text-slate-300">
                        Your Name
                      </Label>
                      <Input
                        id="join-name"
                        placeholder="Enter your name"
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        className="border-slate-700 bg-slate-950 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="game-id" className="text-slate-300">
                        Game ID
                      </Label>
                      <Input
                        id="game-id"
                        placeholder="Enter game ID"
                        value={joinGameId}
                        onChange={(e) => setJoinGameId(e.target.value)}
                        className="border-slate-700 bg-slate-950 text-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                      />
                    </div>
                    <Button
                      onClick={handleJoin}
                      disabled={!joinName.trim() || !joinGameId.trim()}
                      className="w-full bg-purple-600 text-white hover:bg-purple-700"
                    >
                      Join Game Room
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
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
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/20">
                  <Video className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="mb-2 text-xl text-white">Video Chat</h3>
                <p className="text-slate-400">
                  See your opponents face-to-face with built-in video chat. No
                  third-party apps needed.
                </p>
              </Card>

              <Card className="border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/20">
                  <Camera className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="mb-2 text-xl text-white">Card Recognition</h3>
                <p className="text-slate-400">
                  Point your camera at cards and the system recognizes them for
                  your opponents to see.
                </p>
              </Card>

              <Card className="border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/20">
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
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-white">
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
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-white">
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
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-white">
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

      {/* Discord Auth Modal */}
      <DiscordAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  )
}

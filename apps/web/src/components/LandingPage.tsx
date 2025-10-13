import { useState } from 'react';
import { Wand2, Video, Camera, Users, Sparkles, Play, Plus } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Card } from '@repo/ui/components/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui/components/dialog';

interface LandingPageProps {
  onCreateGame: (playerName: string) => void;
  onJoinGame: (playerName: string, gameId: string) => void;
}

export function LandingPage({ onCreateGame, onJoinGame }: LandingPageProps) {
  const [createName, setCreateName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinGameId, setJoinGameId] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  const handleCreate = () => {
    if (createName.trim()) {
      onCreateGame(createName.trim());
    }
  };

  const handleJoin = () => {
    if (joinName.trim() && joinGameId.trim()) {
      onJoinGame(joinName.trim(), joinGameId.trim());
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-950 to-blue-900/20" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="w-8 h-8 text-purple-400" />
              <span className="text-xl text-white">Spell Coven</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-slate-300 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-slate-300 hover:text-white transition-colors">How It Works</a>
              <Button variant="outline" className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10">
                Sign In
              </Button>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">No downloads. No setup. Just play.</span>
            </div>

            <h1 className="text-5xl md:text-7xl text-white">
              Play Magic: The Gathering
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                With Friends, Anywhere
              </span>
            </h1>

            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Spell Coven lets you play paper MTG remotely through video chat and card recognition. 
              Use your physical cards, see your opponents, and enjoy the authentic experience.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white gap-2 min-w-[200px]">
                    <Plus className="w-5 h-5" />
                    Create Game
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create a New Game</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-name" className="text-slate-300">Your Name</Label>
                      <Input
                        id="create-name"
                        placeholder="Enter your name"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                      />
                    </div>
                    <Button 
                      onClick={handleCreate}
                      disabled={!createName.trim()}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Create Game Room
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2 min-w-[200px]">
                    <Play className="w-5 h-5" />
                    Join Game
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800">
                  <DialogHeader>
                    <DialogTitle className="text-white">Join a Game</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="join-name" className="text-slate-300">Your Name</Label>
                      <Input
                        id="join-name"
                        placeholder="Enter your name"
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="game-id" className="text-slate-300">Game ID</Label>
                      <Input
                        id="game-id"
                        placeholder="Enter game ID"
                        value={joinGameId}
                        onChange={(e) => setJoinGameId(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                      />
                    </div>
                    <Button 
                      onClick={handleJoin}
                      disabled={!joinName.trim() || !joinGameId.trim()}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
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
          <div className="max-w-6xl mx-auto">
            <h2 className="text-center text-4xl text-white mb-16">Everything You Need to Play</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                  <Video className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl text-white mb-2">Video Chat</h3>
                <p className="text-slate-400">
                  See your opponents face-to-face with built-in video chat. No third-party apps needed.
                </p>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                  <Camera className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl text-white mb-2">Card Recognition</h3>
                <p className="text-slate-400">
                  Point your camera at cards and the system recognizes them for your opponents to see.
                </p>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-xl text-white mb-3">Game Management</h3>
                <p className="text-slate-400">
                  Life counters, turn tracking, and game state tools to keep everything organized.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-center text-4xl text-white mb-16">How It Works</h2>
            <div className="space-y-8">
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white">
                  1
                </div>
                <div>
                  <h3 className="text-xl text-white mb-2">Create or Join a Game</h3>
                  <p className="text-slate-400">
                    Start a new game room and share the game ID with your friends, or join an existing game.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white">
                  2
                </div>
                <div>
                  <h3 className="text-xl text-white mb-2">Set Up Your Cameras</h3>
                  <p className="text-slate-400">
                    Position one camera for your face and optionally another for your playmat and cards.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white">
                  3
                </div>
                <div>
                  <h3 className="text-xl text-white mb-2">Play Magic</h3>
                  <p className="text-slate-400">
                    Use your physical cards, track life totals, and enjoy an authentic MTG experience with friends anywhere in the world.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-slate-950/50 backdrop-blur-sm mt-20">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <Wand2 className="w-6 h-6 text-purple-400" />
                <span className="text-slate-400">Spell Coven © 2025</span>
              </div>
              <p className="text-slate-500 text-sm text-center">
                Spell Coven is not affiliated with Wizards of the Coast or Magic: The Gathering
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

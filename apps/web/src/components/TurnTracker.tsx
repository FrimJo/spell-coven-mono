import { Play, RotateCw } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

interface Player {
  id: string
  name: string
}

interface TurnTrackerProps {
  players: Player[]
  onNextTurn: () => void
}

export function TurnTracker({ players, onNextTurn }: TurnTrackerProps) {
  const hasPlayers = players.length > 0

  return (
    <Card className="border-slate-800 bg-slate-900 p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-slate-400">
          <Play className="h-4 w-4" />
          <span className="text-sm">Turn Control</span>
        </div>

        <Button
          onClick={onNextTurn}
          className="w-full bg-purple-600 text-white hover:bg-purple-700"
          size="sm"
          disabled={!hasPlayers}
        >
          <RotateCw className="mr-2 h-4 w-4" />
          Next Turn
        </Button>
      </div>
    </Card>
  )
}

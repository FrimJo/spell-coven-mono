import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import { Heart, Minus, Plus } from 'lucide-react'

interface Player {
  id: string
  name: string
  life: number
  isActive: boolean
}

interface PlayerStatsProps {
  player: Player
  onLifeChange: (newLife: number) => void
}

export function PlayerStats({ player, onLifeChange }: PlayerStatsProps) {
  const handleIncrement = (amount: number) => {
    onLifeChange(player.life + amount)
  }

  const handleDecrement = (amount: number) => {
    onLifeChange(Math.max(0, player.life - amount))
  }

  return (
    <Card
      className={`border-slate-800 bg-slate-900 p-4 transition-all ${
        player.isActive ? 'border-purple-500 ring-2 ring-purple-500' : ''
      }`}
    >
      <div className="space-y-3">
        {/* Player Name */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">{player.name}</span>
          {player.isActive && (
            <span className="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300">
              Active
            </span>
          )}
        </div>

        {/* Life Total */}
        <div className="py-2 text-center">
          <div className="mb-1 flex items-center justify-center gap-2">
            <Heart className="h-4 w-4 text-red-400" />
            <span className="text-xs text-slate-400">LIFE</span>
          </div>
          <div className="text-4xl text-white">{player.life}</div>
        </div>

        {/* Life Adjustment Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleIncrement(1)}
            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
          >
            <Plus className="mr-1 h-4 w-4" />1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDecrement(1)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Minus className="mr-1 h-4 w-4" />1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleIncrement(5)}
            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
          >
            <Plus className="mr-1 h-4 w-4" />5
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDecrement(5)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Minus className="mr-1 h-4 w-4" />5
          </Button>
        </div>
      </div>
    </Card>
  )
}

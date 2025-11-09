import { Card } from '@repo/ui/components/card'

interface Player {
  id: string
  name: string
}

interface PlayerStatsProps {
  player: Player
}

export function PlayerStats({ player }: PlayerStatsProps) {
  return (
    <Card className="border-slate-800 bg-slate-900 p-4">
      <div className="space-y-3">
        {/* Player Name */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">{player.name}</span>
        </div>
      </div>
    </Card>
  )
}

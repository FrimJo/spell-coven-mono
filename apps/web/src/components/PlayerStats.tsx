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
    <Card className="p-4 border-surface-2 bg-surface-1">
      <div className="space-y-3">
        {/* Player Name */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">{player.name}</span>
        </div>
      </div>
    </Card>
  )
}

import { Badge } from '@repo/ui/components/badge'

export function BetaBanner() {
  return (
    <div
      role="status"
      aria-label="Spell Coven beta notice"
      className="bg-warning-muted/95 text-warning-muted-foreground border-warning/30 supports-[backdrop-filter]:bg-warning-muted/85 sticky top-0 z-50 border-b backdrop-blur"
    >
      <div className="mx-auto flex min-h-10 w-full max-w-7xl items-center justify-center gap-3 px-4 py-2 text-center text-sm sm:min-h-9">
        <Badge
          variant="outline"
          className="border-warning/40 bg-warning/15 text-warning-muted-foreground shrink-0 uppercase tracking-wide"
        >
          Beta
        </Badge>
        <p className="max-w-none text-balance leading-snug">
          Spell Coven is in beta. Expect occasional changes, rough edges, and
          brief interruptions while the experience improves.
        </p>
      </div>
    </div>
  )
}

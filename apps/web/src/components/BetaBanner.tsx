import { useState } from 'react'

import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'

import { FeedbackDialog } from './FeedbackDialog'

export function BetaBanner() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  return (
    <>
      <section
        aria-label="Spell Coven beta notice"
        className="bg-warning-muted/95 text-warning-muted-foreground border-warning/30 supports-[backdrop-filter]:bg-warning-muted/85 sticky top-0 z-50 border-b backdrop-blur"
      >
        <div className="mx-auto flex min-h-10 w-full max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm sm:min-h-9">
          <Badge
            variant="outline"
            className="border-warning/40 bg-warning/15 text-warning-muted-foreground shrink-0 uppercase tracking-wide"
          >
            Beta
          </Badge>
          <p className="max-w-none text-balance leading-snug">
            Spell Coven is in beta. Expect occasional changes, rough edges, and
            brief interruptions while the experience improves.{' '}
            <Button
              type="button"
              variant="link"
              className="text-warning-muted-foreground h-auto p-0 align-baseline font-semibold"
              onClick={() => setIsFeedbackOpen(true)}
            >
              Share feedback
            </Button>
          </p>
        </div>
      </section>

      <FeedbackDialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />
    </>
  )
}

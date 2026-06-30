import { useEffect, useRef } from 'react'

import { Card } from '@repo/ui/components/card'

interface SidebarCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count: string | number
  children: React.ReactNode
  maxHeight?: string
  fillRemaining?: boolean
  onScrollToTop?: boolean
  scrollTrigger?: number
  headerAction?: React.ReactNode
  countTestId?: string
}

/** Shared sidebar card with an optional independently scrolling body. */
export function SidebarCard({
  icon: Icon,
  title,
  count,
  children,
  maxHeight,
  fillRemaining,
  onScrollToTop,
  scrollTrigger,
  headerAction,
  countTestId,
}: SidebarCardProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevScrollTriggerRef = useRef(scrollTrigger ?? 0)

  useEffect(() => {
    if (
      onScrollToTop &&
      scrollTrigger !== undefined &&
      scrollTrigger > prevScrollTriggerRef.current &&
      scrollContainerRef.current
    ) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    if (scrollTrigger !== undefined) {
      prevScrollTriggerRef.current = scrollTrigger
    }
  }, [scrollTrigger, onScrollToTop])

  const contentClassName = fillRemaining
    ? 'min-h-0 flex-1 overflow-y-auto'
    : maxHeight
      ? `min-h-0 ${maxHeight} overflow-y-auto`
      : ''

  return (
    <Card
      className={`border-surface-2 bg-surface-1 gap-0 overflow-hidden ${fillRemaining ? 'flex max-h-full min-h-0 flex-col' : ''} `}
    >
      <div className="border-surface-2 bg-surface-0/50 flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className="text-text-muted size-4" />
          <span className="text-text-secondary text-sm font-medium">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs" data-testid={countTestId}>
            {count}
          </span>
          {headerAction}
        </div>
      </div>
      <div ref={scrollContainerRef} className={contentClassName}>
        {children}
      </div>
    </Card>
  )
}

import * as React from 'react'

import { cn } from '@repo/ui/lib/utils'

const Card = React.memo(function Card({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'gap-6 flex flex-col rounded-xl border bg-card text-card-foreground',
        className,
      )}
      {...props}
    />
  )
})

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '[.border-b]:pb-6 gap-1.5 px-6 pt-6 @container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start has-data-[slot=card-action]:grid-cols-[1fr_auto]',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <h4
      data-slot="card-title"
      className={cn('leading-none', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-6 [&:last-child]:pb-6', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('[.border-t]:pt-6 px-6 pb-6 flex items-center', className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}

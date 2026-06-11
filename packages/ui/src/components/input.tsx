import * as React from 'react'

import { cn } from '@repo/ui/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 min-w-0 px-3 py-1 text-base file:h-7 file:text-sm file:font-medium md:text-sm flex w-full rounded-md border border-input bg-input-background transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground hover:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[1px] focus-visible:ring-ring/20',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

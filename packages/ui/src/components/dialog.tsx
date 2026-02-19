'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@repo/ui/lib/utils'

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className,
      )}
      {...props}
    />
  )
}

interface DialogContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /**
   * When provided, the dialog content is centered within this element
   * instead of the viewport. The overlay is also scoped to this element
   * (portaled into it with position: absolute), so the backdrop only
   * covers the container, not the whole window.
   */
  centerInRef?: React.RefObject<HTMLElement | null>
  /**
   * When centerInRef is used, pass the dialog's open state here so positioning
   * re-runs when the dialog opens (Radix may not pass data-state reliably).
   */
  forceReposition?: boolean
}

function DialogContent({
  className,
  children,
  centerInRef,
  forceReposition,
  style,
  ...props
}: DialogContentProps) {
  const [containerEl, setContainerEl] = React.useState<HTMLElement | null>(null)
  const [position, setPosition] = React.useState<{
    left: number
    top: number
  } | null>(null)

  React.useLayoutEffect(() => {
    const container = centerInRef?.current ?? null
    setContainerEl(container)

    if (!container || !forceReposition) {
      setPosition(null)
      return
    }
    const updatePosition = () => {
      const rect = container.getBoundingClientRect()
      if (rect) {
        setPosition({
          left: rect.left + rect.width / 2,
          top: rect.top + rect.height / 2,
        })
      }
    }
    updatePosition()
    const observer = new ResizeObserver(updatePosition)
    observer.observe(container)
    return () => observer.disconnect()
  }, [centerInRef, forceReposition])

  const useCustomPosition = Boolean(containerEl) && position !== null
  const scopeOverlayToContainer = Boolean(containerEl)

  const overlay = scopeOverlayToContainer ? (
    <DialogOverlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 absolute inset-0 z-50 bg-black/50" />
  ) : (
    <DialogOverlay />
  )

  const content = (
    <DialogPrimitive.Content
      data-slot="dialog-content"
      className={cn(
        'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
        !useCustomPosition &&
          'left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]',
        className,
      )}
      style={
        useCustomPosition
          ? {
              ...style,
              left: position!.left,
              top: position!.top,
              transform: 'translate(-50%, -50%)',
            }
          : style
      }
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-xs focus:outline-hidden absolute right-4 top-4 cursor-pointer opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0">
        <XIcon />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  )

  return (
    <DialogPortal
      container={containerEl ?? undefined}
      data-slot="dialog-portal"
    >
      {scopeOverlayToContainer ? (
        <div className="absolute inset-0">
          {overlay}
          {content}
        </div>
      ) : (
        <>
          {overlay}
          {content}
        </>
      )}
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg font-semibold leading-none', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

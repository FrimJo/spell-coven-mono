'use client'

import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@repo/ui/lib/utils'

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  forceMount,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return (
    <SheetPrimitive.Portal
      data-slot="sheet-portal"
      forceMount={forceMount}
      {...props}
    />
  )
}

function SheetOverlay({
  className,
  forceMount,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      forceMount={forceMount}
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 inset-0 bg-black/50 fixed z-50 transition-opacity data-[state=closed]:pointer-events-none data-[state=closed]:duration-300 data-[state=closed]:ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:duration-500 data-[state=open]:ease-[cubic-bezier(0.32,0.72,0,1)]',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  forceMount,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** When true, overlay and content stay mounted for smooth exit animations */
  forceMount?: boolean
}) {
  return (
    <SheetPortal forceMount={forceMount}>
      <SheetOverlay forceMount={forceMount} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        forceMount={forceMount}
        className={cn(
          'data-[state=open]:animate-in data-[state=closed]:animate-out gap-4 shadow-lg fixed z-50 flex flex-col bg-background transition-all data-[state=closed]:pointer-events-none data-[state=closed]:duration-300 data-[state=closed]:ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:duration-500 data-[state=open]:ease-[cubic-bezier(0.32,0.72,0,1)]',
          side === 'right' &&
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 sm:max-w-sm h-full w-3/4 border-l',
          side === 'left' &&
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 sm:max-w-sm h-full w-3/4 border-r',
          side === 'top' &&
            'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
          side === 'bottom' &&
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="rounded-xs right-4 top-4 absolute cursor-pointer opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('gap-1.5 p-4 flex flex-col', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('gap-2 p-4 mt-auto flex flex-col', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

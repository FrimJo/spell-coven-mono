/**
 * Right-click context menu for webcam tiles. Provides rotation, horizontal
 * flip, and reset. Wraps an arbitrary trigger element (the video tile).
 */
import type { UseVideoOrientationReturn } from '@/hooks/useVideoOrientation'
import type { ReactNode } from 'react'
import { FlipHorizontal2, RotateCcw, RotateCw, Undo2 } from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@repo/ui/components/context-menu'

interface VideoOrientationContextMenuProps {
  orientation: UseVideoOrientationReturn
  children: ReactNode
}

export function VideoOrientationContextMenu({
  orientation,
  children,
}: VideoOrientationContextMenuProps) {
  const isModified = orientation.rotation !== 0 || orientation.mirrored
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={orientation.rotateLeft}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Rotate left
        </ContextMenuItem>
        <ContextMenuItem onSelect={orientation.rotateRight}>
          <RotateCw className="mr-2 h-4 w-4" />
          Rotate right
        </ContextMenuItem>
        <ContextMenuItem onSelect={orientation.toggleMirror}>
          <FlipHorizontal2 className="mr-2 h-4 w-4" />
          {orientation.mirrored ? 'Unmirror' : 'Mirror horizontally'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={orientation.reset} disabled={!isModified}>
          <Undo2 className="mr-2 h-4 w-4" />
          Reset orientation
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

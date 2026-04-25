/**
 * Right-click context menu for webcam tiles. Provides rotation, horizontal
 * flip, zoom, and reset. Wraps an arbitrary trigger element (the video tile).
 */
import type { UseVideoOrientationReturn } from '@/hooks/useVideoOrientation'
import type { ReactNode } from 'react'
import { ZOOM_MAX, ZOOM_MIN } from '@/hooks/useVideoOrientation'
import {
  FlipHorizontal2,
  RotateCcw,
  RotateCw,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

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
  /** Optional items rendered above the orientation/zoom items */
  topSlot?: ReactNode
}

export function VideoOrientationContextMenu({
  orientation,
  children,
  topSlot,
}: VideoOrientationContextMenuProps) {
  const isModified =
    orientation.rotation !== 0 || orientation.mirrored || orientation.zoom !== 1
  const canZoomIn = orientation.zoom < ZOOM_MAX
  const canZoomOut = orientation.zoom > ZOOM_MIN
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {topSlot}
        {topSlot ? <ContextMenuSeparator /> : null}
        <ContextMenuItem onSelect={orientation.zoomIn} disabled={!canZoomIn}>
          <ZoomIn className="mr-2 h-4 w-4" />
          Zoom in
        </ContextMenuItem>
        <ContextMenuItem onSelect={orientation.zoomOut} disabled={!canZoomOut}>
          <ZoomOut className="mr-2 h-4 w-4" />
          Zoom out ({orientation.zoom.toFixed(2)}×)
        </ContextMenuItem>
        <ContextMenuSeparator />
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
          Reset
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

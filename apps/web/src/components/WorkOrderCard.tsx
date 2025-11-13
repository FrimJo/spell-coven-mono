import * as React from 'react'

import { cn } from '@repo/ui/lib/utils'

interface WorkOrderCardProps {
  status: string
  isSelected: boolean
  workOrderItem: unknown
  onClick: () => void
  children: React.ReactNode
}

export const WorkOrderCard = ({
  status,
  isSelected,
  workOrderItem,
  onClick,
  children,
}: WorkOrderCardProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg border transition-colors',
        isSelected && 'ring-2 ring-primary',
      )}
    >
      <div className="bg-yellow-400 p-4 flex-1">{children}</div>
    </div>
  )
}


